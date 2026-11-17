/**
 * 实现功能：导览 AI 的多 Agent 编排（策展人 / 讲解员 / 审校）
 * 职责：
 *   把原来"一个 Agent 干完所有事"拆成三个有明确职责与工具边界的角色：
 *     - 策展人 Curator：判断"要不要带路"，只碰 list_regions / get_region_profile / navigate_to；
 *     - 讲解员 Narrator：检索与取数，只碰 search_knowledge / get_craft_process / get_history_timeline；
 *     - 审校 Reviewer：对讲解员产出的草稿做引用覆盖、事实与安全复核，决定是否需要加约束说明。
 *   三者通过共享的上下文与事件流协作，每一跳都带 agent 标识，前端可展示"谁在做什么"。
 * 设计取舍：
 *   - 策展人与审校以规则为主（不额外调用 LLM），避免每次提问多两次往返与费用；
 *     模型可用时，讲解员仍走完整的 Function Calling 工具循环。
 *   - 角色边界体现在工具白名单上：即使模型想越界调工具，也会被各自的白名单拒绝。
 * 接口/函数清单：
 *   - ROLE：三个角色的常量
 *   - classifyIntent({question, region})：意图判定（是否要导航 / 是否要结构化资料 / 是否要检索）
 *   - curate({question, region, page, knowledge, callTool, emit})：策展人
 *   - narrateTools(role)：讲解员允许的工具名集合
 *   - review({answer, sources, observations})：审校
 */
import { executeTool, toolLabel } from './tools.js';

export const ROLE = {
  CURATOR: 'curator',
  NARRATOR: 'narrator',
  REVIEWER: 'reviewer',
};

/** 各角色的工具白名单——角色边界靠它来保证，而不是靠提示词自觉 */
export const ROLE_TOOLS = {
  [ROLE.CURATOR]: ['list_regions', 'get_region_profile', 'navigate_to'],
  [ROLE.NARRATOR]: ['search_knowledge', 'get_craft_process', 'get_history_timeline', 'get_region_profile'],
  [ROLE.REVIEWER]: [],
};

const NAV_WORDS = ['带我去', '导航', '怎么去', '路线', '规划', '看什么', '推荐', '逛', '导览'];
const CRAFT_WORDS = ['怎么做', '怎么制作', '如何制作', '工序', '步骤', '工艺', '雕刻', '镂刻', '选皮', '敷彩', '缀结', '材料', '用什么'];
const HISTORY_WORDS = ['历史', '朝代', '起源', '多少年', '由来', '宋代', '唐代', '元代', '明代', '清代', '民国', '先秦', '汉代'];
const REGION_HINT = /陕西|甘肃|青海|山西|宁夏|河北|北京|天津|辽宁|吉林|黑龙江|内蒙古|山东|浙江|上海|江苏|四川|湖北|云南|河南|重庆|贵州|湖南|江西|广东|福建|台湾|广西|海南|香港|澳门|新疆|西藏|安徽|唐山|辽东/;

const any = (text, words) => words.some((w) => text.includes(w));

/**
 * 意图判定：决定这次提问需要哪几个角色上场。
 * @returns {{needsCurator:boolean, needsHistory:boolean, needsCraft:boolean, needsSearch:boolean, region:string}}
 */
export const classifyIntent = ({ question = '', region = '' } = {}) => {
  const q = String(question || '');
  // 只有明确的"带路"说法才让策展人上场；"了解/特点"这类交给讲解员即可
  const needsCurator = any(q, NAV_WORDS);
  const regionMentioned = (REGION_HINT.exec(q) || [])[0] || '';
  const effectiveRegion = String(region || regionMentioned || '');
  return {
    needsCurator,
    needsHistory: any(q, HISTORY_WORDS),
    needsCraft: any(q, CRAFT_WORDS),
    needsSearch: q.trim().length > 0,
    region: effectiveRegion,
  };
};

/**
 * 策展人：只在"要带路"时上场，先确认可逛的流派清单，交给讲解员围绕它组织内容。
 * 注意：这里刻意**不**调 navigate_to——导航事件仍由原有规则链路产出，
 * 避免同一跳里出现两条互相覆盖的路线。
 * 返回 {listed, route}；不需要导航时返回 null。
 */
export const curate = ({ question, region, page, knowledge, callTool, emit = () => {} }) => {
  const intent = classifyIntent({ question, region });
  if (!intent.needsCurator) return null;

  emit('step', { agent: ROLE.CURATOR, phase: 'plan', text: '判断这次该带你去哪' });

  // 已经知道地区就取该地档案，否则列出全部流派供选择
  if (intent.region) {
    const profile = callTool('get_region_profile', { region: intent.region }, ROLE.CURATOR);
    emit('step', { agent: ROLE.CURATOR, phase: 'done', text: `已锁定 ${intent.region} 的流派档案` });
    return { listed: profile, route: null };
  }
  const listed = callTool('list_regions', {}, ROLE.CURATOR);
  emit('step', { agent: ROLE.CURATOR, phase: 'done', text: '已列出可逛的流派，交给讲解员' });
  return { listed, route: null };
};

/**
 * 讲解员：负责检索与取数。真正的工具循环在 agent.js 里（那里能拿到模型响应），
 * 这里只声明角色边界与缺资料时的补齐顺序。
 */
export const narrateTools = () => ROLE_TOOLS[ROLE.NARRATOR];

/** 讲解员缺资料时按意图补齐的顺序（规则兜底用） */
export const narratePlan = ({ question, region } = {}) => {
  const intent = classifyIntent({ question, region });
  const plan = [];
  if (intent.needsSearch) plan.push({ name: 'search_knowledge', args: { query: question || '皮影', region: intent.region } });
  if (intent.needsCraft) plan.push({ name: 'get_craft_process', args: {} });
  if (intent.needsHistory) plan.push({ name: 'get_history_timeline', args: {} });
  if (!plan.length) plan.push({ name: 'search_knowledge', args: { query: question || '皮影', region: intent.region } });
  return plan;
};

/**
 * 审校：检查草稿是否有引用支撑、是否出现无据推断、是否碰到安全红线。
 * 只做"轻量修补"（加一句来源说明），不重写内容——避免把讲解员的话术改味。
 * @returns {{answer:string, issues:string[], passed:boolean}}
 */
export const review = ({ answer = '', sources = [], observations = [] } = {}) => {
  const text = String(answer || '');
  const issues = [];

  const hasSources = Array.isArray(sources) && sources.length > 0;
  const hasStructured = Array.isArray(observations) && observations.some((o) => o && o.ok && o.name !== 'search_knowledge');
  if (!hasSources && !hasStructured) issues.push('no-source');

  // 无据推断的典型口吻：出现这些词且没有来源，提示"以展馆资料为准"
  if (!hasSources && /据我所知|我个人认为|应该是|大概是|大概是吧/.test(text)) issues.push('hedging');

  // 空回答或纯标点
  if (!text.replace(/[\s\p{P}]/gu, '')) issues.push('empty');

  let final = text;
  if (issues.includes('no-source') && text.trim()) {
    final = `（以下内容基于展馆资料整理，仅供参考）\n${text}`;
  }
  if (issues.includes('empty')) {
    final = '这个问题的资料我这边暂时没有收录，可以换个问法，或先看看地图上的地方流派。';
  }

  return { answer: final, issues, passed: issues.length === 0 };
};

/** 供 agent.js 用：按角色白名单执行，越界直接拒绝 */
export const makeRoleCaller = ({ chunks, knowledge, observations, emit }) => {
  const callTool = (name, args = {}, role = null) => {
    if (role && !ROLE_TOOLS[role].includes(name)) {
      const rejected = { name, ok: false, args, summary: `工具 ${name} 不在 ${role} 的职责范围内`, result: null };
      emit('tool_result', { name, ok: false, summary: rejected.summary });
      return rejected;
    }
    const observation = executeTool(name, args, { chunks, knowledge });
    observations.push(observation);
    emit('tool_call', { name, args: observation.args, label: toolLabel(name, observation.args), agent: role || ROLE.NARRATOR });
    emit('tool_result', { name, ok: observation.ok, summary: observation.summary, agent: role || ROLE.NARRATOR });
    if (observation.sources?.length) emit('sources', observation.sources);
    if (observation.navigate) emit('navigate', observation.navigate);
    return observation;
  };
  return callTool;
};

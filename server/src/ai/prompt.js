/**
 * 实现功能：RAG prompt 组装与兜底
 * 职责：把检索到的编号材料 + 用户问题 + 当前上下文组成本应用讲解员 prompt；
 *       强调"只依据材料、注明来源、不知为不知"以控幻觉；提供无 LLM 时的静态兜底文本。
 * 接口/函数清单：
 *   - buildMessages({question, region, page, sources})
 *   - narrateQuestion({region, page})
 *   - fallbackAnswer(sources)
 */

const SYSTEM = [
  '你是"云上皮影"非遗数字展馆的 AI 讲解员，面向参观者介绍中国皮影戏（国家级非物质文化遗产）。',
  '纪律：',
  '1. 只依据下方编号参考材料回答，不得编造材料之外的史实、数据或剧目；',
  '2. 引用材料时在句末标注编号，如 [1][2]；',
  '3. 材料不足以回答时，明确说"现有资料未涵盖这一点"，再给出材料内相关的可靠信息；',
  '4. 用亲切、简洁的中文讲解，避免堆砌术语；适当分点或分段，便于阅读；',
  '5. 不讨论与皮影非遗无关的请求，礼貌引导回展馆主题。',
].join('\n');

const PAGE_LABEL = {
  '/select': '地图寻影',
  '/display': '皮影展示',
  '/process': '工艺流程',
  '/interactive': '光影互动',
  '/history': '光影溯源',
  '/school': '地域流派',
  '/quiz': '知识挑战',
};

export const buildMessages = ({ question, region = '', page = '', sources = [] }) => {
  const materials = sources
    .map((s, i) => `[${i + 1}] 《${s.chunk.title}》（${s.chunk.topic}${s.chunk.region ? `·${s.chunk.region}` : ''}）\n${s.chunk.text}`)
    .join('\n\n');
  const context = [
    region ? `当前地区：${region}` : '',
    page ? `当前页面：${PAGE_LABEL[page] || page}` : '',
  ].filter(Boolean).join('；');
  const user = [
    context ? `【参观上下文】${context}` : '',
    `【参观者问题】${question}`,
    '',
    '【参考材料】',
    materials || '（无检索到的材料）',
  ].filter(Boolean).join('\n');
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ];
};

export const narrateQuestion = ({ region = '', page = '' }) => {
  if (region) {
    return `请为参观者讲解${region}皮影：造型、色彩、唱腔特色与代表剧目，并点出它最值得留意的一处细节。`;
  }
  if (page === '/process') return '请概述皮影制作的核心工序，带参观者看懂一件皮影是如何诞生的。';
  if (page === '/history') return '请简述皮影戏的历史起源与演变脉络，帮参观者建立时间线印象。';
  return '请概述皮影戏是什么、它的历史起源与制作工艺亮点，引导参观者入门这座数字展馆。';
};

/** 无 LLM / 调用失败时的静态兜底：直接呈现检索到的 curated 材料摘要 */
export const fallbackAnswer = (sources = []) => {
  if (!sources.length) {
    return '现有资料未涵盖这一点。你可以换个问法，或问我"皮影怎么做""皮影的起源""陕西皮影有什么特色"。';
  }
  const body = sources
    .slice(0, 3)
    .map((s, i) => `[${i + 1}] ${s.chunk.title}\n${s.chunk.text.slice(0, 220)}`)
    .join('\n\n');
  return `（AI 暂不可用，以下为展馆 curated 资料）\n\n${body}`;
};

// ---------------------------------------------------------------------------
// Agent（工具调用 / 工作流）提示词与离线整理
// ---------------------------------------------------------------------------

const AGENT_SYSTEM = [
  '你是"云上皮影"非遗数字展馆的 AI 导览 Agent，可以调用展馆工具来完成参观者的请求。',
  '可用能力：检索资料库、读取地区流派档案、读取制作工序、读取历史时间线、列出收录地区、规划页面跳转。',
  '纪律：',
  '1. 需要事实信息时先调用相应工具，可一次调用多个；工具观测结果是你唯一可信的事实来源；',
  '2. 用户明确想"去/打开/看看某个页面或展项"时，调用 navigate_to 规划路线；',
  '3. 不得编造观测结果之外的史实、数据或剧目；',
  '4. 用亲切、简洁的中文，适当分点；与皮影非遗无关的请求礼貌拒绝并引导回展馆。',
].join('\n');

const agentContext = ({ region = '', page = '' }) => [
  region ? `当前地区：${region}` : '',
  page ? `当前页面：${PAGE_LABEL[page] || page}` : '',
].filter(Boolean).join('；');

/** 工具规划阶段：让模型决定调用哪些工具（不要求它作答） */
export const buildAgentPlanMessages = ({ question, region = '', page = '' }) => {
  const context = agentContext({ region, page });
  const user = [
    context ? `【参观上下文】${context}` : '',
    `【参观者请求】${question}`,
    '',
    '请判断是否需要调用工具补充资料：需要就调用（可多个），不需要就不要再调用。',
  ].filter(Boolean).join('\n');
  return [
    { role: 'system', content: AGENT_SYSTEM },
    { role: 'user', content: user },
  ];
};

/** 最终作答阶段：把工具观测结果作为唯一事实来源注入 */
export const buildAgentFinalMessages = ({ question, region = '', page = '', observations = [] }) => {
  const context = agentContext({ region, page });
  const observationText = observations
    .map((o, i) => `【观测${i + 1}】工具 ${o.name}${o.ok ? '' : '（失败）'}\n${JSON.stringify(o.result).slice(0, 1400)}`)
    .join('\n\n');
  const user = [
    context ? `【参观上下文】${context}` : '',
    `【参观者请求】${question}`,
    '',
    '【工具观测结果】',
    observationText || '（无）',
    '',
    '请严格依据以上观测结果回答；引用资料时在句末用《资料标题》标注来源；资料不足时明确说明。',
  ].filter(Boolean).join('\n');
  return [
    { role: 'system', content: `${AGENT_SYSTEM}\n回答要求：只依据工具观测结果，不编造；简洁分点；中文。` },
    { role: 'user', content: user },
  ];
};

/** 无 LLM / 生成失败时的离线整理：把工具观测结果转成可读文本 */
export const offlineAgentAnswer = (observations = []) => {
  const parts = [];
  for (const obs of observations) {
    const result = obs.result || {};
    if (obs.name === 'get_region_profile' && result.found) {
      parts.push(
        `【${result.region}皮影${result.school ? ` · ${result.school}` : ''}】`
        + `造型：${result.styling || '—'}；色彩：${result.coloring || '—'}；`
        + `唱腔：${result.singing || '—'}；代表剧目：${result.plays || '—'}。`,
      );
    } else if (obs.name === 'get_craft_process' && result.steps?.length) {
      parts.push(`【制作工序】共 ${result.steps.length} 道：${result.steps.map((s) => s.title).join(' → ')}。`);
    } else if (obs.name === 'get_history_timeline' && result.nodes?.length) {
      parts.push(
        `【历史脉络】${result.nodes
          .map((n) => `${n.era}${n.timeRange ? `（${n.timeRange}）` : ''}${n.title ? `·${n.title}` : ''}`)
          .join('；')}。`,
      );
    } else if (obs.name === 'list_regions' && result.regions?.length) {
      parts.push(`【收录地区】${result.regions.join('、')}。`);
    } else if (obs.name === 'navigate_to' && result.route) {
      parts.push(
        `【导览路线】已为你规划前往「${PAGE_LABEL[result.route.path] || result.route.path}」`
        + `${result.route.query?.region ? `（${result.route.query.region}）` : ''}的路线。`,
      );
    }
  }
  const search = observations.find((o) => o.name === 'search_knowledge' && o.sources?.length);
  if (search && parts.length === 0) {
    parts.push(`【资料摘录】\n${search.sources.slice(0, 3).map((s, i) => `[${i + 1}]《${s.title}》`).join('\n')}`);
  }
  if (!parts.length) {
    return '现有资料未涵盖这一点。你可以换个问法，或问我"皮影怎么做""皮影的起源""带我去看陕西皮影"。';
  }
  return `（AI 暂不可用，以下为展馆资料与工具观测整理）\n\n${parts.join('\n\n')}`;
};
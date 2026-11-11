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
  '你是"云幕皮影"非遗数字展馆的 AI 讲解员，面向参观者介绍中国皮影戏（国家级非物质文化遗产）。',
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
// 多模态：识图讲解（图片 + 文本 → 讲解）
// ---------------------------------------------------------------------------

const VISION_SYSTEM = [
  '你是"云幕皮影"非遗数字展馆的 AI 鉴影师，擅长看图讲解中国皮影戏（国家级非物质文化遗产）。',
  '纪律：',
  '1. 先客观描述图片里能看到的皮影元素（造型、角色、色彩、雕镂纹样、关节结构等），再结合材料讲解；',
  '2. 只依据图片内容与下方编号材料，不臆造年代、作者或流派，不确定处明确说明；',
  '3. 图片若与皮影/传统工艺无关，礼貌说明并引导回展馆主题；',
  '4. 引用材料时在句末标注编号，如 [1]；',
  '5. 用亲切、简洁的中文，适当分点，便于参观者阅读。',
].join('\n');

/** 组装识图消息：user 内容为多模态数组（text + image_url），仅 chat 协议直接可用 */
export const buildVisionMessages = ({ question = '', region = '', page = '', sources = [], imageDataUrl }) => {
  const materials = sources
    .map((s, i) => `[${i + 1}] 《${s.chunk.title}》（${s.chunk.topic}${s.chunk.region ? `·${s.chunk.region}` : ''}）\n${s.chunk.text}`)
    .join('\n\n');
  const context = [
    region ? `当前地区：${region}` : '',
    page ? `当前页面：${PAGE_LABEL[page] || page}` : '',
  ].filter(Boolean).join('；');
  const ask = question || '请识别并讲解这张皮影图片。';
  const text = [
    context ? `【参观上下文】${context}` : '',
    `【参观者问题】${ask}`,
    '',
    '【参考材料】',
    materials || '（无检索到的材料）',
    '',
    '请结合图片内容作答。',
  ].filter(Boolean).join('\n');
  return [
    { role: 'system', content: VISION_SYSTEM },
    {
      role: 'user',
      content: [
        { type: 'text', text },
        { type: 'image_url', image_url: { url: imageDataUrl } },
      ],
    },
  ];
};

/** 无视觉模型 / 调用失败时的兜底：给"皮影赏析四看"+ 检索材料，保证识图入口永远有内容 */
export const fallbackVisionAnswer = (sources = []) => {
  const tips = [
    '【看造型】影人四肢、关节以线连缀，留意头部与身段的夸张比例；',
    '【看色彩】传统多用红、黄、绿、黑，对比鲜明，透光后层次分明；',
    '【看雕镂】观察发丝、衣纹与甲片的镂空刀路，越细密越考究；',
    '【看角色】净角多阳刻、旦角多阴刻，脸谱与帽饰可辨行当。',
  ].join('\n');
  const body = sources
    .slice(0, 3)
    .map((s, i) => `[${i + 1}] ${s.chunk.title}\n${s.chunk.text.slice(0, 200)}`)
    .join('\n\n');
  return `（AI 识图暂不可用，先送你一份「皮影赏析四看」）\n\n${tips}${body ? `\n\n展馆资料摘录：\n${body}` : ''}`;
};

// ---------------------------------------------------------------------------
// AI 动态出题（结构化 JSON 输出）
// ---------------------------------------------------------------------------

const QUIZ_CATEGORIES = ['general', 'history', 'craft', 'region', 'repertoire', 'music'];

/** 组装出题消息：把结构化知识快照作为唯一事实来源，要求严格 JSON 数组 */
export const buildQuizMessages = ({ count = 5, region = '', focus = '', knowledge } = {}) => {
  const facts = [];
  for (const r of (knowledge?.regions || []).slice(0, 10)) {
    facts.push(`地区 ${r.region}·${r.school}：造型 ${r.styling}；色彩 ${r.coloring}；唱腔 ${r.singing}；代表剧目 ${r.plays}；非遗级别 ${r.heritageLevel}`);
  }
  for (const s of (knowledge?.craft || []).slice(0, 12)) {
    facts.push(`工序 ${s.stepSort}·${s.title}：${s.summary}`);
  }
  for (const h of (knowledge?.history || []).slice(0, 10)) {
    facts.push(`历史 ${h.eraName}·${h.eraTitle}（${h.timeRange}）：${h.detail}`);
  }

  const system = [
    '你是"云幕皮影"非遗数字展馆的 AI 出题官，负责依据展馆资料出皮影知识选择题。',
    '纪律：',
    '1. 只依据下方【资料】出题，不得编造资料之外的史实、数据或剧目；资料未覆盖的通识题才可适度使用公认常识；',
    '2. 每题必须恰好 4 个互不重复的选项，且只有 1 个正确答案；',
    '3. 必须输出严格的 JSON 数组，不要 markdown 代码块、不要任何多余说明；',
    `4. category 只能取：${QUIZ_CATEGORIES.join('/')}；answer 只能取 A/B/C/D；`,
    '5. 解析要说明依据，简洁中文。',
  ].join('\n');

  const schema = '[{"question":"题干","options":["选项1","选项2","选项3","选项4"],"answer":"A","explanation":"解析","category":"craft"}]';
  const user = [
    region ? `【限定地区】${region}` : '',
    focus ? `【出题方向】${focus}` : '',
    `【出题数量】${count}`,
    '',
    '【资料】',
    facts.length ? facts.join('\n') : '（暂无结构化资料，请只出皮影通识题）',
    '',
    '【输出格式】只输出 JSON 数组，形如：',
    schema,
  ].filter(Boolean).join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
};

// ---------------------------------------------------------------------------
// Agent（工具调用 / 工作流）提示词与离线整理
// ---------------------------------------------------------------------------

const AGENT_SYSTEM = [
  '你是"云幕皮影"非遗数字展馆的 AI 导览 Agent，可以调用展馆工具来完成参观者的请求。',
  '可用能力：检索资料库、读取地区流派档案、读取制作工序、读取历史时间线、列出收录地区、规划页面跳转。',
  '纪律：',
  '1. 需要事实信息时先调用相应工具，可一次调用多个；工具观测结果是你唯一可信的事实来源；',
  '2. 用户明确想"去/打开/看看某个页面或展项"时，调用 navigate_to 规划路线；',
  '3. 不得编造观测结果之外的史实、数据或剧目；',
  '4. 用亲切、简洁的中文，适当分点；与皮影非遗无关的请求礼貌拒绝并引导回展馆。',
  '5. 用户只说「规划导览路线」而未指定具体展项时，navigate_to 优先选「地图寻影」(/select)，让参观者自己选地区；不要默认去展示页。',
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
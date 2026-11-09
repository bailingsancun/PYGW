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
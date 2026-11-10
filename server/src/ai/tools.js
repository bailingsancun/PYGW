/**
 * 实现功能：Agent 工具定义、执行器与规则规划器
 * 职责：
 *   1) TOOL_DEFS：OpenAI 兼容 Function Calling 的工具 JSON Schema（工具白名单）；
 *   2) executeTool：在结构化知识 / RAG 语料上执行工具，返回 {ok,result,summary,sources?,navigate?}；
 *   3) planOffline：无 LLM（或非 chat 协议）时按意图做规则规划，保证工具链路始终可运行；
 *   4) toolLabel：给前端「思考态/工具轨迹」用的中文动作标签。
 * 说明：工具只读取已加载的知识快照与语料，不触库、无写操作；navigate_to 只允许应用内路径。
 * 接口/函数清单：
 *   - ALLOWED_PATHS / PAGE_LABEL / TOOL_DEFS
 *   - executeTool(name, args, ctx)
 *   - planOffline({question, region, page, knowledge})
 *   - toolLabel(name, args)
 */
import { retrieve } from './retrieval.js';

export const ALLOWED_PATHS = ['/select', '/display', '/process', '/interactive', '/history', '/school', '/quiz'];

export const PAGE_LABEL = {
  '/select': '地图寻影',
  '/display': '皮影展示',
  '/process': '工艺流程',
  '/interactive': '光影互动',
  '/history': '光影溯源',
  '/school': '地域流派',
  '/quiz': '知识挑战',
};

/** 带地区上下文的页面（导航时把 region 透传进去） */
const REGION_PAGES = ['/display', '/process', '/interactive', '/school'];

export const TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: '在展馆非遗资料库中检索与问题相关的材料（地区流派/制作工艺/历史），为回答提供依据。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '检索关键词或完整问题' },
          region: { type: 'string', description: '限定地区短名，如 陕西' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_region_profile',
      description: '读取某个地区皮影流派的结构化档案：流行地区、造型、色彩、唱腔、代表剧目、非遗级别。',
      parameters: {
        type: 'object',
        properties: {
          region: { type: 'string', description: '地区短名，如 陕西、河北' },
        },
        required: ['region'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_craft_process',
      description: '读取皮影制作的完整工序步骤（按顺序）。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_history_timeline',
      description: '读取皮影戏历史发展时间线（时代节点）。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_regions',
      description: '列出展馆收录的全部地区流派短名。',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate_to',
      description: '当用户想去看某个页面/展项时，规划并返回应用内跳转路线。仅在确有跳转意图时调用。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', enum: ALLOWED_PATHS, description: '目标页面路径' },
          region: { type: 'string', description: '可选地区短名，如 陕西' },
        },
        required: ['path'],
      },
    },
  },
];

const norm = (value = '') => String(value || '').trim();

/** 在知识快照里按短名匹配地区（精确优先，其次包含匹配） */
const findRegion = (knowledge, input) => {
  const query = norm(input);
  if (!query) return null;
  const regions = knowledge?.regions || [];
  const exact = regions.find((r) => r.region === query);
  if (exact) return exact;
  return regions.find((r) => r.region && (query.includes(r.region) || r.region.includes(query))) || null;
};

const executors = {
  search_knowledge({ query, region }, { chunks = [] }) {
    const sources = retrieve(chunks, { query: norm(query) || '皮影', region: norm(region), k: 4 });
    const list = sources.map(({ chunk }) => ({
      title: chunk.title,
      topic: chunk.topic,
      region: chunk.region,
      route: chunk.route,
    }));
    const snippets = sources.map(({ chunk }) => ({ title: chunk.title, text: String(chunk.text || '').slice(0, 180) }));
    return {
      ok: list.length > 0,
      result: { sources: list, snippets },
      summary: list.length ? `命中 ${list.length} 条资料：${list.map((s) => s.title).join('、')}` : '未命中资料',
      sources: list,
    };
  },

  get_region_profile({ region }, { knowledge }) {
    const hit = findRegion(knowledge, region);
    if (!hit) {
      return {
        ok: false,
        result: { found: false, region: norm(region), available: (knowledge?.regions || []).map((r) => r.region) },
        summary: `未收录「${norm(region) || '该地区'}」的流派档案`,
      };
    }
    const result = {
      found: true,
      region: hit.region,
      school: hit.school,
      popularAreas: hit.popularAreas,
      styling: hit.styling,
      coloring: hit.coloring,
      singing: hit.singing,
      plays: hit.plays,
      heritageLevel: hit.heritageLevel,
      summary: hit.summary,
    };
    return {
      ok: true,
      result,
      summary: `${hit.region}${hit.school ? ` · ${hit.school}` : ''}（造型/色彩/唱腔/剧目）`,
      sources: [{ title: hit.title, topic: '地域', region: hit.region, route: { path: '/display', query: { region: hit.region } } }],
    };
  },

  get_craft_process(_args, { knowledge }) {
    const steps = (knowledge?.craft || []).map((s) => ({ step: s.stepSort, title: s.title, summary: s.summary }));
    return {
      ok: steps.length > 0,
      result: { steps },
      summary: steps.length
        ? `共 ${steps.length} 道工序：${steps.slice(0, 5).map((s) => s.title).join(' → ')}${steps.length > 5 ? ' …' : ''}`
        : '暂无工序资料',
      sources: steps.length ? [{ title: '皮影制作工序', topic: '工艺', region: '', route: { path: '/process', query: {} } }] : [],
    };
  },

  get_history_timeline(_args, { knowledge }) {
    const nodes = (knowledge?.history || []).map((h) => ({ era: h.eraName, title: h.eraTitle, timeRange: h.timeRange }));
    return {
      ok: nodes.length > 0,
      result: { nodes },
      summary: nodes.length
        ? `共 ${nodes.length} 个时代节点：${nodes.map((n) => n.era).join(' → ')}`
        : '暂无历史资料',
      sources: nodes.length ? [{ title: '皮影历史脉络', topic: '历史', region: '', route: { path: '/history', query: {} } }] : [],
    };
  },

  list_regions(_args, { knowledge }) {
    const regions = (knowledge?.regions || []).map((r) => r.region).filter(Boolean);
    return {
      ok: regions.length > 0,
      result: { regions, count: regions.length },
      summary: regions.length ? `收录 ${regions.length} 个地区：${regions.join('、')}` : '暂无地区资料',
    };
  },

  navigate_to({ path, region }, { knowledge }) {
    const target = ALLOWED_PATHS.includes(path) ? path : '/select';
    const hit = region ? findRegion(knowledge, region) : null;
    const query = hit && REGION_PAGES.includes(target) ? { region: hit.region } : {};
    const route = { path: target, query };
    return {
      ok: true,
      result: { route },
      summary: `前往「${PAGE_LABEL[target] || target}」${hit ? ` · ${hit.region}` : ''}`,
      navigate: route,
    };
  },
};

export const executeTool = (name, args = {}, ctx = {}) => {
  const exec = executors[name];
  const safeArgs = args && typeof args === 'object' ? args : {};
  if (!exec) {
    return { name, args: safeArgs, ok: false, result: { error: `未知工具：${name}` }, summary: `未知工具：${name}` };
  }
  try {
    const output = exec(safeArgs, ctx);
    return { name, args: safeArgs, ...output };
  } catch (error) {
    return { name, args: safeArgs, ok: false, result: { error: error.message }, summary: `工具执行失败：${error.message}` };
  }
};

/** 规则规划：离线 / 非 chat 协议 / 模型未调用工具时，按意图选择工具序列 */
export const planOffline = ({ question = '', region = '', page = '', knowledge } = {}) => {
  const q = String(question || '');
  const regionInQ = findRegion(knowledge, q);
  const effectiveRegion = regionInQ?.region || region;
  const wants = {
    route: /规划|路线|导览|带我去|带我看|打开|跳转|去.{0,8}(展示|工艺|互动|地图|流派|历史|知识|答题|页面)/.test(q),
    craft: /工艺|制作|工序|怎么做|如何做|雕刻|雕镂|上色|敷彩|选皮|制皮/.test(q),
    history: /历史|起源|朝代|演变|年代|什么时候|由来/.test(q),
    list: /哪些(地区|流派|地方)|有什么地区|收录|流派(有|分布)/.test(q),
    profile: /特色|风格|造型|唱腔|色彩|代表剧目|流派|档案/.test(q),
  };

  const detectPath = () => {
    if (/互动|游戏|玩/.test(q)) return '/interactive';
    if (/工艺|制作|工序/.test(q)) return '/process';
    if (/历史|溯源|起源/.test(q)) return '/history';
    if (/流派|学校|地域/.test(q)) return '/school';
    if (/知识|答题|挑战|测验/.test(q)) return '/quiz';
    // “规划/导览/路线”没有指定具体展项时先回地图页让参观者选地区，不要默认去展示页
    if (/路线|规划|导览|地图|寻影/.test(q)) return '/select';
    return '/display';
  };

  if (wants.route) {
    const plan = [];
    if (effectiveRegion) plan.push({ name: 'get_region_profile', args: { region: effectiveRegion } });
    else plan.push({ name: 'list_regions', args: {} });
    plan.push({ name: 'navigate_to', args: { path: detectPath(), region: effectiveRegion } });
    return plan.slice(0, 4);
  }

  const plan = [];
  const askSpecific = wants.profile || wants.craft || wants.history || wants.list;
  if (effectiveRegion && (!askSpecific || wants.profile)) {
    plan.push({ name: 'get_region_profile', args: { region: effectiveRegion } });
  }
  if (wants.craft) plan.push({ name: 'get_craft_process', args: {} });
  if (wants.history) plan.push({ name: 'get_history_timeline', args: {} });
  if (wants.list || !plan.length) plan.push({ name: 'list_regions', args: {} });
  return plan.slice(0, 4);
};

const clip = (text = '', max = 24) => {
  const value = String(text);
  return value.length > max ? `${value.slice(0, max)}…` : value;
};

export const toolLabel = (name, args = {}) => {
  switch (name) {
    case 'search_knowledge':
      return `检索展馆资料「${clip(args.query || '', 16)}」`;
    case 'get_region_profile':
      return `查阅「${args.region || '地区'}」流派档案`;
    case 'get_craft_process':
      return '读取皮影制作工序';
    case 'get_history_timeline':
      return '读取皮影历史脉络';
    case 'list_regions':
      return '盘点展馆收录流派';
    case 'navigate_to':
      return `规划前往「${PAGE_LABEL[args.path] || args.path || '页面'}」`;
    default:
      return `调用工具 ${name}`;
  }
};

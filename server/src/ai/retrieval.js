/**
 * 实现功能：RAG 检索（无外部向量库依赖，支持混合召回与重排）
 * 职责：
 *   1) 查询扩展：把用户的日常说法（灯影、影子戏、乐亭影…）扩展到语料里的规范词；
 *   2) 混合召回：关键词（中文 bigram 重叠）与向量（cosine，可选）两路各自排名，
 *      用 RRF（Reciprocal Rank Fusion）融合，避免"二选一"丢掉另一路的信号；
 *   3) 启发式重排：标题命中、主题匹配、地区一致、长度惩罚；
 *   4) 地区/主题加权与阈值过滤保持原有口径。
 * 接口/函数清单：
 *   - tokenize(text)：bigram + ascii token 集合
 *   - prepareChunks(chunks)：预计算 _grams
 *   - cosine(a, b)
 *   - expandQuery(query)：同义词扩展后的查询串
 *   - retrieve(chunks, opts)：返回 [{chunk, score, base, matched, snippet}]，降序 top-k
 */

export const tokenize = (text = '') => {
  const grams = new Set();
  const normalized = String(text).toLowerCase();
  // 连续汉字/字母数字串分别处理：中文切 bigram，ascii 切整词
  const runs = normalized.match(/[一-鿿]+|[a-z0-9]+/g) || [];
  for (const run of runs) {
    if (/^[a-z0-9]+$/.test(run)) {
      grams.add(run);
      continue;
    }
    if (run.length === 1) grams.add(run);
    for (let i = 0; i < run.length - 1; i++) grams.add(run.slice(i, i + 2));
  }
  return grams;
};

/**
 * 领域同义词组：组内任一说法都能命中其余说法。
 * 只收录真实存在的流派别称与工艺术语，避免引入噪声。
 */
const SYNONYM_GROUPS = [
  ['皮影', '灯影', '影子戏', '驴皮影', '皮影戏', '影戏'],
  ['陕西', '秦腔皮影', '关中皮影', '秦地皮影'],
  ['唐山', '冀东皮影', '乐亭影', '滦州影'],
  ['四川', '川北皮影', '成都皮影', '川皮影'],
  ['山东', '泰山皮影', '济南皮影'],
  ['山西', '晋南皮影', '山西影'],
  ['辽东', '辽宁皮影', '东北皮影'],
  ['甘肃', '陇东皮影', '陇影'],
  ['唱腔', '唱调', '曲调', '声腔', '唱段'],
  ['雕刻', '镂刻', '刻制', '雕镂', '刀法'],
  ['选皮', '选料', '制皮', '皮料'],
  ['敷彩', '上色', '染色', '着色', '彩绘'],
  ['流矢', '飞箭', '箭矢', '羽箭'],
  ['砌末', '道具', '布景', '景片'],
  ['传承', '师承', '传人', '非遗'],
];

/** 查询扩展：把命中的同义词追加进查询串（用于关键词召回） */
export const expandQuery = (query = '') => {
  const q = String(query);
  const extra = [];
  for (const group of SYNONYM_GROUPS) {
    if (group.some((word) => q.includes(word))) {
      for (const word of group) if (!q.includes(word)) extra.push(word);
    }
  }
  return extra.length ? `${q} ${extra.join(' ')}` : q;
};

export const prepareChunks = (chunks) => {
  for (const chunk of chunks) {
    chunk._grams = tokenize(`${chunk.title} ${chunk.text}`);
  }
  return chunks;
};

export const cosine = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

const keywordScore = (chunk, queryGrams, gramWeight = null) => {
  if (!queryGrams.size || !chunk._grams) return 0;
  let hit = 0;
  let total = 0;
  for (const g of queryGrams) {
    const w = gramWeight ? gramWeight.get(g) || 0 : 1;
    total += w;
    if (chunk._grams.has(g)) hit += w;
  }
  return total > 0 ? hit / total : 0;
};

/**
 * 意图规则：把「怎么做 / 什么朝代 / 有什么特点」这类问法映射到语料主题。
 * 不加这层时，"皮影怎么做"会被含"皮影"字样的历史块抢走 top-1。
 */
const INTENT_RULES = [
  { topic: '工艺', words: ['怎么做', '怎么制作', '如何做', '如何制作', '制作', '工序', '步骤', '工艺', '雕刻', '镂刻', '选皮', '敷彩', '缀结', '刀法', '材料', '用什么', '什么皮', '材质'] },
  { topic: '历史', words: ['历史', '朝代', '起源', '多少年', '由来', '宋代', '唐代', '元代', '明代', '清代', '民国', '先秦', '汉代'] },
  { topic: '地域', words: ['特点', '特色', '流派', '唱腔', '造型', '色彩', '剧目', '哪里', '哪个地区', '哪个省'] },
];

/** 命中意图时返回目标主题列表 */
const detectTopics = (query = '') =>
  INTENT_RULES.filter((rule) => rule.words.some((w) => query.includes(w))).map((rule) => rule.topic);

/** RRF：把两路排名融合成一个分数（k 取 60 是常用经验值） */
const RRF_K = 60;
const rrfScore = (rank) => 1 / (RRF_K + rank);

/** 命中片段：截取第一个命中 bigram 附近的文本，供前端展示引用 */
const buildSnippet = (chunk, queryGrams, maxLen = 80) => {
  const text = String(chunk.text || '').replace(/\s+/g, ' ');
  let at = -1;
  for (const gram of queryGrams) {
    const i = text.indexOf(gram);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return text.slice(0, maxLen);
  const start = Math.max(0, at - 24);
  return (start > 0 ? '…' : '') + text.slice(start, start + maxLen) + (start + maxLen < text.length ? '…' : '');
};

/**
 * 混合检索。
 * @param {Array} chunks prepareChunks 后的语料
 * @param {{query:string, region?:string, queryVector?:number[], k?:number, rrf?:boolean}} opts
 *   rrf=false 时退回单路打分（用于对照实验）
 */
export const retrieve = (chunks, { query = '', region = '', queryVector = null, k = 4, rrf = true } = {}) => {
  if (!chunks?.length) return [];

  const expanded = expandQuery(query);
  const queryGrams = tokenize(expanded);
  const useVector = Boolean(queryVector && chunks.some((c) => Array.isArray(c.vector)));
  const intentTopics = detectTopics(query);

  /*
   * IDF 加权：像「皮影」这种几乎每块都有的词区分度极低，
   * 按文档频率给每个查询 bigram 降权，避免泛词把无关块顶上来。
   */
  const N = chunks.length;
  const df = new Map();
  for (const chunk of chunks) {
    for (const gram of queryGrams) {
      if (chunk._grams?.has(gram)) df.set(gram, (df.get(gram) || 0) + 1);
    }
  }
  const gramWeight = new Map();
  for (const gram of queryGrams) {
    const d = df.get(gram) || 0;
    gramWeight.set(gram, d > 0 ? Math.log(1 + N / d) : 0);
  }

  // 第一路：关键词（IDF 加权）
  const keywordRanked = chunks
    .map((chunk) => ({ chunk, raw: keywordScore(chunk, queryGrams, gramWeight) }))
    .sort((a, b) => b.raw - a.raw);

  // 第二路：向量（可选）
  const vectorRanked = useVector
    ? chunks
        .map((chunk) => ({ chunk, raw: Array.isArray(chunk.vector) ? cosine(queryVector, chunk.vector) : 0 }))
        .sort((a, b) => b.raw - a.raw)
    : [];

  const keywordRank = new Map(keywordRanked.map((item, i) => [item.chunk, i + 1]));
  const vectorRank = new Map(vectorRanked.map((item, i) => [item.chunk, i + 1]));
  const rawByChunk = new Map(keywordRanked.map((item) => [item.chunk, item.raw]));

  const scored = chunks.map((chunk) => {
    const kwRank = keywordRank.get(chunk);
    const vecRank = useVector ? vectorRank.get(chunk) : null;

    // 基础分：混合模式用 RRF 融合两路排名；对照模式沿用单路原始分
    let base;
    if (!rrf) {
      base = useVector && Array.isArray(chunk.vector) ? cosine(queryVector, chunk.vector) : rawByChunk.get(chunk) || 0;
    } else if (useVector && vecRank) {
      base = rrfScore(kwRank) + rrfScore(vecRank);
    } else {
      base = rrfScore(kwRank);
    }

    // 启发式重排信号
    let bonus = 0;
    const title = String(chunk.title || '');
    const topic = String(chunk.topic || '');
    // 标题命中：用户问的词直接出现在标题里，相关性通常更高
    for (const gram of queryGrams) {
      if (gram.length > 1 && title.includes(gram)) {
        bonus += 0.0006;
        break;
      }
    }
    // 主题匹配：问工艺落在工艺块、问某地落在该地区块
    if (region && chunk.region === region) bonus += 0.0012;
    else if (chunk.region && query.includes(chunk.region)) bonus += 0.0008;
    // 意图匹配：问「怎么做」就优先工艺块，问「什么朝代」就优先历史块
    if (intentTopics.length && intentTopics.includes(topic)) bonus += 0.0022;
    if (topic && queryGrams.size) {
      const topicGrams = tokenize(topic);
      for (const g of topicGrams) {
        if (queryGrams.has(g)) {
          bonus += 0.0004;
          break;
        }
      }
    }
    // 长度惩罚：超长块容易靠词频霸榜，轻微压一下
    const len = String(chunk.text || '').length;
    if (len > 400) bonus -= Math.min(0.0008, (len - 400) / 400000);

    return {
      chunk,
      score: base + bonus,
      base,
      matched: [...queryGrams].filter((g) => chunk._grams?.has(g)).slice(0, 6),
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // 阈值：混合模式下 RRF 分数尺度约 1/60~1/30，用相对阈值（头名分数的百分比）更稳
  const top = scored[0]?.score || 0;
  const cut = rrf ? top * 0.35 : useVector ? 0.2 : 0.06;

  /*
   * 命中过滤：RRF 会给每个 chunk 一个排名分（哪怕完全无关），所以必须再要求至少一条召回信号：
   *   - 字面重叠（关键词召回）；
   *   - 或向量相似度达到阈值（语义召回）。
   * 两者都无 → 视为无关，宁可不答。
   */
  const VECTOR_HIT = 0.2;
  return scored
    .filter((s) => {
      if (s.score < cut) return false;
      if (s.matched.length > 0) return true;
      if (useVector && Array.isArray(s.chunk.vector) && cosine(queryVector, s.chunk.vector) >= VECTOR_HIT) return true;
      return false;
    })
    .slice(0, k)
    .map((s) => ({
      chunk: s.chunk,
      score: Number(s.score.toFixed(4)),
      base: Number(s.base.toFixed(4)),
      matched: s.matched,
      snippet: buildSnippet(s.chunk, queryGrams),
    }));
};

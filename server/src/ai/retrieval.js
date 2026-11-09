/**
 * 实现功能：RAG 检索（无外部向量库依赖）
 * 职责：默认用中文 character-bigram 重叠做关键词检索 + 地区/主题加权；
 *       若 chunk 带向量且提供 queryVector，则改用 cosine 相似度（embedding 可选增强）。
 * 接口/函数清单：
 *   - tokenize(text)：bigram + ascii token 集合
 *   - prepareChunks(chunks)：预计算 _grams
 *   - cosine(a, b)
 *   - retrieve(chunks, opts)：返回 [{chunk, score}] 降序 top-k，低于阈值返回 []
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

const keywordScore = (chunk, queryGrams) => {
  if (!queryGrams.size || !chunk._grams) return 0;
  let hit = 0;
  for (const g of queryGrams) if (chunk._grams.has(g)) hit++;
  return hit / queryGrams.size;
};

/**
 * @param {Array} chunks prepareChunks 后的语料
 * @param {{query:string, region?:string, queryVector?:number[], k?:number}} opts
 */
export const retrieve = (chunks, { query, region = '', queryVector = null, k = 4 } = {}) => {
  const queryGrams = tokenize(query);
  const scored = chunks.map((chunk) => {
    const useVector = queryVector && Array.isArray(chunk.vector);
    let base = useVector ? cosine(queryVector, chunk.vector) : keywordScore(chunk, queryGrams);
    // 地区加权：当前地区命中或问题里提到该地区时提升相关 chunk
    if (chunk.region) {
      if (region && chunk.region === region) base += 0.3;
      else if (query.includes(chunk.region)) base += 0.2;
    }
    return { chunk, score: base, base };
  });
  scored.sort((a, b) => b.score - a.score);
  const minBase = queryVector ? 0.2 : 0.06;
  return scored.filter((s) => s.base >= minBase).slice(0, k);
};
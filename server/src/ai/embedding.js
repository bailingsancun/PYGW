/**
 * 实现功能：可选 embedding 增强（OpenAI 兼容 /embeddings）
 * 职责：配置了 AI_EMBEDDING_* 时为 chunk 与 query 生成向量（带本地哈希缓存避免重复计费）；
 *       未配置时返回 keyword 模式，检索退化为关键词+metadata（仍是 grounded RAG）。
 *       缓存文件 .ai-embeddings.cache.json 已 gitignore，不含密钥。
 * 接口/函数清单：
 *   - embeddingConfigured(config)
 *   - attachVectors(config, chunks)：'vector' | 'keyword'
 *   - embedQuery(config, text)：number[] | null
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PROJECT_ROOT } from '../env.js';

const CACHE_FILE = path.join(PROJECT_ROOT, '.ai-embeddings.cache.json');
const BATCH = 32;

export const embeddingConfigured = (config) =>
  Boolean(config.AI_EMBEDDING_BASE_URL && config.AI_EMBEDDING_MODEL);

const hashOf = (text) => crypto.createHash('sha1').update(String(text)).digest('hex');

const readCache = () => {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {
    return {};
  }
};

const writeCache = (cache) => {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {
    // 缓存写失败不影响主流程
  }
};

const callEmbeddings = async (config, input, timeoutMs = 10000) => {
  const base = String(config.AI_EMBEDDING_BASE_URL).replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (config.AI_EMBEDDING_API_KEY) headers.Authorization = `Bearer ${config.AI_EMBEDDING_API_KEY}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: config.AI_EMBEDDING_MODEL, input }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const snippet = (await response.text().catch(() => '')).slice(0, 200);
      throw new Error(`embedding HTTP ${response.status}: ${snippet}`);
    }
    const obj = await response.json();
    const list = (obj.data || []).sort((a, b) => a.index - b.index);
    return list.map((d) => d.embedding);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`embedding 请求超时（${Math.round(timeoutMs / 1000)}s）`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

/** 为 chunk 附加向量；返回检索模式。embedding 失败时回落 keyword 不阻断启动。 */
export const attachVectors = async (config, chunks) => {
  if (!embeddingConfigured(config)) return 'keyword';
  const cache = readCache();
  const missing = chunks.filter((c) => !cache[hashOf(c.text)]);
  try {
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH);
      const vectors = await callEmbeddings(config, batch.map((c) => c.text));
      batch.forEach((c, j) => {
        if (vectors[j]) cache[hashOf(c.text)] = vectors[j];
      });
    }
    writeCache(cache);
    for (const c of chunks) {
      const v = cache[hashOf(c.text)];
      if (v) c.vector = v;
    }
    return chunks.some((c) => c.vector) ? 'vector' : 'keyword';
  } catch (error) {
    console.warn(`[ai] embedding 不可用，回落关键词检索：${error.message}`);
    return 'keyword';
  }
};

export const embedQuery = async (config, text) => {
  if (!embeddingConfigured(config)) return null;
  try {
    const [vector] = await callEmbeddings(config, [text]);
    return vector || null;
  } catch {
    return null;
  }
};
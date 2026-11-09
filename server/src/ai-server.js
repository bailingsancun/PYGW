/**
 * 实现功能：AI 讲解员 / RAG 问答的独立 HTTP 服务（SSE 流式）
 * 职责：与只读 shim 分离（shim 保持 GET/SELECT 纪律）；本服务只读 MySQL 语料 + 调外部 LLM。
 *       暴露 GET /api/ai/health、POST /api/ai/ask、POST /api/ai/narrate（后两者 SSE）。
 *       未配置 LLM 或调用失败时回落 curated 静态材料，保证前端永不死端。
 * 接口/函数清单：
 *   - createAiServer(pool, config, index)：构造 http.Server
 *   - start()：加载 env、连库、建索引、监听
 */
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { loadEnv } from './env.js';
import { createDb, pingDb } from './db.js';
import { ok, fail } from './envelope.js';
import { loadCorpus } from './ai/corpus.js';
import { loadKnowledge, EMPTY_KNOWLEDGE } from './ai/knowledge.js';
import { TOOL_DEFS } from './ai/tools.js';
import { runAgent } from './ai/agent.js';
import { prepareChunks, retrieve } from './ai/retrieval.js';
import { attachVectors, embedQuery } from './ai/embedding.js';
import { buildMessages, narrateQuestion, fallbackAnswer } from './ai/prompt.js';
import { streamCompletion } from './ai/provider.js';

const API_PREFIX = '/api/ai';
const MAX_BODY = 16 * 1024;
const MAX_QUESTION = 500;

const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0;
  const parts = [];
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) {
      reject(new Error('请求体过大'));
      req.destroy();
      return;
    }
    parts.push(chunk);
  });
  req.on('end', () => {
    try {
      resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {});
    } catch {
      reject(new Error('请求体不是合法 JSON'));
    }
  });
  req.on('error', reject);
});

const corsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

const sendJson = (res, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders() });
  res.end(body);
};

const sseOpen = (res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    ...corsHeaders(),
  });
  res.write('retry: 3000\n\n');
};

const sseSend = (res, event, data) => {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

const publicSources = (sources) => sources.map(({ chunk }) => ({
  title: chunk.title,
  topic: chunk.topic,
  region: chunk.region,
  route: chunk.route,
}));

export const createAiServer = (pool, config, index) => {
  const { chunks, mode } = index;
  const knowledge = index.knowledge || EMPTY_KNOWLEDGE;
  const configured = Boolean(config.AI_BASE_URL && config.AI_API_KEY && config.AI_MODEL);

  const handleStream = async (req, res, { question, region, page }) => {
    sseOpen(res);
    const queryVector = mode === 'vector' ? await embedQuery(config, question) : null;
    const sources = retrieve(chunks, { query: question, region, queryVector, k: 4 });
    sseSend(res, 'sources', publicSources(sources));

    const emitFallback = () => {
      sseSend(res, 'delta', { text: fallbackAnswer(sources) });
      sseSend(res, 'done', { fallback: true, retrieval: mode });
      res.end();
    };

    if (!configured) {
      emitFallback();
      return;
    }
    try {
      const messages = buildMessages({ question, region, page, sources });
      const full = await streamCompletion(config, messages, (text) => sseSend(res, 'delta', { text }));
      if (!full || !full.trim()) {
        emitFallback();
        return;
      }
      sseSend(res, 'done', { fallback: false, retrieval: mode });
      res.end();
    } catch (error) {
      console.error(`[ai] 生成失败，回落静态材料：${error.message}`);
      emitFallback();
    }
  };

  return http.createServer(async (req, res) => {
    const method = String(req.method || 'GET').toUpperCase();
    let url;
    try {
      url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    } catch {
      sendJson(res, fail('非法的请求地址', 400));
      return;
    }
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const rest = pathname.startsWith(API_PREFIX) ? pathname.slice(API_PREFIX.length) : null;

    if (method === 'OPTIONS') {
      res.writeHead(200, corsHeaders());
      res.end();
      return;
    }
    if (rest === null) {
      sendJson(res, fail('未知路径，AI 服务只提供 /api/ai/*', 404));
      return;
    }

    if (rest === '/health' && method === 'GET') {
      sendJson(res, ok({
        configured,
        format: config.AI_FORMAT,
        model: config.AI_MODEL,
        retrieval: mode,
        chunks: chunks.length,
        agent: true,
        tools: TOOL_DEFS.length,
      }));
      return;
    }

    if ((rest === '/ask' || rest === '/narrate') && method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch (error) {
        sendJson(res, fail(error.message, 400));
        return;
      }
      const region = String(body.region || '').slice(0, 40);
      const page = String(body.page || '').slice(0, 40);
      let question;
      if (rest === '/narrate') {
        question = narrateQuestion({ region, page });
      } else {
        question = String(body.question || '').trim().slice(0, MAX_QUESTION);
        if (!question) {
          sendJson(res, fail('question 不能为空', 400));
          return;
        }
      }
      await handleStream(req, res, { question, region, page });
      return;
    }

    if (rest === '/agent' && method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch (error) {
        sendJson(res, fail(error.message, 400));
        return;
      }
      const region = String(body.region || '').slice(0, 40);
      const page = String(body.page || '').slice(0, 40);
      let question = String(body.question || '').trim().slice(0, MAX_QUESTION);
      if (!question && body.mode === 'narrate') question = narrateQuestion({ region, page });
      if (!question) {
        sendJson(res, fail('question 不能为空', 400));
        return;
      }

      sseOpen(res);
      let aborted = false;
      res.on('close', () => { aborted = true; });
      try {
        await runAgent(config, {
          question,
          region,
          page,
          chunks,
          knowledge,
          onEvent: (event, data) => sseSend(res, event, data),
          shouldStop: () => aborted || res.writableEnded,
        });
      } catch (error) {
        console.error(`[ai] agent 失败：${error.message}`);
        sseSend(res, 'error', { message: error.message });
      }
      if (!res.writableEnded) res.end();
      return;
    }

    sendJson(res, fail(`未知端点或方法：${method} ${rest}`, 404));
  });
};

const start = async () => {
  let config;
  try {
    config = loadEnv();
  } catch (error) {
    console.error(`[ai] 启动失败：${error.message}`);
    process.exitCode = 1;
    return;
  }
  const pool = createDb(config);
  try {
    await pingDb(pool);
  } catch (error) {
    console.error(`[ai] 连库失败：${error.message}`);
    await pool.end().catch(() => {});
    process.exitCode = 1;
    return;
  }

  let index;
  try {
    const chunks = prepareChunks(await loadCorpus(pool));
    const knowledge = await loadKnowledge(pool);
    const mode = await attachVectors(config, chunks);
    index = { chunks, mode, knowledge };
    console.log(
      `[ai] 语料 ${chunks.length} chunk，检索模式 ${mode}；知识快照 regions=${knowledge.regions.length} craft=${knowledge.craft.length} history=${knowledge.history.length}`,
    );
  } catch (error) {
    console.error(`[ai] 建索引失败：${error.message}`);
    await pool.end().catch(() => {});
    process.exitCode = 1;
    return;
  }

  const configured = Boolean(config.AI_BASE_URL && config.AI_API_KEY && config.AI_MODEL);
  console.log(`[ai] LLM ${configured ? `已配置（${config.AI_FORMAT}/${config.AI_MODEL}）` : '未配置，问答将回落静态材料'}`);

  const server = createAiServer(pool, config, index);
  server.listen(config.AI_PORT, config.AI_HOST, () => {
    console.log(`[ai] 监听 http://${config.AI_HOST}:${config.AI_PORT}${API_PREFIX}`);
  });

  const shutdown = (signal) => {
    console.log(`[ai] 收到 ${signal}，正在关闭…`);
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

// 仅在作为主模块直接运行时启动；被 import（如离线自检）时只暴露 createAiServer。
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) start();
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
import { TOOL_DEFS, ALLOWED_PATHS } from './ai/tools.js';
import { runAgent } from './ai/agent.js';
import { prepareChunks, retrieve } from './ai/retrieval.js';
import { attachVectors, embedQuery } from './ai/embedding.js';
import { buildMessages, narrateQuestion, fallbackAnswer, buildVisionMessages, fallbackVisionAnswer, buildQuizMessages } from './ai/prompt.js';
import { checkInput, screenOutput, createStreamScreen, SAFETY } from './ai/moderation.js';
import { parseQuiz, fallbackQuiz } from './ai/quiz.js';
import { streamCompletion } from './ai/provider.js';

const API_PREFIX = '/api/ai';
const MAX_BODY = 16 * 1024;
const MAX_VISION_BODY = 6 * 1024 * 1024;
const MAX_IMAGE_CHARS = 4 * 1024 * 1024;
// 与 moderation.checkInput 的超长阈值一致：先复核原文再截断，超长输入走礼貌拒绝而不是静默截断
const MAX_QUESTION = 800;

const readBody = (req, maxBytes = MAX_BODY) => new Promise((resolve, reject) => {
  let size = 0;
  let overflow = false;
  const parts = [];
  req.on('data', (chunk) => {
    // 超限后只 drain 不再缓冲：连接保持到 end，调用方才能把 413 响应真正写回客户端
    if (overflow) return;
    size += chunk.length;
    if (size > maxBytes) {
      overflow = true;
      parts.length = 0;
      return;
    }
    parts.push(chunk);
  });
  req.on('end', () => {
    if (overflow) {
      reject(new Error('请求体过大'));
      return;
    }
    try {
      resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {});
    } catch {
      reject(new Error('请求体不是合法 JSON'));
    }
  });
  req.on('error', reject);
});

const bodyFail = (res, error) => sendJson(res, fail(error.message, error.message === '请求体过大' ? 413 : 400));

const sendJson = (res, payload) => {
  if (res.writableEnded || res.destroyed) return;
  const body = JSON.stringify(payload);
  // 业务错误（code>=400）用真实 HTTP 状态返回，避免前端把 JSON 当成 SSE 解析
  const status = Number(payload?.code) >= 400 ? Number(payload.code) : 200;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
};

const sseOpen = (res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
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

  // CORS：默认不放行任何跨源（同源部署/Vite 代理都不需要 CORS），需要时用 AI_ALLOWED_ORIGINS 显式列白名单
  const allowedOrigins = String(config.AI_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const applyCors = (req, res) => {
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins.includes(origin)) return;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  };

  // 按客户端 IP 的固定窗口限流，只作用于会消耗 LLM 额度的 POST 端点
  const rawRate = config.AI_RATE_LIMIT;
  const rateMax = rawRate === undefined || rawRate === '' ? 20 : Math.max(0, Number(rawRate) || 0);
  const RATE_WINDOW_MS = 60 * 1000;
  const RATE_LIMITED_PATHS = new Set(['/ask', '/narrate', '/agent', '/vision', '/quiz']);
  const buckets = new Map();
  const MAX_BUCKETS = 10000;
  // 默认不信任 X-Forwarded-For：直连时客户端可伪造该头轮换 IP 绕过限流；
  // 仅当显式配置 AI_TRUST_PROXY=1（部署在可信反代后，如本工程 static-server）才取 XFF 首段
  const trustProxy = config.AI_TRUST_PROXY === '1';
  const clientIp = (req) => {
    if (trustProxy) {
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (forwarded) return forwarded;
    }
    return req.socket.remoteAddress || 'unknown';
  };
  const allowRequest = (req) => {
    if (!rateMax) return true;
    const ip = clientIp(req);
    const now = Date.now();
    if (buckets.size > 5000) {
      for (const [key, bucket] of buckets) if (now >= bucket.resetAt) buckets.delete(key);
    }
    if (buckets.size >= MAX_BUCKETS) {
      // 表满且都未过期：淘汰最早的窗口，防止轮换 IP 把内存打满
      let excess = buckets.size - MAX_BUCKETS + 1;
      for (const key of buckets.keys()) {
        if (excess <= 0) break;
        buckets.delete(key);
        excess -= 1;
      }
    }
    const bucket = buckets.get(ip);
    if (!bucket || now >= bucket.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= rateMax;
  };

  // 全局每日额度熔断：每 IP 限流只防单点滥用，分布式慢速请求仍可能耗尽当日 LLM 配额；
  // 按服务器本地日期计数，跨天自动归零（0=关闭）
  const rawDaily = config.AI_GLOBAL_DAILY_LIMIT;
  const dailyMax = rawDaily === undefined || rawDaily === '' ? 1000 : Math.max(0, Number(rawDaily) || 0);
  let dailyKey = '';
  let dailyCount = 0;
  const allowDaily = () => {
    if (!dailyMax) return true;
    const now = new Date();
    const key = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    if (key !== dailyKey) {
      dailyKey = key;
      dailyCount = 0;
    }
    dailyCount += 1;
    return dailyCount <= dailyMax;
  };

  // region/page 白名单：页面只允许应用内路由，地区只允许语料/知识快照收录的名称，
  // 注入文本与站外地址在进入 prompt 前即被丢弃（checkInput 先过滤红线）
  const knownRegions = new Set();
  for (const r of knowledge.regions || []) if (r.region) knownRegions.add(r.region);
  for (const c of chunks) if (c.region) knownRegions.add(c.region);
  // 行政区划后缀：剥离后按短名精确命中（长后缀优先，避免「壮族自治区」被「自治区」截断）
  const REGION_SUFFIX = /(壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区|省|市)$/;
  const sanitizeRegion = (raw) => {
    const value = String(raw || '').trim().slice(0, 40);
    if (!value || !checkInput(value).ok) return '';
    if (!knownRegions.size) return value;
    // 精确匹配（含语料收录的全名）；否则剥后缀取短名再精确匹配。
    // 不再做子串包含匹配：避免「陕西…任意文本」借道已知地区混入 prompt
    if (knownRegions.has(value)) return value;
    const short = value.replace(REGION_SUFFIX, '');
    return knownRegions.has(short) ? short : '';
  };
  const sanitizeContext = (body) => {
    const page = String(body.page || '');
    return {
      region: sanitizeRegion(body.region),
      page: ALLOWED_PATHS.includes(page) ? page : '',
    };
  };

  // 命中安全红线的统一 SSE 出口：safety 事件 + 礼貌话术 + done(filtered)，与正常流同构
  const emitBlocked = (res, m, extra = {}) => {
    sseOpen(res);
    sseSend(res, 'safety', { stage: 'input', category: m.category, message: m.reason });
    sseSend(res, 'delta', { text: m.reply });
    sseSend(res, 'done', { filtered: true, fallback: true, ...extra });
    res.end();
  };

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
      // 增量复核：安全前缀即时下发，红线组合在拼成前被回留拦截；结束时再做全文复核兜底
      const gate = createStreamScreen((text) => sseSend(res, 'delta', { text }));
      const full = await streamCompletion(config, messages, (text) => gate.push(text));
      if (!full || !full.trim()) {
        emitFallback();
        return;
      }
      if (gate.blocked || !screenOutput(full).ok) {
        sseSend(res, 'safety', { stage: 'output', message: SAFETY.output });
        sseSend(res, 'done', { fallback: false, filtered: true, retrieval: mode });
        res.end();
        return;
      }
      gate.flush();
      sseSend(res, 'done', { fallback: false, retrieval: mode });
      res.end();
    } catch (error) {
      console.error(`[ai] 生成失败，回落静态材料：${error.message}`);
      emitFallback();
    }
  };

  return http.createServer(async (req, res) => {
    applyCors(req, res);
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
      res.writeHead(200);
      res.end();
      return;
    }
    if (rest === null) {
      sendJson(res, fail('未知路径，AI 服务只提供 /api/ai/*', 404));
      return;
    }
    if (RATE_LIMITED_PATHS.has(rest) && method === 'POST') {
      if (!allowRequest(req)) {
        sendJson(res, fail('请求过于频繁，请稍后再试', 429));
        return;
      }
      if (!allowDaily()) {
        sendJson(res, fail('今日 AI 额度已用完，请明天再试', 429));
        return;
      }
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
        vision: true,
        moderation: true,
        quiz: true,
      }));
      return;
    }

    if ((rest === '/ask' || rest === '/narrate') && method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch (error) {
        bodyFail(res, error);
        return;
      }
      const { region, page } = sanitizeContext(body);
      let question;
      if (rest === '/narrate') {
        question = narrateQuestion({ region, page });
      } else {
        question = String(body.question || '').trim();
        if (!question) {
          sendJson(res, fail('question 不能为空', 400));
          return;
        }
      }
      const moderated = checkInput(question);
      if (!moderated.ok) {
        emitBlocked(res, moderated);
        return;
      }
      question = question.slice(0, MAX_QUESTION);
      await handleStream(req, res, { question, region, page });
      return;
    }

    if (rest === '/agent' && method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch (error) {
        bodyFail(res, error);
        return;
      }
      const { region, page } = sanitizeContext(body);
      let question = String(body.question || '').trim();
      if (!question && body.mode === 'narrate') question = narrateQuestion({ region, page });
      if (!question) {
        sendJson(res, fail('question 不能为空', 400));
        return;
      }
      const moderated = checkInput(question);
      if (!moderated.ok) {
        emitBlocked(res, moderated);
        return;
      }
      question = question.slice(0, MAX_QUESTION);

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
        // 上游细节只留服务端日志，前端只得到通用提示
        console.error(`[ai] agent 失败：${error.message}`);
        sseSend(res, 'error', { message: 'AI 导览暂时不可用，请稍后再试' });
      }
      if (!res.writableEnded) res.end();
      return;
    }

    if (rest === '/vision' && method === 'POST') {
      let body;
      try {
        body = await readBody(req, MAX_VISION_BODY);
      } catch (error) {
        bodyFail(res, error);
        return;
      }
      const image = String(body.image || '');
      const { region, page } = sanitizeContext(body);
      const question = String(body.question || '').trim();
      if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(image) || image.length > MAX_IMAGE_CHARS) {
        sendJson(res, fail('请上传 PNG/JPG/WebP 图片（建议 ≤3MB）', 400));
        return;
      }
      const moderated = checkInput(question);
      if (!moderated.ok) {
        emitBlocked(res, moderated, { modality: 'vision' });
        return;
      }

      sseOpen(res);
      const sources = retrieve(chunks, { query: question || region || '皮影', region, k: 4 });
      sseSend(res, 'sources', publicSources(sources));

      const visionReady = configured && config.AI_FORMAT === 'chat';
      const emitVisionFallback = () => {
        sseSend(res, 'delta', { text: fallbackVisionAnswer(sources) });
        sseSend(res, 'done', { fallback: true, modality: 'vision', configured: visionReady });
        res.end();
      };

      // 识图需要视觉模型（OpenAI 兼容 chat 协议的多模态 content）；否则直接走赏析兜底
      if (!visionReady) {
        emitVisionFallback();
        return;
      }
      try {
        const messages = buildVisionMessages({ question, region, page, sources, imageDataUrl: image });
        const gate = createStreamScreen((text) => sseSend(res, 'delta', { text }));
        const full = await streamCompletion(config, messages, (text) => gate.push(text), {
          maxTokens: 800,
          timeoutMs: 45000,
        });
        if (!full || !full.trim()) {
          emitVisionFallback();
          return;
        }
        if (gate.blocked || !screenOutput(full).ok) {
          sseSend(res, 'safety', { stage: 'output', message: SAFETY.output });
          sseSend(res, 'done', { fallback: false, filtered: true, modality: 'vision', configured: true });
          res.end();
          return;
        }
        gate.flush();
        sseSend(res, 'done', { fallback: false, modality: 'vision', configured: true });
        res.end();
      } catch (error) {
        console.error(`[ai] 识图失败，回落赏析兜底：${error.message}`);
        emitVisionFallback();
      }
      return;
    }

    if (rest === '/quiz' && method === 'POST') {
      let body;
      try {
        body = await readBody(req);
      } catch (error) {
        bodyFail(res, error);
        return;
      }
      const count = Math.min(8, Math.max(1, Number.parseInt(String(body.count ?? ''), 10) || 5));
      const { region } = sanitizeContext(body);
      const focus = String(body.focus || '').trim().slice(0, 40);
      const moderated = checkInput(focus);
      if (!moderated.ok) {
        sendJson(res, fail(moderated.reply, 400));
        return;
      }

      // 已配置 LLM：生成 → 输出安全复核 → 严格 JSON 校验（任一步失败都回落 curated）
      if (configured) {
        try {
          const messages = buildQuizMessages({ count, region, focus, knowledge });
          const full = await streamCompletion(config, messages, () => {}, { maxTokens: 2000, timeoutMs: 30000 });
          if (!full || !full.trim()) throw new Error('模型未返回内容');
          if (!screenOutput(full).ok) throw new Error('输出未通过安全复核');
          const questions = parseQuiz(full, count);
          if (!questions.length) throw new Error('出题结果无法解析');
          sendJson(res, ok({ mode: 'ai', configured: true, region, questions }));
          return;
        } catch (error) {
          console.error(`[ai] 出题失败，回落 curated 种子题：${error.message}`);
        }
      }

      sendJson(res, ok({ mode: 'curated', configured, region, fallback: true, questions: fallbackQuiz(count) }));
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
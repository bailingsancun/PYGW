/**
 * 实现功能：Cloud-Shadow legacy v1 只读 shim 的 HTTP 入口
 * 职责：为路线 B 的复刻前端提供 7 个 v1 端点（HANDOFF §5），始终返回 200 + v1 envelope，
 *       业务失败用 code 表达而不是 HTTP 状态码（前端 unwrapResponse 依赖这一点）。
 *       同时提供 /healthz 与可选的 CORS（开发期直连调试用）。
 * 接口/函数清单：
 *   - ROUTES：路径 → 处理函数表
 *   - createServer(pool, config)：构造 http.Server
 *   - start()：加载 env、连库、监听
 */
import http from 'node:http';
import { loadEnv } from './env.js';
import { createDb, pingDb } from './db.js';
import { ok, fail } from './envelope.js';
import {
  assetsCommon,
  dailyRandom,
  quizRandom,
  craftSteps,
  historyTimeline,
  regionByName,
  interactiveRandom,
  DEFAULT_QUIZ_LIMIT,
  DEFAULT_PUPPET_LIMIT,
  normalizeLimit,
} from './endpoints.js';

const API_PREFIX = '/api/v1';

const ROUTES = [
  { path: '/assets/common', handler: (pool) => assetsCommon(pool) },
  { path: '/daily-appreciations/random', handler: (pool, params) => dailyRandom(pool, params.get('region')) },
  {
    path: '/quiz/questions/random',
    handler: (pool, params) => quizRandom(pool, normalizeLimit(params.get('limit'), DEFAULT_QUIZ_LIMIT)),
  },
  { path: '/craft-process/steps', handler: (pool) => craftSteps(pool) },
  { path: '/history/timeline', handler: (pool) => historyTimeline(pool) },
  { path: '/regions/by-name', handler: (pool, params) => regionByName(pool, params.get('name')) },
  {
    path: '/interactive-materials/random',
    handler: (pool, params) => interactiveRandom(pool, normalizeLimit(params.get('limit'), DEFAULT_PUPPET_LIMIT)),
  },
];

const sendJson = (res, payload, status = 200, withCors = true) => {
  const body = JSON.stringify(payload);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  };
  if (withCors) {
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  res.writeHead(status, headers);
  res.end(body);
};

export const createServer = (pool, config) => {
  const withCors = config.SHIM_CORS === '1';

  const server = http.createServer(async (req, res) => {
    const startedAt = Date.now();
    const method = String(req.method || 'GET').toUpperCase();

    let url;
    try {
      url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    } catch {
      sendJson(res, fail('非法的请求地址', 400), 200, withCors);
      return;
    }

    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    const params = url.searchParams;

    const log = (code) => {
      const ms = Date.now() - startedAt;
      console.log(`[shim] ${method} ${url.pathname}${url.search} -> ${code} (${ms}ms)`);
    };

    if (method === 'OPTIONS' && withCors) {
      sendJson(res, ok(null), 200, withCors);
      log('preflight');
      return;
    }

    if (method !== 'GET') {
      sendJson(res, fail('shim 只支持 GET', 405), 200, withCors);
      log(405);
      return;
    }

    if (pathname === '/healthz' || pathname === `${API_PREFIX}/healthz`) {
      try {
        const healthy = await pingDb(pool);
        sendJson(res, healthy ? ok({ status: 'ok', db: config.DB_NAME }) : fail('数据库不可用', 500), 200, withCors);
        log(healthy ? 200 : 500);
      } catch (error) {
        sendJson(res, fail(error.message, 500), 200, withCors);
        log(500);
      }
      return;
    }

    const rest = pathname.startsWith(API_PREFIX) ? pathname.slice(API_PREFIX.length) : null;
    if (rest === null) {
      sendJson(res, fail('未知路径，shim 只提供 /api/v1/*', 404), 200, withCors);
      log(404);
      return;
    }

    const route = ROUTES.find((item) => item.path === rest);
    if (!route) {
      sendJson(res, fail(`未知端点：${rest}`, 404), 200, withCors);
      log(404);
      return;
    }

    try {
      const data = await route.handler(pool, params);
      sendJson(res, ok(data), 200, withCors);
      log(200);
    } catch (error) {
      // 业务失败也走 HTTP 200，靠 code 让前端进错误分支
      console.error(`[shim] ${rest} 失败：`, error?.message || error);
      sendJson(res, fail(error?.message || '服务异常', 500), 200, withCors);
      log(500);
    }
  });

  server.keepAliveTimeout = 5000;
  return server;
};

const start = async () => {
  let config;
  try {
    config = loadEnv();
  } catch (error) {
    console.error(`[shim] 启动失败：${error.message}`);
    process.exitCode = 1;
    return;
  }

  const pool = createDb(config);

  try {
    await pingDb(pool);
    console.log(`[shim] 已连接 ${config.DB_HOST}:${config.DB_PORT}/${config.DB_NAME}（用户 ${config.DB_USER}，只读 SELECT）`);
  } catch (error) {
    console.error(`[shim] 连库失败：${error.message}`);
    await pool.end().catch(() => {});
    process.exitCode = 1;
    return;
  }

  const server = createServer(pool, config);
  server.listen(config.SHIM_PORT, config.SHIM_HOST, () => {
    console.log(`[shim] 监听 http://${config.SHIM_HOST}:${config.SHIM_PORT}${API_PREFIX}`);
  });

  const shutdown = async (signal) => {
    console.log(`[shim] 收到 ${signal}，正在关闭…`);
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start();

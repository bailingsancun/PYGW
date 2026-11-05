/**
 * 实现功能：生产期同源静态服务器（HANDOFF §4 的「静态服务器 + 反代」）
 * 职责：一个端口同时提供
 *         /            → dist/ 静态产物（SPA，未命中回落到 index.html）
 *         /api/v1/*    → 反向代理到只读 shim（127.0.0.1:SHIM_PORT）
 *         /images/**   → 源工程素材目录（只读映射，不复制 604 MB）
 *       于是浏览器侧零 CORS、零跨域，与源工程单源部署一致。
 * 用法：node server/static-server.js   （需先启动 shim：npm run shim）
 *       STATIC_PORT=8080 node server/static-server.js
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, PROJECT_ROOT } from './src/env.js';
import { resolveAssetFile } from './src/assets.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(PROJECT_ROOT, 'dist');
const PORT = Number(process.env.STATIC_PORT || '8080');
const HOST = process.env.STATIC_HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

const sendFile = (res, filePath, status = 200) => {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.writeHead(status, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      // 带 hash 的产物长期缓存，index.html 不缓存
      'Cache-Control': /index\.html$/.test(filePath)
        ? 'no-cache'
        : 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(filePath).pipe(res);
  });
};

/** 把 /api 请求原样转发给 shim（保持同源观感） */
const proxyApi = (req, res, shimPort) => {
  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: shimPort,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${shimPort}` },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', (error) => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: `shim 不可用：${error.message}`, data: null }));
  });
  req.pipe(upstream);
};

const main = () => {
  if (!fs.existsSync(DIST)) {
    console.error(`找不到构建产物：${DIST}\n请先执行 npm run build`);
    process.exitCode = 1;
    return;
  }

  let config;
  try {
    // 静态服务器不需要数据库口令，只要 SHIM_PORT / ASSET_ROOT
    config = loadEnv({ requireDb: false });
  } catch (error) {
    console.error(`[static] 配置读取失败：${error.message}`);
    process.exitCode = 1;
    return;
  }

  const assetRoot = process.env.ASSET_ROOT || config.ASSET_ROOT || '';

  const server = http.createServer((req, res) => {
    const rawPath = (req.url || '/').split('?')[0];
    let pathname;
    try {
      pathname = decodeURIComponent(rawPath);
    } catch {
      pathname = rawPath;
    }

    if (pathname.startsWith('/api/')) {
      proxyApi(req, res, config.SHIM_PORT);
      return;
    }

    if (pathname.startsWith('/images/') && assetRoot) {
      const resolved = resolveAssetFile(assetRoot, pathname.slice('/images'.length));
      if (!resolved) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      sendFile(res, resolved);
      return;
    }

    const filePath = path.resolve(path.join(DIST, pathname));
    if (!filePath.startsWith(path.resolve(DIST))) {
      res.statusCode = 403;
      res.end('forbidden');
      return;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath);
      return;
    }
    // SPA 兜底
    sendFile(res, path.join(DIST, 'index.html'), 200);
  });

  server.listen(PORT, HOST, () => {
    console.log(`[static] 监听 http://${HOST}:${PORT}`);
    console.log(`[static] /api → 127.0.0.1:${config.SHIM_PORT}（shim 需先启动）`);
    console.log(`[static] /images → ${assetRoot || '（未配置 ASSET_ROOT，跳过）'}`);
  });
};

main();

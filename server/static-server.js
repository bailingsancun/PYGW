/**
 * 实现功能：生产期同源静态服务器（HANDOFF §4 的「静态服务器 + 反代」）
 * 职责：一个端口同时提供
 *         /            → dist/ 静态产物（SPA，未命中回落到 index.html）
 *         /api/v1/*    → 反向代理到只读 shim（127.0.0.1:SHIM_PORT）
 *         /images/**   → 工程内 assets/images（自包含；也可用 ASSET_ROOT 指向外部目录）
 *       于是浏览器侧零 CORS、零跨域，与源工程单源部署一致。
 * 用法：node server/static-server.js   （需先启动 shim：npm run shim）
 *       STATIC_PORT=8080 node server/static-server.js
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv, PROJECT_ROOT } from './src/env.js';
import { resolveAssetFile, resolveAssetRoot } from './src/assets.js';

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

// 安全响应头：对所有响应（含 /api 反代与 404）生效。
// CSP 放行 data:/blob: 图片（识图预览用 DataURL/ObjectURL）与内联样式（Vue style 绑定）；
// microphone=(self) 保留语音输入的浏览器原生能力。
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(self), geolocation=(), microphone=(self)',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
  ].join('; '),
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
      headers: {
        ...req.headers,
        host: `127.0.0.1:${shimPort}`,
        // 透传真实客户端 IP，供 AI 服务按来源限流（否则反代后都显示 127.0.0.1）
        'x-forwarded-for': req.socket.remoteAddress || '',
      },
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    },
  );
  upstream.on('error', (error) => {
    // 上游细节（端口/地址）只留日志，浏览器只得到通用提示
    console.error(`[static] 反代失败：${error.message}`);
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ code: 500, message: '后端服务暂不可用，请稍后再试', data: null }));
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

  // 与 vite / check-assets 共用同一套解析：工程内 assets/images 优先，其次 ASSET_ROOT
  const assetRoot = resolveAssetRoot(PROJECT_ROOT, process.env.ASSET_ROOT || config.ASSET_ROOT);

  const server = http.createServer((req, res) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
    const rawPath = (req.url || '/').split('?')[0];
    let pathname;
    try {
      pathname = decodeURIComponent(rawPath);
    } catch {
      pathname = rawPath;
    }

    if (pathname.startsWith('/api/ai/')) {
      proxyApi(req, res, config.AI_PORT);
      return;
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

    const distRoot = path.resolve(DIST);
    const filePath = path.resolve(path.join(DIST, pathname));
    // 必须按目录边界判断：startsWith(dist) 会把 dist-evil 等相邻目录也放行
    if (filePath !== distRoot && !filePath.startsWith(distRoot + path.sep)) {
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
    console.log(`[static] /api/ai → 127.0.0.1:${config.AI_PORT}（AI 服务需先启动：npm run ai）`);
    console.log(`[static] /images → ${assetRoot || '（未配置 ASSET_ROOT，跳过）'}`);
  });
};

main();

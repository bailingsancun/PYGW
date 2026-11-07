/**
 * 实现功能：Vite 构建与开发服务器配置
 * 职责：
 *   1) rpx 单位转换（uni-app 私有单位 → 桌面/移动自适应的 CSS 变量）
 *   2) 双 proxy：/api → shim（8787），/images → 源工程素材目录（只读挂载，不复制 604MB）
 *   3) 开发期强制 HTTP（HANDOFF §7.2：不要启用 https）
 */
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAssetFile } from './server/src/assets.js';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * rpx → calc(N * var(--rpx))
 * 源码里保留 `34rpx` 的可读写法，构建期统一换算；
 * --rpx 的取值见 src/styles/base.css（移动端 100vw/750，桌面封顶，保证两种视口都不破版）。
 */
const rpxToVar = () => ({
  postcssPlugin: 'dsh-rpx-to-var',
  Declaration(decl) {
    if (!decl.value || !decl.value.includes('rpx')) return;
    decl.value = decl.value.replace(/(?<![\w.-])(-?\d*\.?\d+)rpx\b/g, (_, raw) => {
      const value = Number(raw);
      if (!Number.isFinite(value)) return `${raw}rpx`;
      if (value === 0) return '0px';
      return `calc(${value} * var(--rpx))`;
    });
  },
});
rpxToVar.postcss = true;

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
};

/**
 * 把 /images/* 直接映射到源工程素材目录（HANDOFF §2-2：用挂载而不是复制）。
 * 文件名含空格、括号、大写扩展名，且 DB 与磁盘存在空白差异（如 `hnpy(1).png` vs `hnpy (1).png`），
 * 一律交给 resolveAssetFile 解析真实文件名。
 */
const staticImages = (assetRoot) => {
  /** 素材目录缺失时必须显式告警：否则 /images 全部回落 SPA，页面静默无图 */
  const warnIfMissing = () => {
    if (assetRoot && fs.existsSync(assetRoot)) return;
    console.warn(
      [
        '',
        '[素材] 警告：素材目录不存在或未配置',
        `       当前 ASSET_ROOT：${assetRoot || '(空)'}`,
        '       后果：/images/** 的请求会回落到 SPA 的 index.html，页面将看不到任何图片。',
        '       处理：把素材放到工程内的 assets/images（可用 scripts/extract-assets.ps1',
        '             从源工程 zip 一键抽取），或在该 .env 里用 ASSET_ROOT 覆盖。',
        '',
      ].join('\n'),
    );
  };

  const mount = (middlewares) => {
    middlewares.use('/images', (req, res, next) => {
      if (!assetRoot || !fs.existsSync(assetRoot)) {
        next();
        return;
      }
      const rawPath = (req.url || '').split('?')[0];
      let decoded;
      try {
        decoded = decodeURIComponent(rawPath);
      } catch {
        decoded = rawPath;
      }
      const resolved = resolveAssetFile(assetRoot, decoded);
      if (process.env.DSH_IMAGES_DEBUG === '1') {
        console.log(`[images] ${rawPath} → ${resolved || 'MISS'}`);
      }
      if (!resolved) {
        next();
        return;
      }
      const ext = path.extname(resolved).toLowerCase();
      const stat = fs.statSync(resolved);
      res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      fs.createReadStream(resolved).pipe(res);
    });
  };

  return {
    name: 'dsh-static-images',
    configureServer(server) {
      warnIfMissing();
      mount(server.middlewares);
    },
    configurePreviewServer(server) {
      warnIfMissing();
      mount(server.middlewares);
    },
  };
};

export default defineConfig(({ mode }) => {
  // 第三个参数传 '' 才能读到非 VITE_ 前缀的服务端变量（ASSET_ROOT / SHIM_PORT）
  const env = loadEnv(mode, rootDir, '');
  const shimPort = env.SHIM_PORT || '8787';
  const webPort = Number(env.WEB_PORT || '5173');
  /*
   * 素材解析优先级：
   *   1) 工程内 assets/images 存在 → 直接用它（自包含，不依赖任何外部目录）
   *   2) 否则用 .env 里的 ASSET_ROOT（组员把素材放在别处时用）
   *   3) 都没有 → 仍指向工程内路径，由 warnIfMissing 打印明确告警
   */
  const inProjectAssets = path.resolve(rootDir, 'assets', 'images');
  const assetRoot = fs.existsSync(inProjectAssets)
    ? inProjectAssets
    : (env.ASSET_ROOT || inProjectAssets);

  return {
    root: rootDir,
    plugins: [vue(), staticImages(assetRoot)],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src'),
      },
    },
    css: {
      postcss: {
        plugins: [rpxToVar()],
      },
    },
    server: {
      host: '127.0.0.1',
      port: webPort,
      // 端口被占用时直接报错退出，而不是静默换到 5174——
      // 否则启动脚本打开的仍是 5173，页面必然打不开且看不出原因
      strictPort: true,
      // HANDOFF §7.2：开发期用 HTTP，绝不启用 https
      https: false,
      watch: {
        // 编辑器/工具链的原子写会创建 .tmpdir 临时目录，被 watcher 监听会 EBUSY 崩掉
        ignored: [
          '**/*.tmpdir/**',
          '**/*.tmp',
          '**/.artifacts/**',
          '**/.acl-recovery/**',
          '**/.npm-cache/**',
          '**/dist/**',
          // 素材体积 600 MB+，绝不能进 watcher：拖慢启动、且极易触发 EBUSY
          '**/assets/images/**',
        ],
      },
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${shimPort}`,
          changeOrigin: false,
        },
      },
    },
    preview: {
      host: '127.0.0.1',
      port: webPort + 1,
      https: false,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
    },
  };
});

/**
 * 实现功能：Web 前端浏览器级验收（对应 HANDOFF §9.2）
 * 职责：用真实 Chrome 打开 8 条路由 × 两个视口（375px 移动 / 1440px 桌面），逐页检查：
 *       1) 路由可达、页面有渲染内容
 *       2) 控制台 error / 未捕获异常 / 请求失败（含图片 404）
 *       3) 横向溢出（破版检测）
 *       4) 页面是否出现指定的真实 DB 内容关键词（证明不是空态）
 *       5) 截图到 .artifacts/screens/
 * 用法：
 *   node scripts/verify-web.mjs                # 全部路由 × 两个视口
 *   node scripts/verify-web.mjs process quiz   # 指定路由名
 *   WEB_BASE=http://127.0.0.1:5173 node scripts/verify-web.mjs
 * 注意：Chrome 必须由完全权限进程启动（受限沙箱会拦截命名管道），故本脚本需在 full access 下运行。
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const BASE = (process.env.WEB_BASE || 'http://127.0.0.1:5173').replace(/\/+$/, '');
const OUT_DIR = path.resolve(process.cwd(), '.artifacts');
const SHOT_DIR = path.join(OUT_DIR, 'screens');

/**
 * 浏览器可执行文件探测：优先 CHROME_PATH，其次常见安装路径（Windows / macOS / Linux）。
 * 组员机器上 Chrome 不一定在默认位置，硬编码会直接报「找不到 Chrome」。
 */
const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const findBrowser = () => BROWSER_CANDIDATES.find((candidate) => {
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
});

const CHROME = findBrowser();

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];

/**
 * expect：页面正文必须出现的关键词（证明渲染的是 DB 真实内容而不是空态）。
 * forbid：出现即视为失败的文本（例如「暂无数据」「加载失败」）。
 */
const ROUTES = [
  { name: 'index', path: '/', expect: ['云幕皮影'], forbid: [] },
  { name: 'select', path: '/select', expect: ['地图寻影'], forbid: [] },
  { name: 'display', path: '/display', expect: ['皮影'], forbid: ['暂无'] },
  { name: 'process', path: '/process', expect: ['八步成影', '选皮', '缀结合成'], forbid: ['暂无工艺数据', '加载失败'] },
  { name: 'interactive', path: '/interactive', expect: ['互动'], forbid: [] },
  { name: 'quiz', path: '/quiz', expect: ['知识'], forbid: ['暂无'] },
  { name: 'history', path: '/history', expect: ['光影溯源'], forbid: ['暂无'] },
  { name: 'school', path: '/school', expect: ['地域流派'], forbid: ['暂无数据'] },
];

const only = process.argv.slice(2).filter((item) => !item.startsWith('-'));
const targets = only.length ? ROUTES.filter((item) => only.includes(item.name)) : ROUTES;

const IGNORABLE_CONSOLE = [
  /Download the Vue Devtools/i,
  /favicon\.ico/i,
  /\[vite\] connect/i,
];

const run = async () => {
  if (!CHROME) {
    console.error(
      [
        '找不到可用的浏览器。请任选一种方式：',
        '  1) 安装 Google Chrome 或 Microsoft Edge；',
        '  2) 设置环境变量 CHROME_PATH 指向浏览器可执行文件，例如：',
        '     $env:CHROME_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"',
      ].join('\n'),
    );
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--font-render-hinting=none',
    ],
  });

  const report = [];

  for (const viewport of VIEWPORTS) {
    for (const route of targets) {
      const page = await browser.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];

      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (IGNORABLE_CONSOLE.some((pattern) => pattern.test(text))) return;
        consoleErrors.push(text);
      });
      page.on('pageerror', (error) => pageErrors.push(String(error?.message || error)));
      page.on('requestfailed', (request) => {
        const url = request.url();
        // 忽略被 devtools/HMR 主动取消的请求
        if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url) || !/^\//.test(url)) {
          failedRequests.push(`${request.failure()?.errorText || 'failed'} ${url}`);
        }
      });
      page.on('response', (response) => {
        const status = response.status();
        if (status >= 400) {
          const url = response.url();
          if (!/favicon\.ico/i.test(url)) failedRequests.push(`HTTP ${status} ${url}`);
        }
      });

      await page.setViewport({
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: viewport.deviceScaleFactor,
        isMobile: viewport.isMobile,
        hasTouch: viewport.hasTouch,
      });

      const url = `${BASE}${route.path}`;
      let navigationError = null;
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
        // 等图片解码完成，避免截图空白
        await page.evaluate(async () => {
          const images = Array.from(document.images);
          await Promise.all(
            images.map((img) => (img.complete ? Promise.resolve() : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
              setTimeout(resolve, 4000);
            }))),
          );
        });
        await new Promise((resolve) => setTimeout(resolve, 350));
      } catch (error) {
        navigationError = String(error?.message || error);
      }

      let metrics = { bodyText: '', overflowX: false, scrollWidth: 0, innerWidth: 0, imgTotal: 0, imgBroken: 0 };
      if (!navigationError) {
        metrics = await page.evaluate(() => {
          const images = Array.from(document.images);
          const broken = images.filter((img) => img.complete && img.naturalWidth === 0);
          return {
            bodyText: (document.body?.innerText || '').replace(/\s+/g, ' ').trim(),
            overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            imgTotal: images.length,
            imgBroken: broken.length,
            brokenSrcs: broken.slice(0, 5).map((img) => img.currentSrc || img.src),
          };
        });
      }

      const shotName = `${viewport.name}-${route.name}.png`;
      if (!navigationError) {
        await page.screenshot({ path: path.join(SHOT_DIR, shotName), fullPage: viewport.name === 'mobile' });
      }

      const missingExpect = route.expect.filter((word) => !metrics.bodyText.includes(word));
      const hitForbid = route.forbid.filter((word) => metrics.bodyText.includes(word));

      report.push({
        viewport: viewport.name,
        route: route.name,
        path: route.path,
        navigationError,
        consoleErrors,
        pageErrors,
        failedRequests,
        missingExpect,
        hitForbid,
        overflowX: metrics.overflowX,
        scrollWidth: metrics.scrollWidth,
        innerWidth: metrics.innerWidth,
        imgTotal: metrics.imgTotal,
        imgBroken: metrics.imgBroken,
        brokenSrcs: metrics.brokenSrcs || [],
        textLength: metrics.bodyText.length,
        textSample: metrics.bodyText.slice(0, 120),
        screenshot: navigationError ? '' : path.join('screens', shotName),
      });

      await page.close();
    }
  }

  await browser.close();

  fs.writeFileSync(path.join(OUT_DIR, 'verify-web.json'), JSON.stringify(report, null, 2), 'utf8');

  let failures = 0;
  console.log('');
  for (const item of report) {
    const problems = [];
    if (item.navigationError) problems.push(`导航失败：${item.navigationError}`);
    if (item.pageErrors.length) problems.push(`页面异常 ${item.pageErrors.length}`);
    if (item.consoleErrors.length) problems.push(`console.error ${item.consoleErrors.length}`);
    if (item.failedRequests.length) problems.push(`请求失败 ${item.failedRequests.length}`);
    if (item.imgBroken > 0) problems.push(`图片损坏 ${item.imgBroken}/${item.imgTotal}`);
    if (item.missingExpect.length) problems.push(`缺少内容 ${item.missingExpect.join('/')}`);
    if (item.hitForbid.length) problems.push(`命中禁词 ${item.hitForbid.join('/')}`);
    if (item.overflowX) problems.push(`横向溢出 ${item.scrollWidth}>${item.innerWidth}`);

    if (problems.length) failures += 1;
    const mark = problems.length ? 'FAIL' : 'PASS';
    console.log(`${mark}  ${item.viewport.padEnd(7)} ${item.route.padEnd(12)} ${item.screenshot || ''}`);
    if (problems.length) {
      console.log(`      ← ${problems.join(' | ')}`);
      if (item.consoleErrors.length) console.log(`      console: ${item.consoleErrors.slice(0, 3).join(' || ')}`);
      if (item.failedRequests.length) console.log(`      net: ${item.failedRequests.slice(0, 3).join(' || ')}`);
      if (item.brokenSrcs.length) console.log(`      img: ${item.brokenSrcs.join(' || ')}`);
    }
  }
  console.log('');
  console.log(`合计 ${report.length} 个「视口×路由」组合：通过 ${report.length - failures}，失败 ${failures}`);
  console.log(`报告：${path.join(OUT_DIR, 'verify-web.json')}`);
  if (failures) process.exitCode = 1;
};

run().catch((error) => {
  console.error(`验收脚本异常：${error?.stack || error}`);
  process.exitCode = 1;
});

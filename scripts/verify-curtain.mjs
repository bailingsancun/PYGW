/**
 * 身入影幕页自动化验收：截图 + 控制台错误 + 关键状态。
 * 用法：node scripts/verify-curtain.mjs [--url http://127.0.0.1:5173] [--step basic|qte|hub|all]
 * 说明：只能在完全权限下运行（受限沙箱里 Chrome 起不来）。
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);

const CHROME = CANDIDATES.find((candidate) => {
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
});
if (!CHROME) {
  console.error('找不到浏览器，请设置 CHROME_PATH');
  process.exit(1);
}

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const BASE = getArg('url', 'http://127.0.0.1:5173');
const STEP = getArg('step', 'all');
const OUT = path.resolve('.artifacts/screens');
fs.mkdirSync(OUT, { recursive: true });

const report = {
  url: `${BASE}/curtain`,
  consoleErrors: [],
  pageErrors: [],
  checks: {},
  screenshots: [],
  at: new Date().toISOString(),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--hide-scrollbars',
    // 允许带声自动播放，避免把「点一下开配乐」当成失败
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
  ],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text().slice(0, 500));
  });
  page.on('pageerror', (error) => report.pageErrors.push(String(error).slice(0, 500)));
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('/api/')) return; // shim / ai 服务未起时不作为失败项
    report.consoleErrors.push(`requestfailed ${url} ${request.failure()?.errorText || ''}`);
  });

  const shot = async (name) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    report.screenshots.push(file);
    return file;
  };

  await page.goto(`${BASE}/curtain`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__CURTAIN__), { timeout: 60000 });
  await sleep(4200);

  report.checks.boot = await page.evaluate(() => ({
    phase: window.__CURTAIN__.phase,
    character: window.__CURTAIN__.character,
    audioBlocked: window.__CURTAIN__.audioBlocked,
    canvas: (() => {
      const canvas = document.querySelector('.battle-canvas');
      if (!canvas) return null;
      const box = canvas.getBoundingClientRect();
      return { width: Math.round(box.width), height: Math.round(box.height) };
    })(),
  }));
  await shot('curtain-01-boot');

  if (STEP === 'basic') {
    // 只验证能播：确认时间在推进
    await sleep(2500);
    report.checks.progress = await page.evaluate(() => ({ time: window.__CURTAIN__.time, music: window.__CURTAIN__.music }));
    await shot('curtain-02-progress');
  }

  if (STEP === 'qte' || STEP === 'all') {
    // 引导窗口在节点前 7.3s 打开：跳到 music 10.5，等角标出现
    await page.evaluate(() => window.__CURTAIN__.seekMusic(10.5));
    await page.waitForFunction(() => window.__CURTAIN__.qte === 'parry', { timeout: 20000 }).catch(() => {});
    await sleep(700);
    report.checks.qte = await page.evaluate(() => ({
      window: window.__CURTAIN__.qteWindow,
      phase: window.__CURTAIN__.phase,
      hud: Boolean(document.querySelector('.qte-hud')),
      hudClass: document.querySelector('.qte-hud')?.className || '',
      guideSvg: Boolean(document.querySelector('.qte-hud .guide-svg')),
      title: document.querySelector('.hud-name')?.textContent || '',
      cameraHint: document.querySelector('.hud-camera-btn')?.textContent?.trim() || '',
      time: window.__CURTAIN__.time,
    }));
    await shot('curtain-03-qte');

    // 动画必须继续播（不暂停、不暗屏）
    await sleep(900);
    report.checks.qteNotPaused = await page.evaluate(() => ({
      time: window.__CURTAIN__.time,
      qte: window.__CURTAIN__.qte,
      veil: Boolean(document.querySelector('.qte-veil')),
    }));

    // 用指针画出「两笔交叉」的 X
    const box = await page.evaluate(() => {
      const rect = document.querySelector('.curtain-stage').getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const size = Math.min(box.width, box.height) * 0.22;
    await page.mouse.move(cx - size, cy - size);
    await page.mouse.down();
    await page.mouse.move(cx + size, cy + size, { steps: 12 });
    await page.mouse.up();
    await sleep(260);
    await page.mouse.move(cx + size, cy - size);
    await page.mouse.down();
    await page.mouse.move(cx - size, cy + size, { steps: 12 });
    await page.mouse.up();
    await sleep(900);
    report.checks.traceSuccess = await page.evaluate(() => ({
      phase: window.__CURTAIN__.phase,
      passed: window.__CURTAIN__.passed,
      qte: window.__CURTAIN__.qte,
      success: Boolean(document.querySelector('.hud-success')),
      music: window.__CURTAIN__.music,
    }));
    await shot('curtain-04-qte-result');

    // 结算点应在节点后 2 秒（music 20.6）：过了判定窗口仍是「已通过」、没有触发回退
    await page
      .waitForFunction(() => window.__CURTAIN__.music > 21.2, { timeout: 25000 })
      .catch(() => {});
    report.checks.windowEnd = await page.evaluate(() => ({
      music: window.__CURTAIN__.music,
      passed: window.__CURTAIN__.passed,
      qte: window.__CURTAIN__.qte,
      phase: window.__CURTAIN__.phase,
    }));

    // 失败分支：跳到第二式的引导窗口（music 26.3 起），不做动作
    await page.evaluate(() => window.__CURTAIN__.seekMusic(25.8));
    await page.waitForFunction(() => window.__CURTAIN__.qte === 'thrust', { timeout: 20000 }).catch(() => {});
    await sleep(700);
    report.checks.qte2 = await page.evaluate(() => ({
      window: window.__CURTAIN__.qteWindow,
      hudClass: document.querySelector('.qte-hud')?.className || '',
    }));
    await shot('curtain-05-qte2');

    // 等节点 33.6 结算：未通过 → 黑屏闪回 → 回退到 18.6
    await page
      .waitForFunction(() => !window.__CURTAIN__.qte && window.__CURTAIN__.music < 22, { timeout: 30000 })
      .catch(() => {});
    await sleep(1200);
    report.checks.qte2Fail = await page.evaluate(() => ({
      phase: window.__CURTAIN__.phase,
      music: window.__CURTAIN__.music,
      passed: window.__CURTAIN__.passed,
      qte: window.__CURTAIN__.qte,
    }));
    await shot('curtain-06-after-fail');
  }

  if (STEP === 'hub' || STEP === 'all') {
    await page.evaluate(() => window.__CURTAIN__.toHub());
    await sleep(2200);
    report.checks.hub = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.hub-actions .art-button')].map((button) => ({
        text: button.textContent.trim(),
        top: Math.round(button.getBoundingClientRect().top),
        left: Math.round(button.getBoundingClientRect().left),
        width: Math.round(button.getBoundingClientRect().width),
      }));
      const stage = document.querySelector('.hub-rig-mount .py-stage');
      return {
        phase: window.__CURTAIN__.phase,
        buttons,
        rig: stage
          ? { width: Math.round(stage.getBoundingClientRect().width), height: Math.round(stage.getBoundingClientRect().height) }
          : null,
        parts: document.querySelectorAll('.hub-rig-mount .py-part').length,
        handlesVisible: document.querySelectorAll('.hub-rig-mount .py-handle:not(.hidden)').length,
      };
    });
    await shot('curtain-07-hub');

    // 点击空白 → 关节点应保持隐藏；点击皮影 → 关节点应出现
    await page.mouse.click(40, 300);
    await sleep(300);
    report.checks.clickEmpty = await page.evaluate(() => document.querySelectorAll('.hub-rig-mount .py-handle:not(.hidden)').length);

    const part = await page.evaluate(() => {
      const el = document.querySelector('.hub-rig-mount .py-part');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    if (part) {
      await page.mouse.click(part.x, part.y);
      await sleep(400);
      report.checks.clickPuppet = await page.evaluate(
        () => document.querySelectorAll('.hub-rig-mount .py-handle:not(.hidden)').length,
      );

      // 拖动一个关节点：手柄位移应明显（部件的 pointer-events:none 不能影响手柄拖动）
      const handle = await page.evaluate(() => {
        const el = document.querySelector('.hub-rig-mount .py-handle:not(.hidden)');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, left: parseFloat(el.style.left), top: parseFloat(el.style.top) };
      });
      if (handle) {
        await page.mouse.move(handle.x, handle.y);
        await page.mouse.down();
        await page.mouse.move(handle.x + 46, handle.y + 30, { steps: 10 });
        await page.mouse.up();
        await sleep(320);
        report.checks.dragHandle = await page.evaluate((before) => {
          const el = document.querySelector('.hub-rig-mount .py-handle');
          const left = parseFloat(el?.style.left || '0');
          const top = parseFloat(el?.style.top || '0');
          return {
            before: `${Math.round(before.left)},${Math.round(before.top)}`,
            after: `${Math.round(left)},${Math.round(top)}`,
            moved: Math.hypot(left - before.left, top - before.top) > 12,
          };
        }, handle);
      }
    }
    await shot('curtain-08-handles');
  }
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, 'curtain-report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));

/**
 * 三式校准全链路：X 交叉 → 前突刺 → 下劈，全部用指针轨迹通过；
 * 之后让动画自然播完，确认自动进入「幕后」。
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean).find((p) => {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
});

const OUT = path.resolve('.artifacts/screens');
fs.mkdirSync(OUT, { recursive: true });
const report = { consoleErrors: [], pageErrors: [], steps: [] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('console', (m) => {
    if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => report.pageErrors.push(String(e).slice(0, 300)));

  await page.goto('http://127.0.0.1:5173/curtain', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__CURTAIN__), { timeout: 60000 });
  await sleep(1600);

  const geometry = await page.evaluate(() => {
    const box = document.querySelector('.qte-layer')?.getBoundingClientRect();
    return { width: window.innerWidth, height: window.innerHeight, hasLayer: Boolean(box) };
  });

  const cx = geometry.width / 2;
  const cy = geometry.height / 2;

  const stroke = async (points, steps = 14) => {
    await page.mouse.move(points[0][0], points[0][1]);
    await page.mouse.down();
    for (let index = 1; index < points.length; index += 1) {
      await page.mouse.move(points[index][0], points[index][1], { steps });
    }
    await page.mouse.up();
    await sleep(500);
  };

  const waitQte = async (id) => {
    await page.waitForFunction((nodeId) => window.__CURTAIN__.qte === nodeId, { timeout: 25000 }, id);
    await sleep(500);
  };

  // ---- 第一式：X 交叉（引导窗口从 music 11.3 开始）----
  await page.evaluate(() => window.__CURTAIN__.seekMusic(10.8));
  await waitQte('parry');
  const size = Math.min(geometry.width, geometry.height) * 0.22;
  await stroke([[cx - size, cy - size], [cx + size, cy + size]], 12);
  await stroke([[cx + size, cy - size], [cx - size, cy + size]], 12);
  await sleep(900);
  report.steps.push({ step: 'parry', state: await page.evaluate(() => ({ phase: window.__CURTAIN__.phase, passed: window.__CURTAIN__.passed })) });

  // ---- 第二式：前突刺（引导窗口从 music 26.3 开始）----
  await page.evaluate(() => window.__CURTAIN__.seekMusic(25.8));
  await waitQte('thrust');
  await page.screenshot({ path: path.join(OUT, 'full-03-qte-thrust.png') });
  await stroke([[cx - 180, cy], [cx + 220, cy]], 16);
  await sleep(900);
  report.steps.push({ step: 'thrust', state: await page.evaluate(() => ({ phase: window.__CURTAIN__.phase, passed: window.__CURTAIN__.passed })) });

  // ---- 第三式：下劈（引导窗口从 music 52.9 开始）----
  await page.evaluate(() => window.__CURTAIN__.seekMusic(52.5));
  await waitQte('cut');
  await page.screenshot({ path: path.join(OUT, 'full-04-qte-cut.png') });
  await stroke([[cx, cy - 180], [cx, cy + 200]], 16);
  await sleep(900);
  report.steps.push({ step: 'cut', state: await page.evaluate(() => ({ phase: window.__CURTAIN__.phase, passed: window.__CURTAIN__.passed })) });

  await page.screenshot({ path: path.join(OUT, 'full-01-after-three.png') });

  // ---- 自然播完：跳到收尾前，等它自己结束 ----
  await page.evaluate(() => window.__CURTAIN__.seekMusic(65));
  await page.waitForFunction(() => window.__CURTAIN__.phase === 'hub', { timeout: 30000 }).catch(() => {});
  await sleep(1800);
  report.steps.push({ step: 'ended', state: await page.evaluate(() => ({ phase: window.__CURTAIN__.phase, music: window.__CURTAIN__.music, passed: window.__CURTAIN__.passed })) });
  await page.screenshot({ path: path.join(OUT, 'full-02-hub.png') });
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, 'full-report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));

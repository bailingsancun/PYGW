/**
 * 入口回归：从「光影互动」点「身入影幕」进入 /curtain（复用灯晕转场），
 * 并确认「影幕寻踪」原有玩法未被破坏。
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
const report = { consoleErrors: [], pageErrors: [], checks: {} };
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

  await page.goto('http://127.0.0.1:5173/interactive', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(1200);
  report.checks.interactive = await page.evaluate(() => ({
    modeButtons: [...document.querySelectorAll('.mode-select .art-button')].map((b) => b.textContent.trim()),
  }));
  await page.screenshot({ path: path.join(OUT, 'entry-01-interactive.png') });

  // 点「身入影幕」
  await page.evaluate(() => {
    [...document.querySelectorAll('.mode-select .art-button')].find((b) => b.textContent.includes('身入影幕'))?.click();
  });
  await page.waitForFunction(() => location.pathname === '/curtain', { timeout: 20000 });
  await page.waitForFunction(() => Boolean(window.__CURTAIN__), { timeout: 60000 });
  await sleep(3000);
  report.checks.curtain = await page.evaluate(() => ({
    path: location.pathname,
    phase: window.__CURTAIN__.phase,
    character: window.__CURTAIN__.character,
    title: document.querySelector('.top-title')?.textContent || '',
  }));
  await page.screenshot({ path: path.join(OUT, 'entry-02-curtain.png') });

  // 回到互动页，验证「影幕寻踪」原有玩法仍可用
  await page.goto('http://127.0.0.1:5173/interactive', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(1500);
  await page.evaluate(() => {
    [...document.querySelectorAll('.mode-select .art-button')].find((b) => b.textContent.includes('影幕寻踪'))?.click();
  });
  await sleep(2200);
  report.checks.trackMode = await page.evaluate(() => ({
    path: location.pathname,
    hint: document.querySelector('.hint-bar')?.textContent?.trim().slice(0, 30) || '',
    puppets: document.querySelectorAll('.puppet-item').length,
  }));
  await page.screenshot({ path: path.join(OUT, 'entry-03-track.png') });
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, 'entry-report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));

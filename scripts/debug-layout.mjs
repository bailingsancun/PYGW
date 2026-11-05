/**
 * 排障工具：量取指定路由关键元素的几何信息（定位裁切、溢出、对齐问题）。
 * 用法：node scripts/debug-layout.mjs [/process] [宽度] [高度]
 * 浏览器路径优先读 CHROME_PATH，其次探测常见安装位置。
 */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const CHROME = CANDIDATES.find((candidate) => {
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
});
if (!CHROME) {
  console.error('找不到浏览器，请设置 CHROME_PATH 指向 chrome.exe / msedge.exe / chromium。');
  process.exit(1);
}
const target = process.argv[2] || '/process';
const width = Number(process.argv[3] || 1440);
const height = Number(process.argv[4] || 900);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:5173${target}`, { waitUntil: 'networkidle2', timeout: 45000 });
await new Promise((r) => setTimeout(r, 500));

const info = await page.evaluate(() => {
  const rect = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      tag: el.tagName,
      top: Math.round(box.top * 10) / 10,
      bottom: Math.round(box.bottom * 10) / 10,
      left: Math.round(box.left * 10) / 10,
      width: Math.round(box.width * 10) / 10,
      height: Math.round(box.height * 10) / 10,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      marginTop: style.marginTop,
      overflow: style.overflow,
      lineHeight: style.lineHeight,
      fontSize: style.fontSize,
      display: style.display,
    };
  };
  return {
    rpxVar: getComputedStyle(document.documentElement).getPropertyValue('--rpx').trim(),
    htmlFontSize: getComputedStyle(document.documentElement).fontSize,
    card: rect('.process-card'),
    cardTop: rect('.card-top'),
    titleGroup: rect('.title-group'),
    stepTitle: rect('.step-title'),
    stepBadge: rect('.step-badge'),
    stepImage: rect('.step-image'),
    listStyle: (() => {
      const el = document.querySelector('.process-list');
      if (!el) return null;
      const s = getComputedStyle(el);
      return { display: s.display, gridTemplateColumns: s.gridTemplateColumns, gap: s.gap, padding: s.padding };
    })(),
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();

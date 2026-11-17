/**
 * 实现功能：把 docs/technical-report.md 渲染成 docs/technical-report.pdf
 * 用法：node scripts/build-report.mjs
 * 说明：不引入 markdown 依赖，内置一个够用的迷你渲染器（标题/表格/代码块/列表/行内样式），
 *       再用本机 Chrome 打印为 A4 PDF（页眉页码由打印样式提供）。
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const MD = path.join(ROOT, 'docs', 'technical-report.md');
const HTML = path.join(ROOT, 'docs', 'technical-report.html');
const PDF = path.join(ROOT, 'docs', 'technical-report.pdf');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 行内 Markdown：粗体、行内代码 */
const inline = (s) =>
  escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

/** 把 Markdown 转成 HTML 片段 */
function render(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // HTML 注释：跳过（否则会被当成正文渲染出来）
    if (/^\s*<!--/.test(line)) {
      while (i < lines.length && !/-->/.test(lines[i])) i += 1;
      i += 1;
      continue;
    }

    /*
     * 图片：![说明](figures/xxx.svg)
     * SVG 直接内联（矢量打印清晰，且不依赖相对路径解析），
     * 其它格式退化为 <img>。
     */
    const img = line.match(/^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (img) {
      const [, alt, src] = img;
      const caption = alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : '';
      if (/\.svg$/i.test(src)) {
        const svgPath = path.join(path.dirname(MD), src);
        let svg = fs.readFileSync(svgPath, 'utf8');
        // 去掉固定宽高，交给 viewBox 与 CSS 自适应
        svg = svg.replace(/<svg([^>]*?)\swidth="[^"]*"/, '<svg$1').replace(/<svg([^>]*?)\sheight="[^"]*"/, '<svg$1');
        svg = svg.replace('<svg', '<svg class="figure"');
        out.push(`<figure>${svg}${caption}</figure>`);
      } else {
        out.push(`<figure><img class="figure" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">${caption}</figure>`);
      }
      i += 1;
      continue;
    }

    // 原始 HTML 块（封面、分页符、结尾标记）
    if (/^\s*<(div|br)/.test(line) || /^\s*<\/div>/.test(line) || /^\s*<br\s*\/?>/.test(line)) {
      let block = line;
      // 收集同一 HTML 块（直到空行）
      while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !/^\s*<(div|br)/.test(lines[i + 1])) {
        block += '\n' + lines[i + 1];
        i += 1;
      }
      out.push(block);
      i += 1;
      continue;
    }

    // 代码块
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1;
      out.push(`<pre class="code" data-lang="${escapeHtml(lang)}"><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // 标题
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // 表格：以 | 开头且下一行是分隔行
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const headers = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim())));
        i += 1;
      }
      out.push(
        '<table><thead><tr>' + headers.map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>'
      );
      continue;
    }

    // 引用
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      out.push(`<blockquote>${buf.map((l) => inline(l)).join('<br>')}</blockquote>`);
      continue;
    }

    // 有序 / 无序列表
    if (/^\s*(\d+\.|[-*])\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const buf = [];
      while (i < lines.length && /^\s*(\d+\.|[-*])\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*(\d+\.|[-*])\s+/, ''));
        i += 1;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${buf.map((l) => `<li>${inline(l)}</li>`).join('')}</${tag}>`);
      continue;
    }

    // 空行
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // 普通段落（合并连续行）
    const buf = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|```|\s*\||>\s?|\s*(\d+\.|[-*])\s+)/.test(lines[i]) && !/^\s*<(div|br)/.test(lines[i])) {
      buf.push(lines[i]);
      i += 1;
    }
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
    else i += 1;
  }

  return out.join('\n');
}

const css = `
@page { size: A4; margin: 18mm 16mm 16mm 16mm; }
@page { @bottom-center { content: counter(page); font-size: 9pt; color: #666; } }
* { box-sizing: border-box; }
body {
  margin: 0; color: #1f1a17; background: #fff;
  font-family: "KaiTi", "STKaiti", "Songti SC", "SimSun", "Microsoft YaHei", serif;
  font-size: 10.8pt; line-height: 1.75;
}
h1 { font-size: 22pt; text-align: center; margin: 0 0 10pt; letter-spacing: 2pt; color: #5b3a1e; }
h2 { font-size: 15pt; margin: 22pt 0 9pt; padding-left: 8pt; border-left: 4pt solid #b8863b; color: #4a2f17; page-break-after: avoid; }
h3 { font-size: 12.5pt; margin: 15pt 0 6pt; color: #5b3a1e; page-break-after: avoid; }
h4 { font-size: 11pt; margin: 12pt 0 5pt; color: #6b4a2a; }
p { margin: 0 0 7pt; text-align: justify; }
ul, ol { margin: 0 0 8pt; padding-left: 18pt; }
li { margin: 2pt 0; }
code { font-family: "Consolas", "Courier New", monospace; font-size: 9.2pt; background: #f3efe8; padding: 1pt 3pt; border-radius: 2pt; }
pre.code { background: #f7f3ec; border: 0.6pt solid #ddd2bf; border-radius: 3pt; padding: 7pt 9pt; overflow: hidden; page-break-inside: avoid; margin: 6pt 0 9pt; }
pre.code code { background: none; padding: 0; font-size: 8.4pt; line-height: 1.5; white-space: pre-wrap; word-break: break-all; }
table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; font-size: 9.6pt; page-break-inside: avoid; }
th, td { border: 0.6pt solid #cbbfa8; padding: 3.5pt 5pt; text-align: left; vertical-align: top; }
th { background: #f3ead9; font-weight: 700; color: #4a2f17; }
blockquote { margin: 6pt 0 9pt; padding: 5pt 9pt; background: #faf6ee; border-left: 3pt solid #c9a86a; color: #5a4a38; }
a { color: #8a5a1e; text-decoration: none; }
.cover { page-break-after: always; text-align: center; padding-top: 52mm; }
.cover h1 { font-size: 30pt; margin-bottom: 6pt; }
.cover h2 { border: none; font-size: 15pt; color: #7a5a34; margin: 0 0 4pt; padding: 0; text-align: center; }
.cover h3 { font-size: 12pt; color: #8a6a44; margin: 0 0 22pt; }
.cover table { width: 78%; margin: 0 auto; font-size: 10pt; }
.cover th { background: #f6efe2; }
.page-break { page-break-after: always; height: 0; }
.end-mark { margin-top: 22pt; text-align: center; color: #8a6a44; letter-spacing: 3pt; }
strong { color: #3d2714; }
figure { margin: 8pt 0 12pt; text-align: center; page-break-inside: avoid; }
figure svg, figure img.figure { max-width: 100%; height: auto; display: block; margin: 0 auto; }
figcaption { margin-top: 4pt; font-size: 9pt; color: #7a5a34; letter-spacing: 0.5pt; }
`;

const md = fs.readFileSync(MD, 'utf8');
const body = render(md);
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>云幕皮影 · 技术文档</title><style>${css}</style></head><body>${body}</body></html>`;
fs.writeFileSync(HTML, html, 'utf8');
console.log('HTML 已生成:', HTML, `(${(html.length / 1024).toFixed(1)} KB)`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.pdf({
  path: PDF,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate:
    '<div style="width:100%;font-size:8pt;color:#888;font-family:KaiTi,SimSun,serif;text-align:center;">云幕皮影 · 技术文档 &nbsp;|&nbsp; 第 <span class="pageNumber"></span> / <span class="totalPages"></span> 页</div>',
  margin: { top: '18mm', bottom: '16mm', left: '16mm', right: '16mm' },
});
await browser.close();

const size = fs.statSync(PDF).size;
console.log('PDF 已生成:', PDF, `(${(size / 1024).toFixed(0)} KB)`);

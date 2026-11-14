/**
 * 实现功能：三式动作示意图（纯 SVG，无图片依赖）+ QTE 淡金虚线框
 * 来源：testdemo/CV/js/guides.js（已测试完全），逻辑原样迁移。
 * 用途：身入影幕 QTE 的文字引导与示意图（用户可见的「怎么做动作」提示）。
 */
/**
 * 三个动作的“半透明黑色 + 金框”示意图（纯 SVG，无图片依赖）。
 * 同一个 FRAME_PATH 也用于 QTE 的淡金色虚线框，保证收缩后完全重合。
 */

export const GUIDE_VIEWBOX = { width: 260, height: 330 };
export const FRAME_PATH = 'M 30 5 H 230 L 255 30 V 300 L 230 325 H 30 L 5 300 V 30 Z';

export const GUIDE_META = {
  x: {
    key: 'x',
    index: '壹',
    title: '双臂上举交叉成 X',
    short: 'X 交叉',
    caption: '① 双臂上举 · 小臂交叉',
    hint: '双手举过肩/头顶，两条小臂在身前交叉成 X，保持半秒。',
    tip: '双腕过肩 + 屈肘 + 腕高于肘；正面看双腕在身前交叉，侧面看双腕靠近。只用上半身。',
  },
  thrust: {
    key: 'thrust',
    index: '贰',
    title: '屈臂变直臂向前突刺',
    short: '前突刺',
    caption: '② 屈臂 → 直臂 · 向前突刺',
    hint: '单手或双手先屈肘收在胸前，再猛地打直、朝镜头/身前刺出。',
    tip: '手腕在三维空间明显前送即可，镜头方向或画面方向都识别；单手、双手均可。',
  },
  swing: {
    key: 'swing',
    index: '叁',
    title: '单臂自上而下大幅挥斩',
    short: '下劈',
    caption: '③ 单臂自上而下 · 大幅挥斩',
    hint: '一条手臂先举过头顶，伸直后从上往下劈到肩下即可，不必露出下半身。',
    tip: '只认单臂；双臂一起放下（例如收起 X）不算挥斩。',
  },
};

const bodyBase = `
  <g class="g-body">
    <circle class="g-head" cx="130" cy="78" r="16" />
    <path class="g-neck" d="M130 94 L130 104" />
    <path class="g-torso" d="M100 110 L108 240 L152 240 L160 110 Z" />
    <path class="g-cut" d="M106 248 L154 248" />
  </g>`;

const xFigure = `
  ${bodyBase}
  <g class="g-arms">
    <path class="g-arm" d="M100 110 L88 64" />
    <path class="g-arm" d="M160 110 L172 64" />
    <path class="g-arm hot" d="M88 64 L162 36" />
    <path class="g-arm hot" d="M172 64 L98 36" />
    <path class="g-hand" d="M162 36 L172 28" />
    <path class="g-hand" d="M98 36 L88 28" />
  </g>
  <circle class="g-pulse" cx="130" cy="50" r="4" />
  <g class="g-motions">
    <path class="g-arrow pale" d="M70 170 L70 126" marker-end="url(#arrow-{prefix})" />
    <path class="g-arrow pale" d="M190 170 L190 126" marker-end="url(#arrow-{prefix})" />
  </g>`;

const thrustFigure = `
  <g class="g-body">
    <circle class="g-head" cx="106" cy="76" r="16" />
    <path class="g-neck" d="M110 92 L112 102" />
    <path class="g-torso" d="M96 108 L104 238 L128 238 L134 108 Z" />
    <path class="g-cut" d="M100 246 L132 246" />
    <path class="g-face" d="M120 76 L125 73 L120 82" />
  </g>
  <g class="g-arms">
    <path class="g-arm ghost" d="M114 108 L140 148 L110 142" />
    <path class="g-hand ghost" d="M110 142 L100 146" />
    <path class="g-arm hot" d="M114 110 L154 118 L208 112" />
    <path class="g-hand hot" d="M208 112 L221 110" />
  </g>
  <g class="g-motions">
    <path class="g-arrow" d="M198 82 L236 82" marker-end="url(#arrow-{prefix})" />
    <path class="g-speed" d="M216 98 L230 98" />
    <path class="g-speed" d="M220 106 L234 106" />
    <path class="g-speed" d="M214 124 L226 124" />
  </g>`;

const swingFigure = `
  ${bodyBase}
  <g class="g-arms">
    <path class="g-arm ghost" d="M100 110 L84 66 L94 34" />
    <path class="g-hand ghost" d="M94 34 L92 24" />
    <path class="g-arm hot" d="M100 110 L90 170 L78 254" />
    <path class="g-hand hot" d="M78 254 L74 266" />
  </g>
  <g class="g-motions">
    <path class="g-arrow pale" d="M94 42 C58 100 48 188 68 250" marker-end="url(#arrow-{prefix})" />
    <path class="g-speed" d="M62 98 L46 90" />
    <path class="g-speed" d="M54 140 L38 136" />
    <path class="g-speed" d="M54 186 L38 186" />
  </g>`;

const FIGURES = { x: xFigure, thrust: thrustFigure, swing: swingFigure };

const CORNERS = `
  <g class="g-corners">
    <path d="M18 42 L42 18" />
    <path d="M218 18 L242 42" />
    <path d="M242 288 L218 312" />
    <path d="M42 312 L18 288" />
    <circle cx="130" cy="17" r="2.4" />
    <circle cx="130" cy="313" r="2.4" />
    <circle cx="17" cy="165" r="2.4" />
    <circle cx="243" cy="165" r="2.4" />
  </g>`;

/**
 * 生成一张示意图的 SVG 字符串。
 * @param {'x'|'thrust'|'swing'} action
 * @param {string} prefix 唯一前缀（同一页面多张图时避免 id 冲突）
 */
export function guideSvg(action, prefix = action) {
  const meta = GUIDE_META[action];
  if (!meta) throw new Error(`unknown guide: ${action}`);
  const figure = (FIGURES[action] || '').replaceAll('{prefix}', prefix);
  return `
<svg class="guide-svg" viewBox="0 0 260 330" role="img" aria-label="${meta.title}示意图" data-guide="${action}">
  <defs>
    <linearGradient id="gs-${prefix}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe6ad" />
      <stop offset="0.55" stop-color="#e6bb63" />
      <stop offset="1" stop-color="#b9893a" />
    </linearGradient>
    <radialGradient id="gb-${prefix}" cx="50%" cy="26%" r="72%">
      <stop offset="0" stop-color="#5a3a1c" stop-opacity="0.55" />
      <stop offset="0.62" stop-color="#160d07" stop-opacity="0.18" />
      <stop offset="1" stop-color="#000000" stop-opacity="0" />
    </radialGradient>
    <filter id="gg-${prefix}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <marker id="arrow-${prefix}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 Z" fill="#ffd98a" />
    </marker>
  </defs>

  <rect x="6" y="6" width="248" height="318" rx="18" fill="url(#gb-${prefix})" />
  <path class="g-frame" d="${FRAME_PATH}" />
  <path class="g-frame-inner" d="M 34 25 H 226 L 235 34 V 296 L 226 305 H 34 L 25 296 V 34 Z" />
  ${CORNERS}

  <text class="g-index" x="34" y="48">${meta.index}</text>
  <g class="g-figure" filter="url(#gg-${prefix})">${figure}</g>
  <text class="g-caption" x="130" y="316" text-anchor="middle">${meta.caption}</text>
</svg>`;
}

/** QTE 用的淡金色虚线框（与示意图共用 FRAME_PATH，因此缩放后完全重合）。 */
export function guideDashedFrame() {
  return `
<svg class="qte-dash-svg" viewBox="0 0 260 330" aria-hidden="true">
  <path class="qte-dash-path" d="${FRAME_PATH}" />
</svg>`;
}

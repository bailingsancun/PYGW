/**
 * 实现功能：本地皮影合成器（无图像生成模型时的兜底，也是「精致模式」的保底质量线）
 * 职责：按上传照片采到的主色，程序化画出整套皮影部件（SVG dataURL）——头、靠甲、下摆、披风、
 *       上/前臂、手、大腿、小腿，并复用主角将官的关节几何（pivot / attach / tip / z）组装 manifest。
 * 为什么复用将官几何：那套骨架已经逐关节调过（见 piying-pipeline 的 manifest 约定），
 *       换掉部件图即可得到「外形不同、关节一样准」的新形象，也保证主角宝剑能挂到正确的手上。
 * 输出：{ manifest, parts, notes } —— manifest.parts[*].src 全是 dataURL，可直接交给 rig-engine。
 */

const HEAD = [136, 187];
const TORSO = [138, 204];
const SKIRT = [210, 147];
const CAPE = [179, 271];
const UPPER_ARM = [31, 101];
const FOREARM = [32, 103];
const HAND = [42, 79];
const THIGH = [66, 129];
const LOWER_LEG = [102, 156];

const INK = '#2b1a16';
const GOLD = '#c9a24a';

const svgUrl = (size, body, extraDefs = '') => {
  const [w, h] = size;
  // 皮影是透光牛皮：整体略透一点，叠在灯箱上才有「灯下影人」的质感
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="opacity:0.97">${extraDefs}${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

/** 镂空纹样：皮影的透光孔 */
const holesDefs = (id = 'holes', step = 9, radius = 1.5) => `
  <defs>
    <pattern id="${id}" width="${step}" height="${step}" patternUnits="userSpaceOnUse">
      <circle cx="${step / 2}" cy="${step / 2}" r="${radius}" fill="#f7efdc" fill-opacity="0.5" />
    </pattern>
  </defs>`;

const pickColors = (palette = []) => {
  const fallback = ['#b23a2e', '#c9a24a', '#2f5d62', '#6b3f2a'];
  const luminance = (hex) => {
    const value = String(hex).replace('#', '');
    const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value.slice(0, 6);
    const num = parseInt(full, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  };
  // 照片背景常被采成近白色，直接用会让裙摆/披风发白；只保留中间调的颜色
  const usable = [...palette]
    .filter((color) => /^#[0-9a-f]{3,8}$/i.test(color))
    .filter((color) => {
      const level = luminance(color);
      return level > 0.1 && level < 0.8;
    });
  const list = [...usable, ...fallback];
  return {
    main: list[0] || fallback[0],
    second: list[1] || fallback[1],
    third: list[2] || fallback[2],
    ink: INK,
    gold: GOLD,
    skin: '#f0d9b5',
  };
};

const shade = (hex, amount) => {
  const value = String(hex).replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value.slice(0, 6);
  const num = parseInt(full, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/* ------------------------------------------------------------------ */
/* 部件绘制                                                            */
/* ------------------------------------------------------------------ */

function headSvg(colors, style) {
  const [, h] = HEAD;
  const crown = style.crown;
  const beard = style.beard;

  // 侧脸朝左的轮廓：面在左、后脑在右，底部收成脖子（pivot 在 [93,182]）
  const facePath = `M 97 ${h - 4}
    L 93 152
    C 86 142 76 140 71 132
    C 64 128 58 120 62 112
    C 55 105 58 96 66 93
    C 64 84 70 76 79 73
    C 84 58 97 48 112 51
    C 125 54 132 66 131 82
    C 130 102 126 120 120 136
    C 113 154 105 170 100 180
    Z`;

  const crownPath =
    crown === 'phoenix'
      ? `<path d="M 42 62 q 8 -34 40 -40 q 30 -5 46 16 q -18 2 -30 12 q -26 -10 -56 12 z" fill="${colors.gold}" stroke="${colors.ink}" stroke-width="2.2"/>
         <path d="M 44 60 q 22 -22 58 -22" fill="none" stroke="${colors.ink}" stroke-width="1.4" opacity="0.5"/>`
      : crown === 'cap'
        ? `<path d="M 44 64 q 4 -32 38 -38 q 28 -4 42 18 l -6 16 q -32 -12 -74 4 z" fill="${colors.main}" stroke="${colors.ink}" stroke-width="2.2"/>`
        : `<path d="M 40 66 q 6 -36 40 -40 q 30 -4 44 22 l -8 18 q -36 -16 -76 0 z" fill="${colors.second}" stroke="${colors.ink}" stroke-width="2.2"/>
           <path d="M 50 44 q 26 -20 62 -8" fill="none" stroke="${colors.ink}" stroke-width="1.3" opacity="0.45"/>`;

  const beardPath =
    beard === 'none'
      ? ''
      : beard === 'full'
        ? `<path d="M 66 122 q -10 26 0 46 q 8 16 24 10 q 14 -6 10 -26 q -12 6 -20 -4 q -6 -10 -2 -24 z"
             fill="${colors.third}" stroke="${colors.ink}" stroke-width="2" opacity="0.95"/>`
        : `<path d="M 68 124 q -5 30 3 52 q 4 12 12 8 q -6 -18 -4 -34 q 2 -16 5 -24 z"
             fill="${colors.third}" stroke="${colors.ink}" stroke-width="1.8" opacity="0.95"/>`;

  const body = `
    ${holesDefs('head-holes', 8, 1.3)}
    <path d="${facePath}" fill="${colors.skin}" stroke="${colors.ink}" stroke-width="2.6"/>
    <path d="M 82 66 q 22 -12 38 4 q 8 10 6 26 q -10 -18 -26 -22 q -12 -3 -18 -8 z"
      fill="${shade(colors.main, -18)}" stroke="${colors.ink}" stroke-width="1.6" opacity="0.9"/>
    ${crownPath}
    <path d="M 66 82 q 9 -5 16 0" fill="none" stroke="${colors.ink}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M 68 95 q 8 5 15 1" fill="none" stroke="${colors.ink}" stroke-width="2" stroke-linecap="round"/>
    <path d="M 62 104 q -5 5 -1 9 q 3 3 7 1" fill="none" stroke="${colors.ink}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M 72 116 q 8 3 15 -1" fill="none" stroke="${colors.ink}" stroke-width="1.8" stroke-linecap="round"/>
    ${beardPath}
    <path d="M 104 60 q 10 10 8 22" fill="none" stroke="${colors.gold}" stroke-width="2" stroke-linecap="round" opacity="0.85"/>
    <rect x="46" y="34" width="84" height="100" fill="url(#head-holes)" opacity="0.45"/>
  `;
  return svgUrl(HEAD, body);
}

function torsoSvg(colors, style) {
  const [w, h] = TORSO;
  const body = `
    ${holesDefs('torso-holes', 10, 1.7)}
    <path d="M26 22 q34 -16 76 0 q14 8 12 30 l-6 118 q-34 14 -78 2 l-10 -122 q-2 -20 6 -28 z"
      fill="${colors.main}" stroke="${colors.ink}" stroke-width="2.6"/>
    <path d="M22 30 q40 -18 84 2 l-4 22 q-38 -16 -76 -2 z" fill="${colors.second}" stroke="${colors.ink}" stroke-width="2"/>
    <path d="M46 44 l-8 118" stroke="${colors.ink}" stroke-width="1.2" opacity="0.45"/>
    <path d="M84 44 l8 118" stroke="${colors.ink}" stroke-width="1.2" opacity="0.45"/>
    ${[0, 1, 2, 3]
      .map(
        (row) => `
      <path d="M30 ${72 + row * 30} q20 12 40 0 q14 -8 28 0" fill="none" stroke="${colors.gold}" stroke-width="2" opacity="0.85"/>
      <path d="M30 ${80 + row * 30} q20 12 40 0 q14 -8 28 0" fill="none" stroke="${colors.ink}" stroke-width="1" opacity="0.4"/>`,
      )
      .join('')}
    <rect x="24" y="34" width="90" height="130" fill="url(#torso-holes)" opacity="0.55"/>
    <circle cx="69" cy="34" r="7" fill="${colors.gold}" stroke="${colors.ink}" stroke-width="1.8"/>
    <circle cx="69" cy="104" r="15" fill="${colors.gold}" stroke="${colors.ink}" stroke-width="2"/>
    <circle cx="69" cy="104" r="8" fill="${shade(colors.gold, -40)}" stroke="${colors.ink}" stroke-width="1.2"/>
    <path d="M20 46 q26 -14 50 -2 q14 6 22 2" fill="none" stroke="${colors.gold}" stroke-width="2.6" opacity="0.8"/>
  `;
  return svgUrl(TORSO, body);
}

function skirtSvg(colors) {
  const body = `
    ${holesDefs('skirt-holes', 11, 1.8)}
    <path d="M52 6 l106 0 l30 108 q-38 26 -84 26 q-46 0 -82 -26 z"
      fill="${shade(colors.main, 26)}" stroke="${colors.ink}" stroke-width="2.6"/>
    <path d="M44 74 q18 10 34 -2 q18 -12 34 0 q16 12 34 0 q16 -10 30 2" fill="none" stroke="${colors.gold}" stroke-width="6" opacity="0.6"/>
    <path d="M40 100 q20 12 38 -2 q16 -12 34 0 q18 12 36 -2 q14 -10 28 2" fill="none" stroke="${colors.ink}" stroke-width="1.6" opacity="0.5"/>
    <path d="M30 118 q36 22 78 22 q44 0 84 -22" fill="none" stroke="${colors.gold}" stroke-width="2.4" opacity="0.8"/>
    <rect x="46" y="14" width="124" height="112" fill="url(#skirt-holes)" opacity="0.5"/>
  `;
  return svgUrl(SKIRT, body);
}

function capeSvg(colors) {
  const body = `
    ${holesDefs('cape-holes', 12, 1.6)}
    <path d="M156 12 q-26 20 -52 62 q-32 52 -80 194 q34 6 62 -18 q42 -36 62 -110 q16 -62 8 -128 z"
      fill="${shade(colors.main, -34)}" stroke="${colors.ink}" stroke-width="2.4" opacity="0.94"/>
    <path d="M148 30 q-30 34 -58 96 q-28 62 -52 132" fill="none" stroke="${colors.gold}" stroke-width="2" opacity="0.7"/>
    <path d="M136 46 q-28 40 -52 100" fill="none" stroke="${colors.ink}" stroke-width="1.2" opacity="0.4"/>
    <rect x="20" y="10" width="150" height="260" fill="url(#cape-holes)" opacity="0.4"/>
  `;
  return svgUrl(CAPE, body);
}

function limbSvg(size, colors, { id, boot = false, segments = 2 }) {
  const [w, h] = size;
  const cx = w / 2;
  // 上端略宽、下端略窄的肢段，两端平齐 —— 关节旋转时接缝才不出现缺口
  const topHalf = w * 0.36;
  const bottomHalf = w * 0.3;
  const outline = `M ${cx - topHalf} 1 L ${cx + topHalf} 1 L ${cx + bottomHalf} ${h - 1} L ${cx - bottomHalf} ${h - 1} Z`;
  const inner = `M ${cx - topHalf * 0.52} 7 L ${cx + topHalf * 0.52} 7 L ${cx + bottomHalf * 0.52} ${h - 7} L ${cx - bottomHalf * 0.52} ${h - 7} Z`;
  const bootColor = shade(colors.main, -46);

  const bootTop = h * 0.74;
  const bootPath = boot
    ? `
    <path d="M ${cx - w * 0.32} ${bootTop} L ${cx + w * 0.32} ${bootTop} L ${cx + w * 0.29} ${h - 2} L ${cx - w * 0.4} ${h - 2} L ${cx - w * 0.35} ${bootTop + h * 0.08} Z"
      fill="${bootColor}" stroke="${colors.ink}" stroke-width="1.9"/>
    <path d="M ${cx - w * 0.4} ${h - 10} L ${cx + w * 0.29} ${h - 10}" stroke="${colors.ink}" stroke-width="2.2"/>
    <path d="M ${cx - w * 0.26} ${bootTop + h * 0.09} q ${w * 0.26} ${h * 0.03} ${w * 0.5} 0" fill="none" stroke="${colors.gold}" stroke-width="1.4" opacity="0.8"/>`
    : '';

  const body = `
    <path d="${outline}" fill="${colors.main}" stroke="${colors.ink}" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="${inner}" fill="${colors.second}" opacity="0.92"/>
    ${Array.from({ length: segments })
      .map(
        (_, index) => `
      <line x1="${cx - topHalf * 0.86}" y1="${(h * (index + 1)) / (segments + 1)}" x2="${cx + topHalf * 0.86}" y2="${(h * (index + 1)) / (segments + 1)}"
        stroke="${colors.ink}" stroke-width="1.4" opacity="0.5"/>`,
      )
      .join('')}
    ${bootPath}
    <circle cx="${cx}" cy="${Math.min(w * 0.2, 7)}" r="${Math.min(w * 0.17, 5.4)}" fill="${colors.gold}" stroke="${colors.ink}" stroke-width="1.4"/>
    <g id="${id}-joint"></g>
  `;
  return svgUrl(size, body);
}

function handSvg(colors) {
  const [w, h] = HAND;
  const body = `
    <path d="M16 6 q16 -6 24 6 l4 30 q2 16 -6 26 l-10 12 l-12 -6 l-8 -18 q-4 -20 8 -50 z"
      fill="${colors.skin}" stroke="${colors.ink}" stroke-width="2.2"/>
    <path d="M20 20 q10 4 16 12" fill="none" stroke="${colors.ink}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M18 38 q10 4 16 10" fill="none" stroke="${colors.ink}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M22 56 q8 2 14 8" fill="none" stroke="${colors.gold}" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="23" cy="9" r="4" fill="${colors.gold}" stroke="${colors.ink}" stroke-width="1.2"/>
  `;
  return svgUrl(HAND, body);
}

const crownFrom = (text = '') => {
  const value = String(text);
  if (/凤|冠|phoenix|crest/i.test(value)) return 'phoenix';
  if (/盔|helmet|armor/i.test(value)) return 'helmet';
  return 'cap';
};

const beardFrom = (text = '') => {
  const value = String(text);
  if (/无须|无髯|none|clean/i.test(value)) return 'none';
  if (/满|络腮|full/i.test(value)) return 'full';
  return 'long';
};

/** 主角将官的关节几何（来自 characters/general/manifest.json，逐关节调过） */
const BASE_NODES = [
  { id: 'skirt', part: 'skirt', parent: null, pivot: [105, 4], attach: [470, 392], tip: [105, 72], z: 7, angle: 0 },
  { id: 'torso', part: 'torso', parent: 'skirt', pivot: [69, 201], attach: [105, 4], tip: [78, 8], z: 8, angle: 0 },
  { id: 'head', part: 'head', parent: 'torso', pivot: [93, 182], attach: [78, 20], tip: [66, 6], z: 9, angle: 0 },
  { id: 'cape', part: 'cape', parent: 'torso', pivot: [158, 14], attach: [104, 18], tip: [24, 255], z: 1, angle: 0 },
  { id: 'uArmF', part: 'upperarm', parent: 'torso', pivot: [15, 6], attach: [92, 24], tip: [15, 95], z: 2, angle: -14 },
  { id: 'fArmF', part: 'forearm', parent: 'uArmF', pivot: [16, 8], attach: [15, 95], tip: [16, 99], z: 3, angle: 64 },
  { id: 'handF', part: 'hand', parent: 'fArmF', pivot: [23, 8], attach: [16, 99], tip: [20, 74], z: 4, angle: 12 },
  { id: 'thighF', part: 'thigh', parent: 'skirt', pivot: [33, 8], attach: [120, 140], tip: [33, 122], z: 5, angle: 12 },
  { id: 'shinF', part: 'lowerleg', parent: 'thighF', pivot: [51, 8], attach: [33, 122], tip: [50, 150], z: 6, angle: -6 },
  { id: 'thighN', part: 'thigh', parent: 'skirt', pivot: [33, 8], attach: [84, 140], tip: [33, 122], z: 10, angle: -10 },
  { id: 'shinN', part: 'lowerleg', parent: 'thighN', pivot: [51, 8], attach: [33, 122], tip: [50, 150], z: 11, angle: 8 },
  { id: 'uArmN', part: 'upperarm', parent: 'torso', pivot: [15, 6], attach: [58, 26], tip: [15, 95], z: 12, angle: -16 },
  { id: 'fArmN', part: 'forearm', parent: 'uArmN', pivot: [16, 8], attach: [15, 95], tip: [16, 99], z: 13, angle: 52 },
  { id: 'handN', part: 'hand', parent: 'fArmN', pivot: [23, 8], attach: [16, 99], tip: [20, 74], z: 14, angle: 18 },
];

const BASE_POSES = {
  rest: { label: '持剑拄地', angles: {} },
  salute: {
    label: '拱手抱拳',
    angles: { torso: 8, head: 6, uArmN: -42, fArmN: 82, handN: 6, uArmF: -34, fArmF: 96, handF: -4 },
  },
  brandish: {
    label: '举剑亮相',
    angles: { torso: -4, head: -4, uArmN: -148, fArmN: -14, handN: 6, uArmF: 22, fArmF: 26, thighN: -16, shinN: 12, thighF: 16, shinF: -8 },
  },
  stride: {
    label: '迈步前行',
    angles: { torso: 4, head: 2, thighN: -30, shinN: 24, thighF: 26, shinF: -20, uArmN: -30, fArmN: 44, uArmF: 26, fArmF: 26, cape: -10 },
  },
};

const BASE_IDLE = {
  cape: [6, 0.9, 0],
  head: [2.2, 0.8, 0.6],
  torso: [1.4, 0.7, 0.2],
  uArmN: [2.5, 0.9, 1],
  fArmN: [3, 1, 1.4],
  uArmF: [2.5, 0.9, 2],
  fArmF: [3, 1, 2.4],
  handN: [3, 1.1, 0.4],
  handF: [3, 1.1, 1.2],
};

/**
 * 生成一个程序化皮影角色。
 * @param {{title?:string, palette?:string[], features?:object, mode?:'fast'|'refined'}} input
 * @returns {{manifest:object, parts:object, notes:string}}
 */
export function buildProceduralCharacter(input = {}) {
  const palette = Array.isArray(input.palette) ? input.palette : [];
  const colors = pickColors(palette);
  const features = input.features || {};
  const style = {
    crown: crownFrom(features.headwear),
    beard: beardFrom(features.facialHair),
  };
  const refined = input.mode === 'refined';
  // 精致模式在甲片/披风上多加一层纹样，快速模式保持简洁
  const detail = refined ? 1.25 : 1;

  const parts = {
    head: { src: headSvg(colors, style), size: [...HEAD] },
    torso: { src: torsoSvg(colors, { detail }), size: [...TORSO] },
    skirt: { src: skirtSvg(colors), size: [...SKIRT] },
    cape: { src: capeSvg(colors), size: [...CAPE] },
    upperarm: { src: limbSvg(UPPER_ARM, colors, { id: 'up', segments: 2 }), size: [...UPPER_ARM] },
    forearm: { src: limbSvg(FOREARM, colors, { id: 'fore', segments: 2 }), size: [...FOREARM] },
    hand: { src: handSvg(colors), size: [...HAND] },
    thigh: { src: limbSvg(THIGH, colors, { id: 'thigh', segments: 2 }), size: [...THIGH] },
    lowerleg: { src: limbSvg(LOWER_LEG, colors, { id: 'leg', segments: 1, boot: true }), size: [...LOWER_LEG] },
  };

  const title = String(input.title || 'AI 皮影').slice(0, 20);
  const manifest = {
    schema: 'piying-rig/1',
    name: 'ai_puppet',
    title,
    description: `${input.mode === 'refined' ? '精致' : '快速'}模式 · 本地皮影合成器生成（配色取自上传照片）`,
    stage: { width: 900, height: 860, background: '#f2e3c4', fit: { marginX: 44, marginY: 150, min: 0.3, max: 1 } },
    parts: Object.fromEntries(Object.entries(parts).map(([key, part]) => [key, { src: part.src, size: [...part.size] }])),
    nodes: BASE_NODES.map((node) => ({ ...node, pivot: [...node.pivot], attach: [...node.attach], tip: [...node.tip] })),
    poses: JSON.parse(JSON.stringify(BASE_POSES)),
    idle: { ...BASE_IDLE },
  };

  return {
    manifest,
    parts,
    notes: `本地合成 · 主色 ${colors.main} / ${colors.second} · ${style.crown} 冠 · ${style.beard} 髯口`,
  };
}

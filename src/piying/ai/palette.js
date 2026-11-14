/**
 * 实现功能：AI 皮影工坊的图片预处理与配色采样
 * 职责：把用户选的照片转成可上传的 dataURL（等比缩到 ≤1024，控制体积），
 *       并抽出 3-5 个主色 —— 这些颜色会作为「特征」同时喂给图像生成模型与本地皮影合成器，
 *       让生成的皮影保留原人物的服饰色系。
 */

const MAX_SIDE = 1024;

export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片解码失败，请换一张 JPG / PNG / WebP'));
    image.src = src;
  });

/** 等比缩放到最长边 ≤ maxSide，返回 dataURL 与尺寸 */
export function drawToCanvas(image, maxSide = MAX_SIDE) {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const ratio = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * ratio));
  const height = Math.max(1, Math.round(naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  return { canvas, ctx, width, height };
}

const toHex = (r, g, b) =>
  `#${[r, g, b].map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('')}`;

/**
 * 主色采样：把像素量化到 32 级立方体统计频次，剔除极亮/极暗与低饱和，
 * 再按出现次数取前 count 个，并保证彼此有一定色差（避免全是同一个色相的深浅）。
 */
export function extractPalette(ctx, width, height, count = 4) {
  const { data } = ctx.getImageData(0, 0, width, height);
  const buckets = new Map();
  const step = 3;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha < 180) continue;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 246 && min > 236) continue; // 近白背景
      if (max < 26) continue; // 近黑死区
      if (max - min < 16) continue; // 低饱和（灰阶）
      const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.n += 1;
      buckets.set(key, bucket);
    }
  }
  const ranked = [...buckets.values()]
    .map((bucket) => ({ r: Math.round(bucket.r / bucket.n), g: Math.round(bucket.g / bucket.n), b: Math.round(bucket.b / bucket.n), n: bucket.n }))
    .sort((a, b) => b.n - a.n);

  const picked = [];
  for (const color of ranked) {
    if (picked.length >= count) break;
    const distinct = picked.every((item) => Math.abs(item.r - color.r) + Math.abs(item.g - color.g) + Math.abs(item.b - color.b) > 60);
    if (distinct) picked.push(color);
  }
  if (!picked.length) picked.push({ r: 150, g: 60, b: 45 });
  return picked.map((color) => toHex(color.r, color.g, color.b));
}

/**
 * 处理用户上传的图片文件：缩放、转 dataURL、抽色。
 * @param {File|Blob} file
 * @returns {Promise<{dataUrl:string,width:number,height:number,palette:string[]}>}
 */
export async function prepareImagePayload(file) {
  if (!file) throw new Error('请先选择一张人物照片');
  if (!/^image\//.test(file.type || '')) throw new Error('只能上传图片文件（JPG / PNG / WebP）');
  if (file.size > 12 * 1024 * 1024) throw new Error('图片太大了（上限 12MB），请先压缩再上传');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const { ctx, width, height } = drawToCanvas(image);
    if (width < 180 || height < 180) throw new Error('图片分辨率太低（短边至少 180px），无法提取皮影细节');
    const palette = extractPalette(ctx, width, height, 4);
    // 用 JPEG 上传，体积通常只有原图的 1/5，同时保留足够的配色信息
    const dataUrl = ctx.canvas.toDataURL('image/jpeg', 0.92);
    return { dataUrl, width, height, palette };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

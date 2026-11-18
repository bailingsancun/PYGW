/**
 * 实现功能：把「洋红底零件图」拆成独立的透明 PNG 部件（AI 图片转皮影的前端后处理）
 * 职责：对应 piying-pipeline 的 tools/segment.py + tools/extract.py 在浏览器里的等价实现：
 *   1) 估计纯色背景（洋红 #FF00FF，也兼容模型给偏了色的纯色背景）；
 *   2) 从画面边缘做洪水填充标记背景，避免人物身上同色区域被误挖；
 *   3) 前景做连通域标记，按面积过滤碎片，得到一块块独立部件；
 *   4) 每个部件裁到自身包围盒、背景转透明，输出 PNG dataURL。
 * 纯前端零依赖，几十万像素的图在几十毫秒到几百毫秒内完成。
 */

const MAX_SIDE = 1280;

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('零件图解码失败'));
    image.src = src;
  });

/** 取四角小方块的平均色作为背景色估计 */
function estimateBackground(data, width, height) {
  const sample = (sx, sy) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = sy; y < Math.min(sy + 6, height); y += 1) {
      for (let x = sx; x < Math.min(sx + 6, width); x += 1) {
        const index = (y * width + x) * 4;
        r += data[index];
        g += data[index + 1];
        b += data[index + 2];
        n += 1;
      }
    }
    return n ? { r: r / n, g: g / n, b: b / n } : { r: 255, g: 0, b: 255 };
  };
  const corners = [
    sample(0, 0),
    sample(Math.max(0, width - 6), 0),
    sample(0, Math.max(0, height - 6)),
    sample(Math.max(0, width - 6), Math.max(0, height - 6)),
  ];
  return {
    r: corners.reduce((sum, item) => sum + item.r, 0) / corners.length,
    g: corners.reduce((sum, item) => sum + item.g, 0) / corners.length,
    b: corners.reduce((sum, item) => sum + item.b, 0) / corners.length,
  };
}

const distance = (data, index, color) =>
  Math.abs(data[index] - color.r) + Math.abs(data[index + 1] - color.g) + Math.abs(data[index + 2] - color.b);

/** 生成背景可能有纸纹和明暗变化，饱和底色按色度补充判断，避免整张图连成一块。 */
const matchesBackground = (data, index, color, tolerance) => {
  if (distance(data, index, color) <= tolerance) return true;
  const backgroundMax = Math.max(color.r, color.g, color.b);
  const backgroundMin = Math.min(color.r, color.g, color.b);
  // 灰白背景继续使用原有绝对容差，避免把人物的黑白部件当背景。
  if (backgroundMax < 64 || (backgroundMax - backgroundMin) / backgroundMax < 0.4) return false;
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const pixelMax = Math.max(r, g, b);
  const pixelMin = Math.min(r, g, b);
  if (pixelMax < 32 || (pixelMax - pixelMin) / pixelMax < 0.35) return false;
  if (color.r > color.g * 1.5 && color.b > color.g * 1.5
    && r > g + 25 && b > g + 25 && Math.min(r, b) / pixelMax > 0.45) return true;
  const chromaDistance = Math.abs(r / pixelMax - color.r / backgroundMax)
    + Math.abs(g / pixelMax - color.g / backgroundMax)
    + Math.abs(b / pixelMax - color.b / backgroundMax);
  return chromaDistance <= tolerance / 255;
};

/**
 * 分割零件图。
 * @param {string} dataUrl 纯色底零件图
 * @param {{tolerance?:number, minAreaRatio?:number, maxParts?:number}} options
 * @returns {Promise<{width:number,height:number,palette:string[],parts:Array}>}
 */
export async function segmentPartsSheet(dataUrl, options = {}) {
  const tolerance = options.tolerance ?? 96;
  const minAreaRatio = options.minAreaRatio ?? 0.0012;
  const maxParts = options.maxParts ?? 16;

  const image = await loadImage(dataUrl);
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const ratio = Math.min(1, MAX_SIDE / Math.max(naturalWidth, naturalHeight));
  const width = Math.max(1, Math.round(naturalWidth * ratio));
  const height = Math.max(1, Math.round(naturalHeight * ratio));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const total = width * height;

  const background = estimateBackground(data, width, height);

  // 1) 洪水填充：只从边缘出发，把「连到画面外」的纯色算作背景
  const isBg = new Uint8Array(total);
  const stack = new Int32Array(total);
  let top = 0;
  const pushIfBg = (x, y) => {
    const pixel = y * width + x;
    if (isBg[pixel]) return;
    if (data[pixel * 4 + 3] < 24) {
      isBg[pixel] = 1;
      stack[top++] = pixel;
      return;
    }
    if (matchesBackground(data, pixel * 4, background, tolerance)) {
      isBg[pixel] = 1;
      stack[top++] = pixel;
    }
  };
  for (let x = 0; x < width; x += 1) {
    pushIfBg(x, 0);
    pushIfBg(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    pushIfBg(0, y);
    pushIfBg(width - 1, y);
  }
  while (top > 0) {
    const pixel = stack[--top];
    const x = pixel % width;
    const y = (pixel - x) / width;
    if (x > 0) pushIfBg(x - 1, y);
    if (x < width - 1) pushIfBg(x + 1, y);
    if (y > 0) pushIfBg(x, y - 1);
    if (y < height - 1) pushIfBg(x, y + 1);
  }
  // 洋红色是部件图的专用色键，雕镂内部不与边缘相连的底色也应透明。
  if (background.r > background.g * 1.5 && background.b > background.g * 1.5) {
    for (let pixel = 0; pixel < total; pixel += 1) {
      if (matchesBackground(data, pixel * 4, background, tolerance)) isBg[pixel] = 1;
    }
  }

  // 2) 前景连通域标记
  const labels = new Int32Array(total).fill(-1);
  const stats = [];
  let label = 0;
  // 复用同一块 BFS 队列：噪声图可达上千连通域，逐域 new Int32Array(total) 会把内存放大数十倍
  const queue = new Int32Array(total);
  const MAX_COMPONENTS = 2048;
  for (let pixel = 0; pixel < total; pixel += 1) {
    if (isBg[pixel] || labels[pixel] !== -1) continue;
    if (label >= MAX_COMPONENTS) break;
    let head = 0;
    let tail = 0;
    queue[tail++] = pixel;
    labels[pixel] = label;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = (current - x) / width;
      area += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const neighbors = [
        x > 0 ? current - 1 : -1,
        x < width - 1 ? current + 1 : -1,
        y > 0 ? current - width : -1,
        y < height - 1 ? current + width : -1,
      ];
      for (const next of neighbors) {
        if (next < 0 || isBg[next] || labels[next] !== -1) continue;
        labels[next] = label;
        queue[tail++] = next;
      }
    }
    stats.push({ label, area, minX, minY, maxX, maxY });
    label += 1;
  }

  stats.sort((a, b) => b.area - a.area);
  const minArea = Math.max(64, total * minAreaRatio);
  let kept = stats.filter((item) => item.area >= minArea).slice(0, maxParts);
  if (options.layout === 'grid-3x3-v1') {
    labels.fill(-1);
    const keys = ['head', 'torso', 'skirt', 'cape', 'upperarm', 'forearm', 'hand', 'thigh', 'lowerleg'];
    const cells = keys.map((key, cell) => ({ label: cell, key, area: 0, minX: width, minY: height, maxX: 0, maxY: 0 }));
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        if (isBg[pixel]) continue;
        // 去掉模型偶尔画出的格线，避免格线改变部件边界、造成装配偏移。
        const cellX = (x * 3 / width) % 1;
        const cellY = (y * 3 / height) % 1;
        if (cellX < 0.035 || cellX > 0.965 || cellY < 0.035 || cellY > 0.965) continue;
        const cell = Math.min(2, Math.floor(y * 3 / height)) * 3 + Math.min(2, Math.floor(x * 3 / width));
        const item = cells[cell];
        labels[pixel] = cell;
        item.area += 1;
        item.minX = Math.min(item.minX, x); item.maxX = Math.max(item.maxX, x);
        item.minY = Math.min(item.minY, y); item.maxY = Math.max(item.maxY, y);
      }
    }
    // 九宫格的小手部件占整图比例很小，使用格子面积而非整图面积过滤。
    const cellMinArea = Math.max(64, (total / 9) * 0.004);
    kept = cells.filter((item) => item.area >= cellMinArea);
  }

  // 3) 逐块导出透明 PNG
  const parts = [];
  for (const item of kept) {
    const partWidth = item.maxX - item.minX + 1;
    const partHeight = item.maxY - item.minY + 1;
    const partCanvas = document.createElement('canvas');
    partCanvas.width = partWidth;
    partCanvas.height = partHeight;
    const partCtx = partCanvas.getContext('2d');
    const out = partCtx.createImageData(partWidth, partHeight);
    for (let y = item.minY; y <= item.maxY; y += 1) {
      for (let x = item.minX; x <= item.maxX; x += 1) {
        const source = y * width + x;
        if (labels[source] !== item.label) continue;
        const target = ((y - item.minY) * partWidth + (x - item.minX)) * 4;
        const from = source * 4;
        out.data[target] = data[from];
        out.data[target + 1] = data[from + 1];
        out.data[target + 2] = data[from + 2];
        out.data[target + 3] = 255;
      }
    }
    partCtx.putImageData(out, 0, 0);
    parts.push({
      key: item.key,
      x: item.minX,
      y: item.minY,
      width: partWidth,
      height: partHeight,
      area: item.area,
      aspect: partWidth / partHeight,
      dataUrl: partCanvas.toDataURL('image/png'),
    });
  }

  return { width, height, palette: [], parts };
}

/**
 * 把任意部件图缩放到目标尺寸（保持比例、居中、透明底），用于把 AI 零件贴到标准骨架槽位。
 * @param {string} dataUrl
 * @param {number} targetWidth
 * @param {number} targetHeight
 */
export async function fitPartToSlot(dataUrl, targetWidth, targetHeight, { fill = false } = {}) {
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(targetWidth));
  canvas.height = Math.max(1, Math.round(targetHeight));
  const ctx = canvas.getContext('2d');
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  if (fill) {
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }
  const scale = Math.min(canvas.width / naturalWidth, canvas.height / naturalHeight);
  const drawWidth = naturalWidth * scale;
  const drawHeight = naturalHeight * scale;
  ctx.drawImage(image, (canvas.width - drawWidth) / 2, (canvas.height - drawHeight) / 2, drawWidth, drawHeight);
  return canvas.toDataURL('image/png');
}

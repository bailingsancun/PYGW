/**
 * 实现功能：QTE 的指针轨迹判定（摄像头不可用时的降级输入）
 * 职责：把玩家在画面上「按住拖动」的轨迹做几何分析，判断是否完成了对应的招式动作：
 *   - thrust 前突刺 → 一笔快速、笔直的横向/向前直刺
 *   - swing  下劈   → 一笔自上而下、接近垂直的挥斩
 *   - x      X 交叉 → 两笔方向相反、彼此交叉的斜线（双臂交叉成 X）
 * 为什么需要它：视觉识别依赖摄像头与模型下载，在无摄像头 / 拒绝授权 / 自动化环境里
 * 必须还有一条可完成的输入路径，否则「校准失败就回退」会让过场永远过不去。
 * 判定口径与 gestures.js 的动作定义对齐（同一个动作名，两套输入）。
 */

/** 归一化单位：屏幕短边的 25%，让不同分辨率下的阈值手感一致 */
const unitOf = (width, height) => Math.max(60, Math.min(width, height) * 0.25);

/** 轨迹的几何量：位移、路径长度、直线度、时长、速度 */
export function measureStroke(points = []) {
  if (points.length < 2) return null;
  const start = points[0];
  const end = points[points.length - 1];
  let pathLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    pathLength += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy);
  const duration = Math.max(1, end.t - start.t);
  const mid = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  return {
    points,
    start,
    end,
    mid,
    dx,
    dy,
    distance,
    pathLength,
    duration,
    straightness: pathLength > 0 ? distance / pathLength : 0,
    speed: pathLength / duration,
  };
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** 单笔能识别出的动作（x 需要两笔，见 classifySequence） */
export function classifyStroke(stroke, width, height) {
  if (!stroke) return null;
  const unit = unitOf(width, height);
  const dx = stroke.dx / unit;
  const dy = stroke.dy / unit;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  // 太小的笔划当噪声（误触 / 抖动）
  if (stroke.distance / unit < 0.55) return null;

  // 下劈：明显向下、接近垂直、够快、够直
  if (dy > 1.05 && adx < 0.72 * dy && stroke.duration < 900 && stroke.straightness > 0.55) {
    const confidence = clamp01(0.55 + 0.2 * clamp01((dy - 1.05) / 1.6) + 0.2 * stroke.straightness);
    return { type: 'swing', confidence, source: 'trace', meta: { dx, dy, unit } };
  }

  // 前突刺：明显横向（或向上"朝前"），够直、够快
  const horizontal = adx > 0.78 && ady < 0.85 * adx;
  const forward = dy < -1.05 && adx < 0.8 * -dy;
  if ((horizontal || forward) && stroke.duration < 800 && stroke.straightness > 0.66) {
    const magnitude = horizontal ? adx : -dy;
    const confidence = clamp01(0.55 + 0.2 * clamp01((magnitude - 0.78) / 1.6) + 0.2 * stroke.straightness);
    return { type: 'thrust', confidence, source: 'trace', meta: { dx, dy, unit } };
  }

  return null;
}

/**
 * 两笔组合判定 X 交叉。
 * 关键几何：X 是「一撇一捺」——两条斜线的 dx 反号、斜率一正一负（"/" 与 "\"）。
 * 注意 dy 不能要求反号：自上而下画时两笔都向下（dy 同为正），自下而上时都为负。
 * @param {Array} strokes 最近的两笔（按时间顺序）
 */
export function classifyCross(strokes, width, height) {
  if (!Array.isArray(strokes) || strokes.length < 2) return null;
  const first = strokes[strokes.length - 2];
  const second = strokes[strokes.length - 1];
  if (!first || !second) return null;
  if (second.start.t - first.end.t > 2200) return null;

  const unit = unitOf(width, height);
  const a = { dx: first.dx / unit, dy: first.dy / unit };
  const b = { dx: second.dx / unit, dy: second.dy / unit };

  // 两笔都要够长
  if (first.distance / unit < 0.9 || second.distance / unit < 0.9) return null;

  // 必须是斜线（不能接近水平或垂直），且左右方向相反
  const slopeA = a.dy / (a.dx || 1e-6);
  const slopeB = b.dy / (b.dx || 1e-6);
  if (Math.abs(slopeA) < 0.5 || Math.abs(slopeB) < 0.5) return null;
  if (Math.abs(slopeA) > 4 || Math.abs(slopeB) > 4) return null;
  if (!(a.dx * b.dx < 0)) return null;
  // 一撇一捺：斜率一正一负（平行同向的两条线不算 X）
  if (!(slopeA * slopeB < 0)) return null;

  // 两笔的中点要靠近，否则是分开的两条斜线而不是交叉的 X
  const gap = Math.hypot(first.mid.x - second.mid.x, first.mid.y - second.mid.y) / unit;
  if (gap > 1.35) return null;

  const confidence = clamp01(
    0.62 +
      0.18 * clamp01((1.35 - gap) / 1.1) +
      0.12 * Math.min(first.straightness ?? 0, second.straightness ?? 0),
  );
  return { type: 'x', confidence, source: 'trace', meta: { gap, unit } };
}

/** 一笔结束后能形成的最优判定（x 交叉需要传入最近两笔） */
export function classifySequence(strokes, width, height, target) {
  const cross = classifyCross(strokes, width, height);
  if (cross && (!target || target === 'x')) return cross;
  const last = strokes[strokes.length - 1];
  const single = classifyStroke(last, width, height);
  if (single && (!target || target === single.type)) return single;
  return null;
}

/**
 * 轨迹采集器：负责把 pointerdown/move/up 事件攒成「笔划」，并丢掉过短的抖动。
 * 页面把它挂在 QTE 面板上，抽出笔划后交给 classifySequence 判定。
 */
export class TracePad {
  constructor({ target, onStroke, onProgress, minStep = 2.2, maxPoints = 400 }) {
    this.target = target;
    this.onStroke = onStroke || (() => {});
    this.onProgress = onProgress || (() => {});
    this.minStep = minStep;
    this.maxPoints = maxPoints;
    this.points = [];
    this.active = false;
    this.strokes = [];
    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
  }

  attach() {
    if (!this.target) return this;
    this.target.addEventListener('pointerdown', this._onDown);
    this.target.addEventListener('pointermove', this._onMove);
    this.target.addEventListener('pointerup', this._onUp);
    this.target.addEventListener('pointercancel', this._onUp);
    this.target.addEventListener('pointerleave', this._onUp);
    return this;
  }

  detach() {
    if (!this.target) return this;
    this.target.removeEventListener('pointerdown', this._onDown);
    this.target.removeEventListener('pointermove', this._onMove);
    this.target.removeEventListener('pointerup', this._onUp);
    this.target.removeEventListener('pointercancel', this._onUp);
    this.target.removeEventListener('pointerleave', this._onUp);
  }

  reset() {
    this.points = [];
    this.strokes = [];
    this.active = false;
  }

  _local(event) {
    const rect = this.target.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, t: performance.now() };
  }

  _onDown(event) {
    // 面板上的按钮/链接不当作画笔起点，避免点「开启摄像头」被记成一笔
    if (event.target?.closest?.('button, a, input, [data-no-trace]')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.active = true;
    this.points = [this._local(event)];
    this.onProgress(this.points);
    try {
      this.target.setPointerCapture?.(event.pointerId);
    } catch {
      /* 捕获失败不影响画线 */
    }
  }

  _onMove(event) {
    if (!this.active) return;
    const point = this._local(event);
    const last = this.points[this.points.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < this.minStep) return;
    this.points.push(point);
    if (this.points.length > this.maxPoints) this.points.shift();
    this.onProgress(this.points);
  }

  _onUp() {
    if (!this.active) return;
    this.active = false;
    const points = this.points;
    this.points = [];
    this.onProgress([]);
    const stroke = measureStroke(points);
    if (!stroke) return;
    this.strokes.push(stroke);
    if (this.strokes.length > 4) this.strokes.shift();
    this.onStroke(stroke, this.strokes);
  }
}

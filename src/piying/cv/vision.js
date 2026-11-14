/**
 * 实现功能：视觉检测运行时（摄像头 + MediaPipe 姿态 + 三动作识别）
 * 职责：把 CV 目录里三个测试完全的模块（feed / pose-engine / gestures）装成一个可复用的服务：
 *   - start()：开摄像头 → 懒加载 tasks-vision 与姿态模型 → 起检测循环
 *   - 每帧回调姿态（供「人影动作同步」驱动皮影关节）
 *   - 识别到动作时回调（供 QTE 校准判定）
 *   - 可选把摄像头画面 + 骨架画到一张预览 canvas 上
 * 说明：身入影幕里 QTE 与动作同步共用同一个实例，避免重复开摄像头、重复下载模型。
 */
import { FeedSource } from './feed.js';
import { PoseEngine } from './pose-engine.js';
import { GestureDetector } from './gestures.js';
import { CONNECTIONS, LM } from './landmarks.js';

const DETECT_INTERVAL = 32; // 约 30fps 推理，够用且不吃满 CPU
const DETECT_WIDTH = 480;

export class VisionService {
  /**
   * @param {object} options
   * @param {(status:object)=>void} [options.onStatus] 模型加载 / 摄像头状态
   * @param {(event:object)=>void} [options.onGesture] 识别到动作（x/thrust/swing）
   * @param {(frame:object)=>void} [options.onPose] 每帧姿态（可能 landmarks 为 null）
   * @param {(message:string)=>void} [options.onNotice]
   */
  constructor(options = {}) {
    this.onStatus = options.onStatus || (() => {});
    this.onGesture = options.onGesture || (() => {});
    this.onPose = options.onPose || (() => {});
    this.onNotice = options.onNotice || (() => {});

    this.feed = new FeedSource();
    this.detector = new GestureDetector({ onGesture: (event) => this.onGesture(event) });
    this.engine = null;
    this.mirror = true;
    this.last = null;
    this._active = false;
    this._raf = 0;
    this._lastDetect = 0;
    this._detectCanvas = null;
    this._preview = null;
    this._model = 'lite';
    this._starting = null;
  }

  get active() {
    return this._active;
  }

  get ready() {
    return Boolean(this._active && this.engine?.ready);
  }

  get video() {
    return this.feed.video;
  }

  get status() {
    return this.detector.status;
  }

  /** 识别「X 交叉」的进入阈值，QTE 用它判断玩家是否已经提前摆好动作 */
  get xEnter() {
    return this.detector?.options?.xEnter ?? 0.62;
  }

  /** 预览目标 canvas（由组件注册；不注册就不画预览） */
  attachPreview(canvas) {
    this._preview = canvas || null;
    this._sizePreview();
  }

  detachPreview() {
    this._preview = null;
  }

  _sizePreview() {
    if (!this._preview) return;
    const rect = this._preview.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(120, Math.round((rect.width || 240) * dpr));
    const height = Math.max(90, Math.round((rect.height || 180) * dpr));
    if (this._preview.width !== width) this._preview.width = width;
    if (this._preview.height !== height) this._preview.height = height;
  }

  _ensureDetectCanvas() {
    if (!this._detectCanvas) {
      this._detectCanvas = document.createElement('canvas');
    }
    const aspect = this.feed.aspect || 16 / 9;
    const width = DETECT_WIDTH;
    const height = Math.round(DETECT_WIDTH / aspect);
    if (this._detectCanvas.width !== width) this._detectCanvas.width = width;
    if (this._detectCanvas.height !== height) this._detectCanvas.height = height;
    return this._detectCanvas.getContext('2d', { willReadFrequently: false });
  }

  /**
   * 开启视觉检测。重复调用会复用同一个进行中的启动过程。
   * @param {{model?:'full'|'lite', deviceId?:string}} options
   */
  async start({ model = 'lite', deviceId } = {}) {
    if (this._active) return this.engine;
    if (this._starting) return this._starting;

    this._starting = (async () => {
      this.onStatus({ state: 'camera', message: '正在请求摄像头权限…' });
      await this.feed.openCamera(deviceId);
      const aspect = this.feed.aspect || 16 / 9;
      this.onStatus({ state: 'camera', message: `摄像头已开启（${Math.round(aspect * 100) / 100}:1），正在加载姿态模型…` });

      if (!this.engine || (this.engine.model !== model && !this.engine.loading)) {
        this.engine = new PoseEngine({ onStatus: (status) => this.onStatus(status) });
        await this.engine.init(model);
      }
      this._model = model;
      this._active = true;
      this._lastDetect = 0;
      if (this._preview) this._sizePreview();
      this._raf = requestAnimationFrame(this._frame);
      return this.engine;
    })();

    try {
      return await this._starting;
    } catch (error) {
      this._active = false;
      this.feed.stop();
      this.onStatus({ state: 'error', message: error?.message || String(error) });
      throw error;
    } finally {
      this._starting = null;
    }
  }

  stop() {
    this._active = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    this.feed.stop();
    this.detector.reset();
    this.last = null;
    this.onStatus({ state: 'idle', message: '视觉检测已关闭' });
  }

  close() {
    this.stop();
    if (this.engine) {
      this.engine.close();
      this.engine = null;
    }
  }

  /** QTE 每一式开始时清掉动作锁，避免上一式的收势动作把这一式压住 */
  clearActionLock() {
    this.detector.clearActionLock();
  }

  /** 画面翻转（自拍镜像）；默认开启，让预览与本人左右一致 */
  setMirror(on) {
    this.mirror = Boolean(on);
  }

  _frame = (now) => {
    if (!this._active) return;
    this._raf = requestAnimationFrame(this._frame);

    if (now - this._lastDetect < DETECT_INTERVAL) {
      this._drawPreview();
      return;
    }
    this._lastDetect = now;

    const ctx = this._ensureDetectCanvas();
    const painted = this.feed.draw(ctx, this._detectCanvas.width, this._detectCanvas.height, this.mirror);
    if (!painted) {
      this._drawPreview();
      return;
    }
    let result = null;
    if (this.engine?.ready) {
      result = this.engine.detect(this._detectCanvas, now);
      const aspect = this._detectCanvas.width / this._detectCanvas.height;
      const status = this.detector.update({
        t: now,
        landmarks: result?.landmarks ?? null,
        worldLandmarks: result?.worldLandmarks ?? null,
        aspect,
      });
      this.last = { landmarks: result?.landmarks ?? null, status, aspect, at: now };
      this.onPose(this.last);
    }
    this._drawPreview(result?.landmarks ?? null);
  };

  _drawPreview(landmarks = this.last?.landmarks ?? null) {
    const canvas = this._preview;
    if (!canvas) return;
    if (canvas.width < 8 || canvas.height < 8) this._sizePreview();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    this.feed.draw(ctx, width, height, this.mirror);
    if (landmarks) this._drawSkeleton(ctx, landmarks, width, height);
    ctx.restore();
  }

  /** 精简骨架：只画肩/肘/腕/髋/膝/踝与头，够表达「检测到了」 */
  _drawSkeleton(ctx, landmarks, width, height) {
    const px = (point) => [point.x * width, point.y * height];
    const visible = (index) => (landmarks[index]?.visibility ?? 1) >= 0.3;
    ctx.lineWidth = Math.max(1.6, width / 220);
    ctx.strokeStyle = 'rgba(255, 214, 138, 0.85)';
    ctx.fillStyle = 'rgba(255, 233, 189, 0.95)';
    const groups = [
      [11, 12, 13, 14, 15, 16],
      [23, 24, 25, 26, 27, 28],
      [11, 23],
      [12, 24],
      [0, 11],
      [0, 12],
    ];
    for (const [a, b] of groups) {
      if (!visible(a) || !visible(b)) continue;
      const [ax, ay] = px(landmarks[a]);
      const [bx, by] = px(landmarks[b]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    for (const [a, b] of CONNECTIONS) {
      if (a > 16 || b > 16) continue;
      if (!visible(a) || !visible(b)) continue;
      const [ax, ay] = px(landmarks[a]);
      const [bx, by] = px(landmarks[b]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const [nx, ny] = px(landmarks[LM.NOSE]);
    if (visible(LM.NOSE)) {
      ctx.beginPath();
      ctx.arc(nx, ny, Math.max(3, width / 90), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

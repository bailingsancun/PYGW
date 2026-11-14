/**
 * 实现功能：三动作识别（X 交叉 / 前突刺 / 下劈），只依赖上半身 33 点
 * 来源：testdemo/CV/js/gestures.js（已测试完全），逻辑原样迁移。
 * 用途：身入影幕的 QTE 校准判定 + 「人影动作同步」的目标动作识别。
 */
/**
 * 三动作识别（只依赖上半身）
 * ---------------------------------------------------------------------------
 * 输入：MediaPipe PoseLandmarker 输出的 33 点归一化坐标（+ 可选 world 米制坐标）。
 * 输出：x / thrust / swing 三种动作事件 + 实时姿态读数。
 *
 * 为什么只用上半身
 *   摄像头常常只拍到上半身，MediaPipe 对画面外的髋/腿会给出不可靠的猜测。
 *   本识别器只使用：鼻/耳/肩/肘/腕（0、7、8、11–22），完全不读 23–32。
 *   尺度用“上臂长 + 头肩距 + 肩宽”组合，因此站近、只露上半身、正面/侧面都稳定。
 *
 * 动作定义
 *   1. x      —— 双手举起、小臂交叉成 X 状（双腕过肩、屈肘、腕高于肘、身前靠近/交叉）
 *   2. thrust —— 单手或双手由屈臂变为直臂、向前突刺（3D 肘角 + 腕部 3D 位移）
 *   3. swing  —— 单手自上而下大幅挥动（从肩上方落到肩下方，落差按上臂长归一化）
 *
 * 设计要点
 *   - 屏幕尺度 bodyScale = max(上臂长, 0.75×头肩距, 0.35×肩宽)，只依赖上半身；
 *   - 三维尺度 worldScale = 上臂长（米），用于世界坐标位移/落差/速度；
 *   - 用 worldLandmarks 算三维肘角与位移，正面/侧面统一，不依赖面朝方向；
 *   - 视角只作 HUD 参考，不参与动作判定；
 *   - 所有动作都有保持时间/冷却，避免同一动作重复触发。
 */

import {
  LM,
  angleAt,
  clamp,
  clamp01,
  dist2,
  dist3,
  median,
  mid,
  toScreenPoint,
} from './landmarks.js';

export const GESTURES = {
  x: { key: 'x', name: '双臂上举交叉成 X', short: 'X 交叉' },
  thrust: { key: 'thrust', name: '屈臂变直臂向前突刺', short: '前突刺' },
  swing: { key: 'swing', name: '单臂自上而下挥斩', short: '下劈' },
};

export const GESTURE_ORDER = ['x', 'thrust', 'swing'];

const DEFAULTS = {
  minVisibility: 0.3,
  minBodyScale: 0.04, // 屏幕单位（约画面高度的 4%）
  historySeconds: 1.5,
  viewFrontRatio: 1.15, // 肩宽 / 上半身尺度，仅作 HUD 参考
  viewSideRatio: 0.75,
  viewSamples: 7,
  smoothTau: 0.05,

  xEnter: 0.62,
  xExit: 0.42,
  xHoldMs: 220,
  xCooldownMs: 1100,

  // 动作互斥：任一动作触发后，锁定其他动作
  actionLockMs: 900,
  xReleaseLockMs: 900,

  thrustCooldownMs: 1100,
  swingCooldownMs: 1100,
};

function bentScore(angle) {
  if (angle <= 18 || angle >= 168) return 0;
  if (angle < 45) return clamp01((angle - 18) / 27);
  if (angle > 150) return clamp01((168 - angle) / 18);
  return 1;
}

export class GestureDetector {
  constructor(options = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.onGesture = this.options.onGesture ?? null;
    this.events = [];
    this.reset();
  }

  reset() {
    this._history = [];
    this._smoothed = null;
    this._worldSmoothed = null;
    this._lastTime = null;
    this._viewSamples = [];
    this._view = 'unknown';
    this._xSince = null;
    this._xArmed = true;
    this._activeGesture = null;
    this._lockUntil = 0;
    this._lastEmit = { x: -1e9, thrust: -1e9, swing: -1e9 };
    this._lastEvent = { x: null, thrust: null, swing: null };
    this._lastValidAt = null;
    this._thrustArm = null;
    this._events = [];
    this._status = {
      valid: false,
      upperBodyOnly: true,
      view: 'unknown',
      viewRatio: 0,
      bodyScale: 0,
      scores: { x: 0, thrust: 0, swing: 0 },
      arms: null,
      lastEvent: this._lastEvent,
      events: this._events,
    };
  }

  get status() {
    return this._status;
  }

  /** 最近的识别事件（最多 40 条，供 HUD 滚动显示）。 */
  get recentEvents() {
    return this._events;
  }

  _emit(type, confidence, extra = {}) {
    const event = {
      type,
      confidence: clamp01(confidence),
      t: this._lastTime,
      at: Date.now(),
      ...extra,
    };
    this._lastEmit[type] = this._lastTime;
    this._lastEvent[type] = event;
    this._events.unshift(event);
    if (this._events.length > 40) this._events.length = 40;
    if (this.onGesture) this.onGesture(event);
    return event;
  }

  /** 瞬时动作的锁到期后释放；X 要等真正松开才释放。 */
  _releaseExpired(t) {
    if (
      this._activeGesture &&
      this._activeGesture !== 'x' &&
      t >= this._lockUntil
    ) {
      this._activeGesture = null;
    }
  }

  /**
   * 强制清空动作锁（QTE 每一式开始时调用）。
   * 正常游玩不调用；它只用于让新一式不被上一式的锁或收势动作拖住。
   */
  clearActionLock() {
    this._activeGesture = null;
    this._lockUntil = 0;
  }

  /** 同一时间只允许一个动作：动作锁 / 释放冷却期间都返回 false。 */
  _canFire(type, t) {
    if (this._activeGesture) return false;
    if (t < this._lockUntil) return false;
    return true;
  }

  /**
   * 喂入一帧。
   * @param {object} input
   * @param {number} input.t 毫秒时间戳（单调递增）
   * @param {Array} input.landmarks 33 点归一化坐标 [{x,y,z,visibility}]
   * @param {Array} [input.worldLandmarks] 33 点米制坐标
   * @param {number} input.aspect 画面宽高比
   */
  update({ t, landmarks, worldLandmarks, aspect = 16 / 9 }) {
    if (!Array.isArray(landmarks) || landmarks.length < 33) {
      this._invalidate(t);
      return this._status;
    }
    if (this._lastTime !== null && t <= this._lastTime) t = this._lastTime + 1;
    const dt = this._lastTime === null ? 1 / 30 : clamp((t - this._lastTime) / 1000, 0.001, 0.5);
    this._lastTime = t;
    this._releaseExpired(t);

    const alpha = clamp(1 - Math.exp(-dt / this.options.smoothTau), 0.3, 0.88);
    this._smoothed = this._smoothLandmarks(this._smoothed, landmarks, alpha);
    this._worldSmoothed = worldLandmarks
      ? this._smoothLandmarks(this._worldSmoothed, worldLandmarks, alpha)
      : null;

    const P = this._smoothed.map((point) => toScreenPoint(point, aspect));
    const W = this._worldSmoothed
      ? this._worldSmoothed.map((point) => ({
          x: point.x ?? 0,
          y: point.y ?? 0,
          z: point.z ?? 0,
          v: point.visibility ?? 1,
        }))
      : null;

    const p = (index) => P[index];
    const shoulderL = p(LM.LEFT_SHOULDER);
    const shoulderR = p(LM.RIGHT_SHOULDER);
    const elbowL = p(LM.LEFT_ELBOW);
    const elbowR = p(LM.RIGHT_ELBOW);
    const nose = p(LM.NOSE);
    const midS = mid(shoulderL, shoulderR);
    const shoulderSep = dist2(shoulderL, shoulderR);

    // 只校验肩、肘、鼻；髋/腿完全不参与
    const coreVis =
      Math.min(shoulderL.v, shoulderR.v, elbowL.v, elbowR.v, nose.v) >=
      this.options.minVisibility;

    const upperArmL = dist2(shoulderL, elbowL);
    const upperArmR = dist2(shoulderR, elbowR);
    const validUpper = [upperArmL, upperArmR].filter((value) => value > 1e-4);
    const upperArmScreen = validUpper.length
      ? validUpper.reduce((sum, value) => sum + value, 0) / validUpper.length
      : 0;
    const headDist = dist2(midS, nose);

    // 上臂长为主；头肩距和肩宽兜底（手臂前伸/侧伸投影缩短时仍稳定）
    const bodyScale = Math.max(
      upperArmScreen,
      headDist * 0.75,
      shoulderSep * 0.35,
      0.02,
    );

    if (!coreVis || bodyScale < this.options.minBodyScale) {
      this._invalidate(t, bodyScale);
      return this._status;
    }

    const viewRatio = shoulderSep / bodyScale;
    this._viewSamples.push(viewRatio);
    if (this._viewSamples.length > this.options.viewSamples) this._viewSamples.shift();
    const smoothRatio = median(this._viewSamples);
    if (smoothRatio >= this.options.viewFrontRatio) this._view = 'front';
    else if (smoothRatio <= this.options.viewSideRatio) this._view = 'side';
    else this._view = 'unknown';

    const worldUpperL = W ? dist3(W[LM.LEFT_SHOULDER], W[LM.LEFT_ELBOW]) : 0;
    const worldUpperR = W ? dist3(W[LM.RIGHT_SHOULDER], W[LM.RIGHT_ELBOW]) : 0;
    const validWorldUpper = [worldUpperL, worldUpperR].filter((value) => value > 1e-4);
    const worldScale = validWorldUpper.length
      ? validWorldUpper.reduce((sum, value) => sum + value, 0) / validWorldUpper.length
      : bodyScale;
    const worldMidS = W ? mid(W[LM.LEFT_SHOULDER], W[LM.RIGHT_SHOULDER]) : midS;

    const arms = {
      L: this._buildArm('L', P, W, midS, bodyScale),
      R: this._buildArm('R', P, W, midS, bodyScale),
    };

    const frame = {
      t,
      P,
      W,
      midS,
      worldMidS,
      bodyScale,
      worldScale,
      shoulderSep,
      ratio: smoothRatio,
      view: this._view,
      arms,
      xScore: 0,
      thrustScore: 0,
      swingScore: 0,
    };
    frame.xScore = this._xScore(frame);
    // 姿态分（不是触发事件）：给 QTE 界面做实时反馈，也让「正面朝镜头」这类
    // 屏幕位移很小的动作有第二个可观测信号
    frame.thrustScore = this._thrustScore(frame);
    frame.swingScore = this._swingScore(frame);

    this._history.push(frame);
    const cutoff = t - this.options.historySeconds * 1000;
    while (this._history.length && this._history[0].t < cutoff) this._history.shift();
    this._lastValidAt = t;

    this._detectX(frame);
    this._detectThrust(frame);
    this._detectSwing(frame);

    this._status = {
      valid: true,
      upperBodyOnly: true,
      view: this._view,
      viewRatio: smoothRatio,
      bodyScale,
      worldScale,
      scores: { x: frame.xScore, thrust: frame.thrustScore, swing: frame.swingScore },
      activeGesture: this._activeGesture,
      locked: Boolean(this._activeGesture) || t < this._lockUntil,
      lockUntil: this._lockUntil,
      arms,
      lastEvent: this._lastEvent,
      events: this._events,
      at: t,
    };
    return this._status;
  }

  _invalidate(t, bodyScale = 0) {
    if (this._lastValidAt && t - this._lastValidAt > 600) {
      this._history = [];
      this._xSince = null;
      this._xArmed = true;
      this._activeGesture = null;
      this._lockUntil = t + 400;
      this._smoothed = null;
      this._worldSmoothed = null;
      this._viewSamples = [];
    }
    this._status = {
      valid: false,
      upperBodyOnly: true,
      view: this._view,
      viewRatio: this._status.viewRatio ?? 0,
      bodyScale,
      scores: { x: 0, thrust: 0, swing: 0 },
      activeGesture: this._activeGesture,
      locked: Boolean(this._activeGesture) || t < this._lockUntil,
      lockUntil: this._lockUntil,
      arms: null,
      lastEvent: this._lastEvent,
      events: this._events,
      at: t,
    };
  }

  _smoothLandmarks(previous, next, alpha) {
    if (!previous || previous.length !== next.length) {
      return next.map((point) => ({
        x: point.x,
        y: point.y,
        z: point.z ?? 0,
        visibility: point.visibility ?? point.presence ?? 1,
      }));
    }
    return next.map((point, index) => {
      const prev = previous[index];
      return {
        x: prev.x + (point.x - prev.x) * alpha,
        y: prev.y + (point.y - prev.y) * alpha,
        z: (prev.z ?? 0) + ((point.z ?? 0) - (prev.z ?? 0)) * alpha,
        visibility:
          (prev.visibility ?? 1) + ((point.visibility ?? 1) - (prev.visibility ?? 1)) * alpha,
      };
    });
  }

  _buildArm(side, P, W, midS, bodyScale) {    const sIndex = side === 'L' ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER;
    const eIndex = side === 'L' ? LM.LEFT_ELBOW : LM.RIGHT_ELBOW;
    const wIndex = side === 'L' ? LM.LEFT_WRIST : LM.RIGHT_WRIST;

    const S = P[sIndex];
    const E = P[eIndex];
    const Wr = P[wIndex];
    const Sw = W ? W[sIndex] : S;
    const Ew = W ? W[eIndex] : E;
    const Ww = W ? W[wIndex] : Wr;

    const upper = dist3(Sw, Ew);
    const fore = dist3(Ew, Ww);
    const armLen = upper + fore;
    const reach = armLen > 1e-5 ? dist3(Sw, Ww) / armLen : 0;
    const elbow = angleAt(Sw, Ew, Ww);

    return {
      side,
      S,
      E,
      W: Wr,
      Sw,
      Ew,
      Ww,
      valid: Math.min(S.v, E.v, Wr.v) >= this.options.minVisibility,
      elbow,
      reach,
      armLen,
      upper,
      fore,
      // 正 = 腕高于肩；负 = 腕低于肩（单位：上半身尺度）
      height: (midS.y - Wr.y) / bodyScale,
      // 正 = 腕比肩更靠近镜头（MediaPipe z 越小越近）
      depth: ((S.z ?? 0) - (Wr.z ?? 0)) / bodyScale,
      lateral: (Wr.x - midS.x) / bodyScale,
    };
  }

  _xScore(frame) {
    const { arms, midS, bodyScale, shoulderSep } = frame;
    const a = arms.L;
    const b = arms.R;
    if (!a || !b || !a.valid || !b.valid) return 0;

    // 双手必须明显高过肩；屈肘且腕高于肘（排除直臂上举与抱头）
    if (Math.min(a.height, b.height) < 0.45) return 0;
    const up =
      (clamp01(a.height / 0.9) + clamp01(b.height / 0.9)) / 2;
    const bendL = bentScore(a.elbow);
    const bendR = bentScore(b.elbow);
    const bent = (bendL + bendR) / 2;
    if (bendL < 0.08 || bendR < 0.08 || bent < 0.3) return 0;

    const foreUpL = a.W.y < a.E.y - 0.03 * bodyScale ? 1 : 0;
    const foreUpR = b.W.y < b.E.y - 0.03 * bodyScale ? 1 : 0;
    const foreUp = (foreUpL + foreUpR) / 2;
    const depth = clamp01((a.depth + b.depth) / 2 / 0.7);
    const refWidth = Math.max(shoulderSep, 0.5 * bodyScale);
    const sep = Math.abs(a.W.x - b.W.x) / refWidth;
    const close = clamp01(1 - sep / 1.5);

    // 正面：双腕越过身体中线（左右互换）
    const dir = Math.sign(a.S.x - b.S.x) || 1;
    const crossThreshold = 0.12 * Math.max(shoulderSep, 0.6 * bodyScale);
    const crossL = (-(a.W.x - midS.x) * dir) / crossThreshold;
    const crossR = ((b.W.x - midS.x) * dir) / crossThreshold;
    const cross = Math.min(clamp01(crossL), clamp01(crossR));
    const frontScore =
      cross < 0.25
        ? 0
        : clamp01(0.32 * up + 0.3 * cross + 0.22 * bent + 0.1 * foreUp + 0.06 * depth);

    // 侧面：双腕高举、屈肘、靠近，且腕高于肘
    const sideAllowed = foreUp >= 0.5 && close >= 0.35;
    const sideScore = clamp01(
      0.34 * up + 0.28 * bent + 0.2 * close + 0.1 * foreUp + 0.08 * depth,
    );

    // 视角只作 HUD 参考：正面交叉与侧面靠近两种判据取较高分
    const side = sideAllowed ? sideScore : 0;
    return Math.max(frontScore, side);
  }

  /**
   * 前突刺姿态分：只描述「当前是不是一个突刺姿势」，不判断是否发生了动作。
   * 正面朝镜头直刺时手腕在屏幕上几乎不动，这个分（配合界面进度条）是第二个可观测信号。
   */
  _thrustScore(frame) {
    let best = 0;
    for (const side of ['L', 'R']) {
      const arm = frame.arms[side];
      if (!arm || !arm.valid) continue;
      const straight = clamp01((arm.elbow - 128) / 42);
      const reach = clamp01((arm.reach - 0.55) / 0.38);
      const depth = clamp01((arm.depth + 0.15) / 0.85);
      const level = clamp01(1 - Math.abs(arm.height) / 1.4);
      const score = 0.4 * straight + 0.3 * reach + 0.2 * depth + 0.1 * level;
      if (score > best) best = score;
    }
    return best;
  }

  /** 下劈姿态分：手腕明显低于肩（单臂），同样只作界面反馈 */
  _swingScore(frame) {
    let best = 0;
    for (const side of ['L', 'R']) {
      const arm = frame.arms[side];
      if (!arm || !arm.valid) continue;
      const low = clamp01((-arm.height - 0.15) / 1.2);
      if (low > best) best = low;
    }
    return best;
  }

  _detectX(frame) {
    const score = frame.xScore;
    const t = frame.t;
    if (score >= this.options.xEnter && this._xArmed && this._canFire('x', t)) {
      if (this._xSince === null) this._xSince = t;
      const held = t - this._xSince;
      if (
        held >= this.options.xHoldMs &&
        t - this._lastEmit.x >= this.options.xCooldownMs
      ) {
        this._activeGesture = 'x';
        this._emit('x', score, {
          view: frame.view,
          elbow: [frame.arms.L.elbow, frame.arms.R.elbow],
        });
        // 一次交叉只报一次；必须先松开（分数跌破退出线）才允许下一次
        this._xArmed = false;
        this._xSince = null;
      }
    } else if (score < this.options.xExit) {
      if (this._activeGesture === 'x') {
        this._activeGesture = null;
        // 放下 X 的这段动作本身就是“从上到下”，锁住它，避免被判成下劈
        this._lockUntil = t + this.options.xReleaseLockMs;
      }
      this._xSince = null;
      this._xArmed = true;
    }
  }

  _detectThrust(frame) {
    const t = frame.t;
    if (t - this._lastEmit.thrust < this.options.thrustCooldownMs) return;
    if (!this._canFire('thrust', t)) return;
    const history = this._history;
    const worldScale = frame.worldScale;
    const worldReady = Boolean(worldScale && worldScale > 1e-5);
    /*
     * 正面朝镜头前刺时，手腕在屏幕上几乎不移动，原来的「三维前送 ≥ 0.35」判据很容易漏掉。
     * 这一视角改为三条证据叠加：肘角伸直量、臂展增长、深度前送；
     * 并额外给一条「屈臂 → 伸直」的快速通道（这是正面直刺最强的信号）。
     */
    const frontView = frame.view === 'front' || frame.view === 'unknown';

    for (const side of ['L', 'R']) {
      const current = frame.arms[side];
      if (!current.valid) continue;
      if (current.elbow < 140) continue;

      let base = null;
      for (let index = history.length - 1; index >= 0; index -= 1) {
        const candidate = history[index];
        const age = t - candidate.t;
        if (age < 80) continue;
        if (age > 900) break;
        const arm = candidate.arms[side];
        if (!arm.valid) continue;
        if (arm.elbow > 150) continue;
        if (!base || arm.elbow < base.arms[side].elbow) base = candidate;
      }
      if (!base) continue;

      const baseArm = base.arms[side];
      const angleGain = current.elbow - baseArm.elbow;
      if (angleGain < 14) continue;
      const reachGain = current.reach - baseArm.reach;
      if (reachGain < 0.05) continue;

      const dtSec = Math.max((t - base.t) / 1000, 0.05);
      const dy = Math.abs(current.Ww.y - baseArm.Ww.y) / (worldReady ? worldScale : 1);
      // 前送证据：世界坐标位移 / 深度变化 / 臂展增长（正面直刺时后两条最可信）
      const disp3 = worldReady ? dist3(current.Ww, baseArm.Ww) / worldScale : 0;
      const depthDelta = current.depth - baseArm.depth;
      const forward = Math.max(disp3, depthDelta, reachGain * 0.9);
      const speed = forward / dtSec;
      const endHeight = worldReady
        ? Math.abs(current.Ww.y - frame.worldMidS.y) / worldScale
        : Math.abs(current.height);

      let accepted = null;

      // 通道 B：正面「屈臂 → 伸直」快速通道（屏幕上位移极小也成立）
      const fastStraighten = angleGain >= 26 && reachGain >= 0.15 && dtSec <= 0.75;
      if (fastStraighten && dy <= 0.8 && endHeight <= 0.75) {
        accepted = {
          forward,
          speed,
          mode: 'straighten',
          score: clamp01(
            0.54 +
              0.2 * clamp01(angleGain / 45) +
              0.16 * clamp01(reachGain / 0.25) +
              0.1 * clamp01((depthDelta + 0.1) / 0.6),
          ),
        };
      } else {
        // 通道 A：明显的三维前送（侧面 / 斜侧最可靠）
        const forwardMin = frontView ? 0.16 : 0.28;
        const speedMin = frontView ? 0.45 : 0.9;
        const verticalLimit = 0.95 * forward + 0.55;
        if (forward >= forwardMin && dy <= verticalLimit && endHeight <= 1.05 && speed >= speedMin) {
          const angleScore = clamp01((current.elbow - 135) / 40);
          const reachScore = clamp01(reachGain / 0.2);
          const forwardScore = clamp01(forward / 0.8);
          const verticalScore = clamp01(1 - dy / verticalLimit);
          const speedScore = clamp01(speed / 2);
          const score =
            0.3 * angleScore +
            0.24 * reachScore +
            0.26 * forwardScore +
            0.1 * verticalScore +
            0.1 * speedScore;
          if (score >= (frontView ? 0.46 : 0.56)) accepted = { forward, speed, mode: 'forward', score };
        }
      }

      if (!accepted) {
        this._thrustArm = null;
        continue;
      }

      /*
       * 连续帧确认：抬手举高的中间会短暂出现「手臂伸直 + 手在肩线附近」，
       * 单帧判定必然把举高误认成直刺；要求连续 3 帧（约 100ms）都成立才认，
       * 代价只是延迟 2 帧，玩家感知不到。
       */
      const armed = this._thrustArm;
      if (armed && armed.side === side && t - armed.at <= 160) {
        armed.count += 1;
        armed.at = t;
      } else {
        this._thrustArm = { side, at: t, count: 1 };
      }
      if (this._thrustArm.count < 3) return;
      this._thrustArm = null;

      this._activeGesture = 'thrust';
      this._lockUntil = t + this.options.actionLockMs;
      this._emit('thrust', accepted.score, {
        side,
        view: frame.view,
        displacement: disp3,
        depth: depthDelta,
        forward: accepted.forward,
        speed: accepted.speed,
        elbow: current.elbow,
        mode: accepted.mode,
      });
      return;
    }
  }

  _detectSwing(frame) {
    const t = frame.t;
    if (t - this._lastEmit.swing < this.options.swingCooldownMs) return;
    if (!this._canFire('swing', t)) return;
    const history = this._history;
    const worldScale = frame.worldScale;
    if (!worldScale || worldScale < 1e-5) return;

    for (const side of ['L', 'R']) {
      const current = frame.arms[side];
      if (!current.valid) continue;
      if (current.height > -0.45) continue;

      let base = null;
      let maxElbow = 0;
      for (let index = history.length - 1; index >= 0; index -= 1) {
        const candidate = history[index];
        const age = t - candidate.t;
        if (age < 100) continue;
        if (age > 900) break;
        const arm = candidate.arms[side];
        if (!arm.valid) continue;
        maxElbow = Math.max(maxElbow, arm.elbow);
        if (arm.height > 0.35 && (!base || arm.Ww.y < base.arms[side].Ww.y)) {
          base = candidate;
        }
      }
      if (!base) continue;

      const baseArm = base.arms[side];
      const dtSec = (t - base.t) / 1000;
      if (dtSec < 0.1 || dtSec > 0.9) continue;

      const drop = (current.Ww.y - baseArm.Ww.y) / worldScale;
      if (drop < 1.15) continue;
      const lateral =
        Math.hypot(
          current.Ww.x - baseArm.Ww.x,
          current.Ww.z - baseArm.Ww.z,
        ) / worldScale;
      if (lateral > 0.9 * drop) continue;
      if (maxElbow < 100) continue;
      const speed = drop / dtSec;
      if (speed < 1.2) continue;

      // 只认“单臂”：双臂同时下落（例如从头顶 X 放下来）不算挥斩
      const otherSide = side === 'L' ? 'R' : 'L';
      const otherCurrent = frame.arms[otherSide];
      let otherBase = null;
      for (let index = history.length - 1; index >= 0; index -= 1) {
        if (history[index].t <= base.t) {
          otherBase = history[index].arms[otherSide];
          break;
        }
      }
      if (otherCurrent?.valid && otherBase?.valid) {
        const otherDrop = (otherCurrent.Ww.y - otherBase.Ww.y) / worldScale;
        if (otherDrop > 0.55 * drop) continue;
      }

      const score =
        0.35 * clamp01((drop - 1.1) / 1.5) +
        0.2 * clamp01((current.elbow - 100) / 55) +
        0.2 * clamp01((speed - 1.2) / 2.5) +
        0.25 * clamp01(1 - lateral / (0.9 * drop));
      if (score < 0.56) continue;

      this._activeGesture = 'swing';
      this._lockUntil = t + this.options.actionLockMs;
      this._emit('swing', score, {
        side,
        view: frame.view,
        drop,
        speed,
        elbow: current.elbow,
      });
      return;
    }
  }
}

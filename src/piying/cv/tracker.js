/**
 * 实现功能：把摄像头人物的骨架映射成皮影关节角度（「人影动作同步」）
 * 职责：读 MediaPipe 33 点归一化坐标，算出躯干 / 头 / 双臂 / 双腿相对父关节的角度，
 *       做 EMA 平滑与限幅后写入 rig（rig.setAngles），让皮影跟着人动。
 *
 * 角度约定（与 rig-engine 的矩阵一致，y 轴向下）：
 *   R(θ) = [cosθ, sinθ, -sinθ, cosθ]（正角度 = 屏幕上顺时针）
 *   - 上臂/前臂/大腿/小腿的部件图是「从关节朝下画」，未旋转时方向为 (0,1)
 *   - 躯干/头的部件图是「从关节朝上画」，未旋转时方向为 (0,-1)
 *   - 因此：朝下的肢段 θ = atan2(-ux, uy)；朝上的躯干 θ = atan2(ux, -uy)
 *
 * 左右手对应：皮影是侧身，图纸上「近侧」肢体的 z 更大（画在上层）。
 *   用两个上臂 attach 的 x 判断近侧在画面左边还是右边，再把摄像头同侧的手映射过去，
 *   这样人和皮影的左右不会反。
 */
import { LM } from './landmarks.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const DEG = 180 / Math.PI;

/** 按 node.part 归类关节（兼容 general / warrior / 用户导入的命名字符串） */
function classify(rig) {
  const groups = { torso: null, head: null, upper: {}, fore: {}, hand: {}, thigh: {}, shin: {} };
  const nodes = rig.nodes;

  const sideOf = (node) => {
    const id = String(node.id);
    if (/(near|N)$/.test(id) && !/(front)$/i.test(id)) return 'N';
    if (/(far|F)$/.test(id)) return 'F';
    return '';
  };

  const bucketOf = (part) => {
    const key = String(part || '').toLowerCase();
    if (key.includes('torso')) return 'torso';
    if (key.includes('head')) return 'head';
    if (key.includes('forearm') || key.includes('lowerarm')) return 'fore';
    if (key.includes('upperarm') || key.includes('upper')) return 'upper';
    if (key.includes('hand')) return 'hand';
    if (key.includes('thigh') || key.includes('upleg')) return 'thigh';
    if (key.includes('lowerleg') || key.includes('shin') || key.includes('calf')) return 'shin';
    return '';
  };

  // 侧别兜底：没有 N/F 后缀时按出现顺序，第一篇给 F（远）、第二篇给 N（近）
  const order = {};
  for (const node of nodes) {
    const bucket = bucketOf(node.part);
    if (!bucket) continue;
    if (bucket === 'torso' || bucket === 'head') {
      groups[bucket] = node.id;
      continue;
    }
    let side = sideOf(node);
    if (!side) {
      order[bucket] = (order[bucket] || 0) + 1;
      side = order[bucket] === 1 ? 'F' : 'N';
    }
    if (!groups[bucket][side]) groups[bucket][side] = node.id;
  }

  // 近侧在画面左还是右：比较两上臂在躯干图内的 attach x
  let nearOnLeft = true;
  const upperN = groups.upper.N ? rig.byId[groups.upper.N] : null;
  const upperF = groups.upper.F ? rig.byId[groups.upper.F] : null;
  if (upperN && upperF) nearOnLeft = upperN.attach[0] <= upperF.attach[0];

  return { ...groups, nearOnLeft };
}

export class PoseTracker {
  constructor({ rig, mirror = true } = {}) {
    this.rig = rig;
    this.mirror = mirror;
    this.layout = rig ? classify(rig) : null;
    this.smooth = new Map();
    this.last = null;
    this.engaged = false;
    this.frames = 0;
    this.alpha = 0.32;
  }

  setRig(rig) {
    this.rig = rig;
    this.layout = rig ? classify(rig) : null;
    this.smooth.clear();
  }

  reset() {
    this.smooth.clear();
    this.last = null;
    this.engaged = false;
  }

  _ema(id, value) {
    const previous = this.smooth.get(id);
    if (previous === undefined) {
      this.smooth.set(id, value);
      return value;
    }
    const next = previous + (value - previous) * this.alpha;
    this.smooth.set(id, next);
    return next;
  }

  /**
   * @param {{landmarks:Array|null}} frame VisionService 的 onPose 回调参数
   * @returns {object|null} 写入 rig 的角度表
   */
  update(frame) {
    if (!this.rig || !this.layout) return null;
    const landmarks = frame?.landmarks;
    if (!Array.isArray(landmarks) || landmarks.length < 33) return null;

    const visible = (index, threshold = 0.3) => (landmarks[index]?.visibility ?? 1) >= threshold;
    const point = (index) => ({
      x: landmarks[index].x,
      y: landmarks[index].y,
      v: landmarks[index].visibility ?? 1,
    });

    const shoulderL = point(LM.LEFT_SHOULDER);
    const shoulderR = point(LM.RIGHT_SHOULDER);
    const hipL = point(LM.LEFT_HIP);
    const hipR = point(LM.RIGHT_HIP);
    if (!visible(LM.LEFT_SHOULDER) || !visible(LM.RIGHT_SHOULDER)) return null;

    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const midShoulder = mid(shoulderL, shoulderR);
    const midHip = mid(hipL, hipR);
    const torsoVisible = visible(LM.LEFT_HIP) && visible(LM.RIGHT_HIP);

    // 躯干：肩中点相对髋中点朝上
    let torsoAng = 0;
    if (torsoVisible) {
      const tx = midShoulder.x - midHip.x;
      const ty = midShoulder.y - midHip.y;
      torsoAng = clamp(Math.atan2(tx, -ty) * DEG, -42, 42);
    }

    // 头：鼻相对肩中点朝上
    let headAng = 0;
    if (visible(LM.NOSE)) {
      const nose = point(LM.NOSE);
      const hx = nose.x - midShoulder.x;
      const hy = nose.y - midShoulder.y;
      const abs = Math.atan2(hx, -hy) * DEG;
      headAng = clamp(abs - torsoAng, -34, 34);
    }

    // 画面左右 → 皮影 near / far（皮影近侧手在画面左，所以画面左的手给 N）
    const wristL = point(LM.LEFT_WRIST);
    const wristR = point(LM.RIGHT_WRIST);
    const leftIsScreenLeft = (wristL.x + shoulderL.x) / 2 <= (wristR.x + shoulderR.x) / 2;
    const sideForScreenLeft = this.layout.nearOnLeft ? 'N' : 'F';
    const sideForScreenRight = this.layout.nearOnLeft ? 'F' : 'N';

    const angles = {};
    if (this.layout.torso) angles[this.layout.torso] = torsoAng;
    if (this.layout.head) angles[this.layout.head] = headAng;

    /** 一段肢体的绝对朝向角：从 from 指向 to，朝下为 0 */
    const limbAngle = (from, to) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      if (Math.hypot(dx, dy) < 1e-4) return null;
      return Math.atan2(-dx, dy) * DEG;
    };

    const arms = [
      {
        side: leftIsScreenLeft ? sideForScreenLeft : sideForScreenRight,
        shoulder: shoulderL,
        elbow: point(LM.LEFT_ELBOW),
        wrist: wristL,
        ok: visible(LM.LEFT_SHOULDER) && visible(LM.LEFT_ELBOW) && visible(LM.LEFT_WRIST),
      },
      {
        side: leftIsScreenLeft ? sideForScreenRight : sideForScreenLeft,
        shoulder: shoulderR,
        elbow: point(LM.RIGHT_ELBOW),
        wrist: wristR,
        ok: visible(LM.RIGHT_SHOULDER) && visible(LM.RIGHT_ELBOW) && visible(LM.RIGHT_WRIST),
      },
    ];

    for (const arm of arms) {
      const upperId = this.layout.upper[arm.side];
      const foreId = this.layout.fore[arm.side];
      const handId = this.layout.hand[arm.side];
      if (!arm.ok) continue;
      const upperAbs = limbAngle(arm.shoulder, arm.elbow);
      const foreAbs = limbAngle(arm.elbow, arm.wrist);
      if (upperAbs === null || foreAbs === null) continue;
      if (upperId) angles[upperId] = this._ema(upperId, clamp(upperAbs - torsoAng, -165, 165));
      if (foreId) {
        const local = clamp(foreAbs - upperAbs, -160, 160);
        angles[foreId] = this._ema(foreId, local);
      }
      if (handId) angles[handId] = this._ema(handId, 0);
    }

    // 腿：髋-膝-踝，只在髋/膝可见时才映射（很多摄像头只拍到上半身）
    const legs = [
      {
        side: leftIsScreenLeft ? sideForScreenLeft : sideForScreenRight,
        hip: hipL,
        knee: point(LM.LEFT_KNEE),
        ankle: point(LM.LEFT_ANKLE),
        ok: visible(LM.LEFT_HIP, 0.4) && visible(LM.LEFT_KNEE, 0.4),
      },
      {
        side: leftIsScreenLeft ? sideForScreenRight : sideForScreenLeft,
        hip: hipR,
        knee: point(LM.RIGHT_KNEE),
        ankle: point(LM.RIGHT_ANKLE),
        ok: visible(LM.RIGHT_HIP, 0.4) && visible(LM.RIGHT_KNEE, 0.4),
      },
    ];

    for (const leg of legs) {
      if (!leg.ok) continue;
      const thighId = this.layout.thigh[leg.side];
      const shinId = this.layout.shin[leg.side];
      const thighAbs = limbAngle(leg.hip, leg.knee);
      if (thighAbs === null) continue;
      if (thighId) angles[thighId] = this._ema(thighId, clamp(thighAbs - torsoAng, -95, 95));
      if (shinId) {
        const shinAbs = visible(LM.LEFT_ANKLE, 0.4) || visible(LM.RIGHT_ANKLE, 0.4)
          ? limbAngle(leg.knee, leg.ankle)
          : null;
        if (shinAbs !== null) angles[shinId] = this._ema(shinId, clamp(shinAbs - thighAbs, -150, 60));
      }
    }

    if (!Object.keys(angles).length) return null;

    this.frames += 1;
    this.engaged = true;
    this.last = angles;
    this.rig.setAngles(angles);
    return angles;
  }
}

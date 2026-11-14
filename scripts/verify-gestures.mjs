/**
 * 三动作识别的离线单测（不依赖浏览器 / 摄像头）：
 * 用合成 33 点骨架验证「正面朝镜头前刺」这类屏幕位移极小的动作能否被识别，
 * 以及举手下劈、静止不动这类非动作不会被误判。
 * 用法：node scripts/verify-gestures.mjs
 */
import { GestureDetector } from '../src/piying/cv/gestures.js';

const base = () =>
  Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));

/** 正面站姿（肩上宽 0.2，正面视角：肩宽/上臂长 明显大于 1.15） */
const buildFrame = ({ rightArm, leftArm }) => {
  const lm = base();
  lm[0] = { x: 0.5, y: 0.24, z: 0, visibility: 1 }; // 鼻
  lm[11] = { x: 0.4, y: 0.35, z: 0, visibility: 1 }; // 左肩
  lm[12] = { x: 0.6, y: 0.35, z: 0, visibility: 1 }; // 右肩
  lm[13] = { x: 0.38, y: 0.47, z: 0, visibility: 1 };
  lm[15] = { x: 0.37, y: 0.58, z: 0, visibility: 1 };
  lm[23] = { x: 0.42, y: 0.7, z: 0, visibility: 1 };
  lm[24] = { x: 0.58, y: 0.7, z: 0, visibility: 1 };
  lm[25] = { x: 0.43, y: 0.85, z: 0, visibility: 1 };
  lm[26] = { x: 0.57, y: 0.85, z: 0, visibility: 1 };
  lm[27] = { x: 0.43, y: 0.95, z: 0, visibility: 1 };
  lm[28] = { x: 0.57, y: 0.95, z: 0, visibility: 1 };
  // 左臂默认自然下垂
  lm[13] = leftArm?.elbow || lm[13];
  lm[15] = leftArm?.wrist || lm[15];
  // 右臂
  lm[14] = rightArm.elbow;
  lm[16] = rightArm.wrist;
  return lm;
};

const BENT = {
  elbow: { x: 0.6, y: 0.45, z: 0, visibility: 1 },
  wrist: { x: 0.7, y: 0.42, z: 0, visibility: 1 },
};
/** 朝镜头直刺：手腕在屏幕上几乎不动，只是肘从弯到直 */
const STRAIGHT_CAMERA = {
  elbow: { x: 0.63, y: 0.38, z: 0, visibility: 1 },
  wrist: { x: 0.66, y: 0.4, z: 0, visibility: 1 },
};
/** 举高（不是突刺） */
const RAISED = {
  elbow: { x: 0.63, y: 0.24, z: 0, visibility: 1 },
  wrist: { x: 0.64, y: 0.12, z: 0, visibility: 1 },
};

const run = (label, frames, durationPerFrame = 33) => {
  const events = [];
  const detector = new GestureDetector({ onGesture: (event) => events.push(event) });
  let t = 1000;
  for (const arm of frames) {
    detector.update({ t: (t += durationPerFrame), landmarks: buildFrame({ rightArm: arm }), aspect: 16 / 9 });
  }
  return { label, events, view: detector.status.view };
};

const cases = [];
const push = (label, frames, expect) => {
  const result = run(label, frames);
  const hit = result.events.find((event) => event.type === expect.type);
  cases.push({
    label,
    expect: expect.type || '无',
    actual: result.events.map((event) => event.type).join(',') || '无',
    pass: expect.type ? Boolean(hit) : result.events.length === 0,
    detail: hit ? { confidence: Number(hit.confidence.toFixed(2)), mode: hit.mode, view: hit.view } : { view: result.view },
  });
};

// 1) 正面朝镜头：屈臂 8 帧 → 伸直 6 帧（屏幕位移极小）
push('正面朝镜头·屈臂→伸直（前突刺）', [
  ...Array.from({ length: 8 }, () => BENT),
  ...Array.from({ length: 6 }, () => STRAIGHT_CAMERA),
], { type: 'thrust' });

// 2) 一直伸直不动：不应误判
push('静止伸直（不该触发）', Array.from({ length: 16 }, () => STRAIGHT_CAMERA), { type: null });

// 3) 屈臂 → 举高：不该判成突刺
push('屈臂→举高（不该触发突刺）', [
  ...Array.from({ length: 8 }, () => BENT),
  ...Array.from({ length: 6 }, () => RAISED),
], { type: null });

// 4) 下劈：单手从肩上落到肩下
const SWING_UP = {
  elbow: { x: 0.66, y: 0.2, z: 0, visibility: 1 },
  wrist: { x: 0.7, y: 0.08, z: 0, visibility: 1 },
};
const SWING_DOWN = {
  elbow: { x: 0.9, y: 0.65, z: 0, visibility: 1 },
  wrist: { x: 1.0, y: 0.95, z: 0, visibility: 1 },
};
push('单臂自上而下（下劈）', [
  ...Array.from({ length: 4 }, () => SWING_UP),
  ...Array.from({ length: 4 }, () => SWING_DOWN),
], { type: 'swing' });

let failed = 0;
for (const item of cases) {
  if (!item.pass) failed += 1;
  console.log(`${item.pass ? 'PASS' : 'FAIL'}  ${item.label}  期望=${item.expect}  实际=${item.actual}  ${JSON.stringify(item.detail)}`);
}
console.log(failed ? `\n${failed} 个用例未通过` : `\n全部 ${cases.length} 个用例通过`);
process.exit(failed ? 1 : 0);

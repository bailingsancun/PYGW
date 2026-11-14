/**
 * 实现功能：姿态几何基础（MediaPipe Pose 33 点索引、骨架连线、向量运算）
 * 来源：testdemo/CV/js/landmarks.js（已测试完全），逻辑原样迁移，零依赖。
 */
/**
 * 姿态几何基础：MediaPipe Pose 33 点的索引、连线、向量运算。
 * 该文件同时被浏览器与 Node 单元测试引用，保持零依赖。
 */

export const LM = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

/** 骨架连线（33 点版本，MediaPipe 官方连接表精简版）。 */
export const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

export const LIMB_GROUPS = {
  body: [[11, 12], [11, 23], [12, 24], [23, 24]],
  leftArm: [[11, 13], [13, 15]],
  rightArm: [[12, 14], [14, 16]],
  leftLeg: [[23, 25], [25, 27], [27, 29], [27, 31]],
  rightLeg: [[24, 26], [26, 28], [28, 30], [28, 32]],
  head: [[0, 1], [0, 4], [1, 2], [2, 3], [4, 5], [5, 6], [3, 7], [6, 8]],
};

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const clamp01 = (value) => clamp(value, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

export function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z ?? 0) + (b.z ?? 0)) / 2 };
}

export function dist2(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

/** 以 b 为顶点，返回 a-b-c 的三维夹角（角度制）。 */
export function angleAt(a, b, c) {
  const v1 = { x: (a.x ?? 0) - (b.x ?? 0), y: (a.y ?? 0) - (b.y ?? 0), z: (a.z ?? 0) - (b.z ?? 0) };
  const v2 = { x: (c.x ?? 0) - (b.x ?? 0), y: (c.y ?? 0) - (b.y ?? 0), z: (c.z ?? 0) - (b.z ?? 0) };
  const n1 = Math.hypot(v1.x, v1.y, v1.z);
  const n2 = Math.hypot(v2.x, v2.y, v2.z);
  if (n1 < 1e-6 || n2 < 1e-6) return 0;
  const cos = clamp((v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (n1 * n2), -1, 1);
  return (Math.acos(cos) * 180) / Math.PI;
}

/** 中位数（对少量数值）。 */
export function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const midIndex = sorted.length >> 1;
  return sorted.length % 2 ? sorted[midIndex] : (sorted[midIndex - 1] + sorted[midIndex]) / 2;
}

/** 把“归一化坐标 + 画幅宽高比”变成等比例屏幕单位（x 已乘 aspect）。 */
export function toScreenPoint(landmark, aspect) {
  return {
    x: (landmark.x ?? 0) * aspect,
    y: landmark.y ?? 0,
    z: (landmark.z ?? 0) * aspect,
    v: landmark.visibility ?? 1,
  };
}

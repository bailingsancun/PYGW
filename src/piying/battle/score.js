/**
 * 实现功能：《影刃交锋》打斗过场的时间轴与姿势库
 * 来源：testdemo/piying-rig/battle/score.js（已测试完全），迁入主工程时仅把角色目录
 *       从写死的 "characters/xxx/" 改成相对 PIYING_BASE 的 baseUrl 字段，
 *       由 renderer 用 paths.js 解析成工程内可请求路径。
 * 时间轴约定：time = 0..DURATION（84.2s）
 *   - 0..17s 三段对白（无 BGM），music = time - DIALOGUE_END
 *   - music 段分五阶段：双将交锋 / 步步紧逼 / 妖法流矢 / 一刃断矢 / 黑雾遁形
 */

export const WIDTH = 1600;
export const HEIGHT = 900;
export const DIALOGUE_END = 17;
export const MUSIC_DURATION = 67.2;
export const CUT_TIME = 61;
export const CLOSEUP_START = 59.8;
export const CLOSEUP_END = 61.8;
export const DURATION = DIALOGUE_END + MUSIC_DURATION;
export const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export const mix = (a, b, t) => a + (b - a) * t;
export const ease = t => { const n = clamp(t); return n * n * (3 - 2 * n); };
export function cutMotionTime(music) {
  const dt = music - CUT_TIME;
  return dt < 0 ? dt * .16 / (CUT_TIME - CLOSEUP_START) : dt;
}

export const dialogue = [
  { start: 0, end: 6, who: "general", side: "left", name: "将 领", text: "大胆逆贼，你已无处可逃了！还不快束手就擒！" },
  { start: 6, end: 11, who: "warrior", side: "right", name: "徐 鸿 儒", text: "桀纣无道！白莲现世，自替天罚之！" },
  { start: 11, end: 17, who: "general", side: "left", name: "将 领", text: "枉你赤面大刀肖关公，却为黄河水兽祸神器！" },
];

// 相对 PIYING_BASE 的角色目录；renderer 负责拼成可直接请求的 URL
export const actors = {
  general: { baseUrl: "characters/general/", portrait: "assets/portrait.png", scale: .73, facing: -1, weapon: "sword", weaponOffset: [0, -78], weaponLayer: 13.5 },
  warrior: { baseUrl: "characters/warrior/", portrait: "source/puppet.png", scale: .54, facing: 1, weapon: "guandao" },
};

// Only poses are added to runtime manifest copies; authored geometry stays untouched.
export const combatPoses = {
  general: {
    ready: { base: "rest", angles: { torso: -3, uArmN: 42, fArmN: 42, handN: -5, sword: 38, uArmF: 32, fArmF: 68, thighN: -24, thighF: 24 } },
    raise: { base: "brandish", angles: { torso: 8, head: -9, uArmN: 116, fArmN: -42, handN: 5, sword: 62, uArmF: 70, fArmF: 20, thighN: -36, shinN: 28, thighF: 30, cape: 12 } },
    cutRaise: { base: "brandish", angles: { uArmN: 132, fArmN: -48, handN: 5, sword: 96, uArmF: 56, fArmF: 40 } },
    strike: { base: "brandish", angles: { torso: -18, head: 10, uArmN: 82, fArmN: 15, handN: -10, sword: 46, uArmF: 62, fArmF: 28, thighN: -42, shinN: 30, thighF: 36, shinF: -26, cape: -25 } },
    follow: { base: "stride", angles: { torso: -16, head: 8, uArmN: 30, fArmN: 6, handN: -5, sword: 42, uArmF: -12, fArmF: 60, thighN: -38, thighF: 30, cape: -28 } },
    guard: { base: "rest", angles: { torso: 12, head: -12, uArmN: 70, fArmN: 50, handN: -8, sword: 3, uArmF: 62, fArmF: 82, thighN: -30, shinN: 18, thighF: 32, shinF: -20, cape: 8 } },
    parryBrace: { base: "rest", angles: { torso: 8, head: -8, uArmN: 80, fArmN: 38, handN: -8, sword: 4, uArmF: 66, fArmF: 86, thighN: -42, shinN: 30, thighF: 38, shinF: -28, cape: 8 } },
    parryDeflect: { base: "rest", angles: { torso: -10, head: 6, uArmN: 112, fArmN: -10, handN: -3, sword: 31, uArmF: 72, fArmF: 65, thighN: -48, shinN: 34, thighF: 40, shinF: -28, cape: -16 } },
    crouchCharge: { base: "rest", angles: { torso: -12, head: 12, uArmN: -25, fArmN: 125, handN: -5, sword: 7, uArmF: 65, fArmF: 70, handF: -15, thighN: -70, shinN: 112, thighF: 72, shinF: -116, cape: 10 } },
    thrust: { base: "rest", angles: { torso: -20, head: 14, uArmN: 105, fArmN: 5, handN: 0, sword: 0, uArmF: -30, fArmF: 40, thighN: -66, shinN: 95, thighF: 58, shinF: -34, cape: -30 } },
    stride: { base: "stride", angles: { uArmN: 45, fArmN: 38, sword: 27, thighN: -40, shinN: 30, thighF: 36, shinF: -28, cape: -16 } },
    finish: { base: "brandish", angles: { torso: -4, head: 0, uArmN: 62, fArmN: 32, handN: 0, sword: 33, uArmF: 36, fArmF: 70, cape: -6, thighN: -24, thighF: 22 } },
  },
  warrior: {
    ready: { base: "rest", angles: { uArmN: 50, fArmN: 38, guandao: -115, uArmF: 10, fArmF: 68, thighN: 28, thighF: -26 } },
    raise: { base: "brandish", angles: { torso: -4, head: -10, uArmN: 130, fArmN: -10, guandao: -194, uArmF: 58, fArmF: 40, thighN: 36, thighF: -32 } },
    strike: { base: "brandish", angles: { torso: 18, head: -12, uArmN: 75, fArmN: 5, guandao: -161, uArmF: 56, fArmF: 32, thighN: 42, shinN: -30, thighF: -38, shinF: 26 } },
    follow: { base: "stride", angles: { torso: 18, head: -6, uArmN: 32, fArmN: 14, guandao: -164, thighN: 38, thighF: -34 } },
    guard: { base: "rest", angles: { torso: -16, head: 10, uArmN: 88, fArmN: 34, guandao: -162, uArmF: 56, fArmF: 64, thighN: 36, shinN: -20, thighF: -32, shinF: 20 } },
    recoil: { base: "stride", angles: { torso: -25, head: -14, uArmN: 98, fArmN: 32, guandao: -156, thighN: 22, shinN: -18, thighF: -44, shinF: 32 } },
    stride: { base: "stride", angles: { thighN: 40, shinN: -30, thighF: -36, shinF: 28 } },
    jumpCoil: { base: "rest", angles: { torso: -14, head: -6, uArmN: -50, fArmN: -20, guandao: 204, uArmF: -55, fArmF: -15, thighN: 55, shinN: -95, thighF: 45, shinF: -90 } },
    jumpRise: { base: "rest", angles: { torso: 12, head: 14, uArmN: 183, fArmN: -8, guandao: -117, uArmF: 179, fArmF: -6, thighN: -5, shinN: -100, thighF: -12, shinF: -95 } },
    jumpFall: { base: "rest", angles: { torso: 22, head: -12, uArmN: 80, fArmN: 10, guandao: -185, uArmF: 75, fArmF: 40, thighN: 20, shinN: -70, thighF: 10, shinF: -65 } },
    jumpSlash: { base: "rest", angles: { torso: 22, head: -12, uArmN: 80, fArmN: 10, guandao: -185, uArmF: 75, fArmF: 40, thighN: 42, shinN: -30, thighF: -38, shinF: 26 } },
    deflected: { base: "rest", angles: { torso: 24, head: 12, uArmN: 65, fArmN: -10, guandao: -30, uArmF: -20, fArmF: 45, thighN: 25, shinN: -18, thighF: -44, shinF: 32 } },
    lateGuard: { base: "rest", angles: { torso: -12, head: 8, uArmN: 55, fArmN: 45, guandao: -128, uArmF: 20, fArmF: 65, thighN: 36, shinN: -22, thighF: -32, shinF: 20 } },
    stagger: { base: "rest", angles: { torso: 24, head: 10, uArmN: 35, fArmN: 35, guandao: -150, uArmF: -55, fArmF: 35, thighN: 20, shinN: -15, thighF: -48, shinF: 34 } },
    wounded: { base: "rest", angles: { torso: 30, head: 12, uArmN: 45, fArmN: 15, guandao: -175, uArmF: 55, fArmF: 130, handF: -25, thighN: 28, shinN: -25, thighF: -40, shinF: 32 } },
    retreatA: { base: "stride", angles: { torso: -22, head: 8, uArmN: 76, fArmN: 42, guandao: -140, thighN: 40, shinN: -28, thighF: -34, shinF: 28 } },
    retreatB: { base: "stride", angles: { torso: -18, head: 6, uArmN: 58, fArmN: 46, guandao: -112, thighN: -34, shinN: 28, thighF: 38, shinF: -26 } },
    seal: { base: "rest", angles: { torso: -6, head: -6, uArmN: 15, fArmN: 25, guandao: -42, uArmF: 55, fArmF: 115, handF: -30, thighN: 28, thighF: -28 } },
    summon: { base: "rest", angles: { torso: -10, head: -12, uArmN: 24, fArmN: 22, guandao: -48, uArmF: -155, fArmF: -25, handF: -15, thighN: 28, thighF: -28 } },
    release: { base: "rest", angles: { torso: 10, head: 8, uArmN: 30, fArmN: 30, guandao: -62, uArmF: 96, fArmF: -12, handF: 25, thighN: 32, thighF: -30 } },
    escape: { base: "rest", angles: { torso: -12, head: -12, uArmN: 50, fArmN: 30, guandao: -90, uArmF: -110, fArmF: -20 } },
  },
};

const exchange = [
  [0, "ready", "ready", 0, 0], [.28, "raise", "guard", 28, -12],
  [.53, "raise", "guard", 40, -18], [.82, "strike", "guard", 112, 18],
  [.96, "strike", "guard", 112, 18], [1.18, "follow", "raise", 44, -24],
  [1.50, "guard", "strike", -24, -92], [1.64, "guard", "strike", -24, -92],
  [1.94, "stride", "follow", -38, -20], [2.5, "ready", "ready", 0, 0],
];
const pursuit = [
  [0, "stride", "guard", 0, 0], [.24, "raise", "guard", 28, 14],
  [.50, "strike", "recoil", 118, 68], [.64, "strike", "recoil", 118, 68],
  [.86, "raise", "guard", 65, 36], [1.10, "strike", "recoil", 146, 94],
  [1.25, "strike", "recoil", 146, 94], [1.55, "guard", "strike", 35, 32],
  [1.72, "guard", "strike", 35, 32], [2.1, "stride", "guard", 0, 0],
];
const jumpParry = [
  [17.5, "ready", "ready", 530, 1030],
  [18.05, "ready", "jumpCoil", 510, 1070], [18.5, "ready", "jumpCoil", 510, 1070],
  [18.9, "ready", "jumpRise", 510, 990, 120], [19.35, "ready", "jumpRise", 510, 930, 120],
  [19.65, "ready", "jumpFall", 510, 885, 70],
  [19.95, "parryBrace", "jumpSlash", 510, 885], [20.12, "parryBrace", "jumpSlash", 510, 885],
  [20.35, "parryDeflect", "deflected", 550, 920], [20.45, "parryDeflect", "deflected", 550, 940],
  [20.55, "raise", "deflected", 560, 960],
  [20.85, "strike", "lateGuard", 610, 980], [21.05, "strike", "stagger", 610, 1010],
  [21.2, "strike", "stagger", 610, 1025], [21.65, "follow", "retreatA", 550, 1030],
  [22.1, "stride", "guard", 530 + 60 * ease(2.1 / 20), 1030 + 90 * ease(2.1 / 20)],
];
const retreatCast = [
  [32.6, "stride", "guard", 530 + 60 * ease(12.6 / 20), 1030 + 90 * ease(12.6 / 20)],
  [33.1, "crouchCharge", "raise", 565, 1100], [34.2, "crouchCharge", "raise", 565, 1100],
  [34.55, "crouchCharge", "strike", 565, 1100], [34.75, "crouchCharge", "follow", 565, 1100],
  [35.15, "thrust", "lateGuard", 600, 1100], [35.28, "thrust", "wounded", 600, 1115],
  [35.5, "thrust", "wounded", 600, 1130],
  [35.9, "follow", "retreatA", 626, 1250], [36.4, "guard", "retreatB", 590, 1285],
  [36.9, "ready", "retreatA", 560, 1320], [37.4, "ready", "retreatB", 560, 1340],
  [37.9, "guard", "seal", 560, 1340], [38.35, "guard", "seal", 560, 1340],
  [39.15, "ready", "summon", 560, 1340], [39.55, "ready", "summon", 560, 1340],
  [40, "guard", "release", 560, 1310], [40.4, "guard", "release", 560, 1310],
  [40.85, "raise", "seal", 580, 1300], [41.3, "strike", "guard", 638, 1270],
  [41.8, "follow", "stride", 650, 1220], [42.35, "guard", "ready", 620, 1170],
  [43.1, "stride", "guard", 590, 1120],
];

function motion(time, rows, loop = true) {
  const period = rows.at(-1)[0];
  const phase = loop ? ((time % period) + period) % period : clamp(time, rows[0][0], period);
  const next = rows.findIndex((row, index) => index < rows.length - 1 && phase < rows[index + 1][0]);
  const i = next < 0 ? rows.length - 2 : next;
  const a = rows[i], b = rows[i + 1];
  const blend = ease((phase - a[0]) / (b[0] - a[0]));
  return {
    general: { from: a[1], to: b[1], blend, step: mix(a[3], b[3], blend) },
    warrior: { from: a[2], to: b[2], blend, step: mix(a[4], b[4], blend), lift: mix(a[5] ?? 0, b[5] ?? 0, blend) },
    phase,
  };
}

export function sample(time) {
  const t = clamp(time, 0, DURATION);
  if (t < DIALOGUE_END) {
    const line = dialogue.find(d => t >= d.start && t < d.end);
    const elapsed = t - line.start;
    const count = clamp(Math.floor((elapsed - .4) / .09), 0, line.text.length);
    return { time: t, music: null, phase: "dialogue", chapter: 0, line, text: line.text.slice(0, count), opacity: Math.min(ease(elapsed / .35), ease((line.end - t) / .3)) };
  }
  const music = t - DIALOGUE_END;
  const pressed = music >= 20;
  let m = motion(pressed ? music - 20 : music, pressed ? pursuit : exchange);
  const advance = ease((music - 20) / 20);
  let heroX = 530 + 60 * advance + m.general.step;
  let enemyX = 1030 + 90 * advance + m.warrior.step;
  let action = pressed ? "pursuit" : "exchange";
  const parrySequence = music >= 17.5 && music < 22.1;
  const castingSequence = music >= 32.6 && music < 43.1;
  if (music < 2) { heroX -= 200 * (1 - ease(music / 2)); enemyX += 200 * (1 - ease(music / 2)); }
  if (parrySequence) {
    m = motion(music, jumpParry, false);
    heroX = m.general.step;
    enemyX = m.warrior.step;
    action = music < 18.35 ? "jump-windup" : music < 20 ? "jump-slash" : music < 20.55 ? "parry-riposte" : music < 21.05 ? "counterattack" : "stagger";
  }
  if (castingSequence) {
    m = motion(music, retreatCast, false);
    heroX = m.general.step;
    enemyX = m.warrior.step;
    action = music < 34.75 ? "charge" : music < 35.15 ? "thrust" : music < 35.5 ? "wounded" : music < 37.9 ? "retreat" : music < 39.55 ? "incantation" : music < 40.85 ? "release" : "rejoin";
  }
  const prepareStart = CLOSEUP_START - .28;
  if (music >= prepareStart && music < CLOSEUP_START) {
    m.general = { from: "guard", to: "cutRaise", blend: ease((music - prepareStart) / (CLOSEUP_START - prepareStart)) };
  }
  if (music >= CLOSEUP_START && music < 63) {
    m.general = music < CLOSEUP_END
      ? { from: "cutRaise", to: "follow", blend: ease(.5 + cutMotionTime(music) / .32) }
      : { from: "follow", to: "guard", blend: ease((music - CLOSEUP_END) / (63 - CLOSEUP_END)) };
    if (music >= CUT_TIME) {
      heroX = 620;
      enemyX = 1130;
      m.warrior = { from: "recoil", to: "recoil", blend: 0 };
    }
    action = "cut";
  }
  if (music >= 63) {
    heroX = 620;
    enemyX = 1130 + 150 * ease((music - 63) / 3);
    m.general = { from: "guard", to: "finish", blend: ease((music - 63) / .65) };
    m.warrior = { from: "recoil", to: "escape", blend: ease((music - 63) / .6) };
    action = "await-duel";
  }
  const closeup = music >= CLOSEUP_START && music < CLOSEUP_END;
  const cut = music >= CUT_TIME;
  const chapter = music < 20 ? 1 : music < 40 ? 2 : music < CLOSEUP_START ? 3 : music < 63 ? 4 : 5;
  return {
    time: t, music, phase: music >= MUSIC_DURATION ? "ended" : closeup ? "closeup" : music >= 63 ? "escape" : "combat", chapter, action,
    general: { ...m.general, x: heroX, lift: 0, opacity: 1 },
    warrior: { ...m.warrior, x: enemyX, lift: m.warrior.lift ?? 0, opacity: 1 - ease((music - 64) / 1.4) },
    rain: music >= 40 && music < CLOSEUP_START,
    closeup, cut, mist: music >= 63,
    endCard: ease((music - 66) / 1.1),
    impact: music < CLOSEUP_START && (parrySequence ? music >= 20 && music < 20.12 : castingSequence ? false : pressed ? Math.abs(m.phase - .53) < .09 || Math.abs(m.phase - 1.14) < .09 : Math.abs(m.phase - .86) < .09 || Math.abs(m.phase - 1.54) < .09),
  };
}

export function resolvePose(manifest, actor, name) {
  const pose = combatPoses[actor][name];
  return Object.fromEntries(manifest.nodes.map(node => [node.id, pose.angles[node.id] ?? manifest.poses[pose.base].angles[node.id] ?? node.angle]));
}

export function blendPose(from, to, amount) {
  return Object.fromEntries(Object.keys(from).map(id => [id, mix(from[id], to[id], amount)]));
}

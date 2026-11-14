/**
 * 实现功能：《影刃交锋》打斗过场的 canvas 渲染器
 * 来源：testdemo/piying-rig/battle/renderer.js（已测试完全），迁移改动：
 *   1) 素材路径全部走 paths.js 的 piyingUrl（工程内 public/piying），不再写死相对目录；
 *   2) 装配引擎改为 src/piying/rig-engine.js，并把 rig 关掉拖拽交互（过场不需要拖动）；
 *   3) **删除人物下方的「将 领」「徐 鸿 儒」名称**（正式页面不显示调试用标注）；
 *   4) 结幕卡不再写「决战将启」——该位置由页面上的四个按钮面板接管（END_CARD_RECT 供布局对齐）。
 */
import { createRig } from "../rig-engine.js";
import { piyingUrl } from "../paths.js";
import { WIDTH, HEIGHT, actors, combatPoses, resolvePose, blendPose, ease, clamp, cutMotionTime, CUT_TIME, CLOSEUP_START, CLOSEUP_END } from "./score.js";

const INK = "#492c20", RED = "#7c3026", GOLD = "#ad7b43", PAPER = "#f2e3c4";
const FONT = '"KaiTi", "STKaiti", "SimSun", serif';
const point = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** 结幕卡在原版画面中的位置（1600×900 画布坐标）——页面用它把 HTML 按钮面板对齐到同一处 */
export const END_CARD_RECT = { x: 860, y: 281, w: 500, h: 327 };

async function json(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`无法读取 ${path} (${response.status})`);
  return response.json();
}
async function image(path) {
  const img = new Image();
  img.src = path;
  await img.decode();
  return img;
}

export async function createRenderer(canvas, mounts) {
  const ctx = canvas.getContext("2d");
  const catalog = await json(piyingUrl("scenery/index.json"));
  const props = Object.fromEntries(await Promise.all(catalog.pieces.map(async p => [p.name, await image(piyingUrl(`scenery/${p.file}`))])));
  const rigs = {}, poseBank = {}, portraits = {}, geometry = {};
  for (const [id, config] of Object.entries(actors)) {
    const baseUrl = piyingUrl(config.baseUrl);
    const manifest = await json(`${baseUrl}manifest.json`);
    poseBank[id] = Object.fromEntries(Object.keys(combatPoses[id]).map(name => [name, resolvePose(manifest, id, name)]));
    manifest.poses.timeline = { label: "时间轴", angles: {} };
    const mount = document.createElement("div");
    mounts.append(mount);
    // handles:false + interactive:false —— 过场里不出现关节手柄、也不能被拖动
    const rig = createRig(mount, manifest, { baseUrl, scale: 1, handles: false, interactive: false, keyTarget: new EventTarget() });
    rigs[id] = rig;
    rig.setIdle(false);
    await rig.ready();
    if (Object.values(rig.imgs).some(img => !img.complete || !img.naturalWidth)) throw new Error(`${id} 角色部件未完整载入`);
    portraits[id] = await image(piyingUrl(config.baseUrl + config.portrait));
  }

  function text(value, x, y, size = 24, color = INK, align = "left") {
    ctx.fillStyle = color;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  function ornament(x, y, w, h, color = GOLD) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeRect(x + 7, y + 7, w - 14, h - 14);
    for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, sy);
      ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(23, 32); ctx.lineTo(23, 16); ctx.lineTo(39, 16); ctx.lineTo(39, 0); ctx.stroke(); ctx.restore();
    }
  }

  function prop(name, x, y, width, alpha = 1, rotation = 0) {
    const img = props[name];
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.rotate(rotation);
    ctx.drawImage(img, 0, 0, width, width * img.height / img.width); ctx.restore();
  }

  function backdrop(state) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    const light = ctx.createRadialGradient(800, 370, 120, 800, 430, 880);
    light.addColorStop(0, "#fff7df66"); light.addColorStop(1, "#8b5a2033");
    ctx.fillStyle = light; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    prop("citywall", 617, 180, 370, .13);
    prop("hill", -80, 499, 380, .24);
    prop("hill", 1340, 525, 290, .19);
    prop("banner", 115, 187, 116, .27, -.045);
    prop("banner", 1400, 187, 116, .27, .045);
    prop("cloud", 353, 117, 270, .15);
    prop("cloud", 1020, 120, 265, .16);
    ctx.strokeStyle = "#a27e4833"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(80, 770); ctx.lineTo(1520, 770); ctx.stroke();
    ctx.fillStyle = "#50271f"; ctx.fillRect(0, 0, WIDTH, 20); ctx.fillRect(0, HEIGHT - 22, WIDTH, 22);
    ctx.fillStyle = RED; ctx.fillRect(0, 20, 20, HEIGHT - 42); ctx.fillRect(WIDTH - 20, 20, 20, HEIGHT - 42);
    ornament(29, 29, WIDTH - 58, HEIGHT - 66, "#9c74435c");
    text("黄 河 阵 前", 74, 91, 22, "#6b483c");
    const titles = ["序 · 阵前喝问", "一 · 双将交锋", "二 · 步步紧逼", "三 · 妖法流矢", "四 · 一刃断矢", "终 · 黑雾遁形"];
    const actionTitles = { "jump-windup": "一 · 蓄势跃起", "jump-slash": "一 · 腾身劈落", "parry-riposte": "二 · 架刃反击", charge: "二 · 沉身蓄势", thrust: "二 · 一剑破防", wounded: "二 · 一剑破防", incantation: "三 · 举掌唤矢", release: "三 · 举掌唤矢" };
    const title = actionTitles[state.action] ?? titles[state.chapter];
    text(title, 1525, 91, 22, "#6b483c", "right");
  }

  function drawDialogue(state) {
    const { line, opacity } = state;
    ctx.save(); ctx.globalAlpha = opacity;
    const img = portraits[line.who];
    const h = 660, w = h * img.width / img.height;
    const x = line.side === "left" ? 190 - 28 * (1 - opacity) : WIDTH - 190 - w + 28 * (1 - opacity);
    ctx.save();
    if (line.who === "general") { ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 66, w, h); }
    else ctx.drawImage(img, x, 66, w, h);
    ctx.restore();
    const titleX = line.side === "left" ? 1030 : 450;
    text("阵前", titleX, 287, 39, "#886344", "center");
    text("一言问逆 · 一剑定风波", titleX, 340, 23, "#8d7452", "center");
    ctx.fillStyle = "#efe0bff5"; ctx.fillRect(126, 631, 1348, 191);
    ornament(126, 631, 1348, 191, RED);
    ctx.fillStyle = RED; ctx.fillRect(160, 600, 164, 49);
    text(line.name, 242, 634, 25, "#ffe7b4", "center");
    ctx.font = `32px ${FONT}`;
    let row = "", y = 708;
    for (const char of state.text) {
      if (ctx.measureText(row + char).width > 1200) { text(row, 174, y, 32); row = ""; y += 50; }
      row += char;
    }
    text(row, 174, y, 32);
    text("白", 1407, 789, 19, GOLD, "center");
    ctx.restore();
  }

  function applyPose(id, motion) {
    const rig = rigs[id];
    rig.manifest.poses.timeline.angles = blendPose(poseBank[id][motion.from], poseBank[id][motion.to], motion.blend);
    rig.setPose("timeline");
    const config = actors[id];
    const root = rig.nodes.find(n => n.parent === null);
    const footY = Math.max(...["shinN", "shinF"].map(key => point(rig.W[key], ...rig.byId[key].tip)[1]));
    geometry[id] = { x: motion.x, y: 759 - motion.lift - (footY - root.attach[1]) * config.scale, root: root.attach, ...config };
  }

  function actorTransform(id) {
    const g = geometry[id];
    ctx.translate(g.x, g.y); ctx.scale(g.facing * g.scale, g.scale); ctx.translate(-g.root[0], -g.root[1]);
  }

  function partOffset(id, node) {
    return node === actors[id].weapon ? actors[id].weaponOffset || [0, 0] : [0, 0];
  }

  function partPoint(id, node, local) {
    const offset = partOffset(id, node);
    return point(rigs[id].W[node], local[0] + offset[0], local[1] + offset[1]);
  }

  function drawPart(id, node) {
    const rig = rigs[id];
    ctx.save(); ctx.transform(...rig.W[node]); ctx.drawImage(rig.imgs[node], ...partOffset(id, node)); ctx.restore();
  }

  function drawActor(id, alpha) {
    const rig = rigs[id], config = actors[id];
    const layer = node => node.id === config.weapon ? config.weaponLayer ?? node.z : node.z;
    ctx.save(); ctx.globalAlpha *= alpha; actorTransform(id);
    for (const node of [...rig.nodes].sort((a, b) => layer(a) - layer(b))) {
      if (rig.imgs[node.id].style.display === "none") continue;
      drawPart(id, node.id);
    }
    ctx.restore();
  }

  function stagePoint(id, node, local) {
    const g = geometry[id], p = partPoint(id, node, local);
    return [g.x + (p[0] - g.root[0]) * g.scale * g.facing, g.y + (p[1] - g.root[1]) * g.scale];
  }

  function contactPoint() {
    const a = stagePoint("general", "sword", [49, 215]);
    const b = stagePoint("general", "sword", [49, 540]);
    const c = stagePoint("warrior", "guandao", [46, 20]);
    const d = stagePoint("warrior", "guandao", [46, 750]);
    const cross = (u, v) => u[0] * v[1] - u[1] * v[0];
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
    const den = cross(r, s);
    if (Math.abs(den) < .01) return null;
    const ca = [c[0] - a[0], c[1] - a[1]], t = cross(ca, s) / den, u = cross(ca, r) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + t * r[0], a[1] + t * r[1]] : null;
  }

  function whiteMark(x, y, size = 18) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = "#fffdf0";
    ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(4, -4); ctx.lineTo(size, 0); ctx.lineTo(4, 4); ctx.lineTo(0, size); ctx.lineTo(-4, 4); ctx.lineTo(-size, 0); ctx.lineTo(-4, -4); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function rain(t) {
    const elapsed = t - 40;
    for (let i = 0; i < 26; i++) {
      const depth = i % 3, speed = 420 + depth * 210 + (i % 5) * 35;
      const age = elapsed - i * .16;
      if (age < 0) continue;
      const progress = (age * speed) % 2200;
      const x = 1700 - progress, y = 137 + (i * 83) % 465 + progress * .045;
      prop("arrow", x, y, 130 + depth * 65, .19 + depth * .105, -.045);
    }
  }

  function closeup(state) {
    const t = state.music, motionTime = cutMotionTime(t);
    const reveal = Math.min(ease((t - CLOSEUP_START) / .18), ease((CLOSEUP_END - t) / .25));
    ctx.save(); ctx.globalAlpha = reveal;
    ctx.fillStyle = "#100e0d"; ctx.fillRect(20, 20, WIDTH - 40, HEIGHT - 42);
    ctx.save(); ctx.beginPath(); ctx.ellipse(800, 437, 601, 293, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = PAPER; ctx.fillRect(100, 100, 1400, 700);
    const lamp = ctx.createRadialGradient(800, 430, 160, 800, 430, 610);
    lamp.addColorStop(0, "#fff9df99"); lamp.addColorStop(1, "#a4773933");
    ctx.fillStyle = lamp; ctx.fillRect(100, 100, 1400, 700);
    const scale = .70, halfScale = scale * catalog.arrowBreak.swapScale;
    const frontW = props.arrow_front.width * halfScale;
    const splitX = 790, splitY = 400;
    if (!state.cut) {
      const approach = -motionTime * 620;
      prop("arrow", splitX - frontW + approach, splitY - props.arrow.height * scale / 2, props.arrow.width * scale);
    } else {
      const dt = motionTime;
      prop("arrow_front", splitX - frontW - dt * 680, splitY - props.arrow_front.height * halfScale / 2 - dt * 25, frontW);
      ctx.save(); ctx.translate(splitX - dt * 245, splitY + 150 * dt + 195 * dt * dt); ctx.rotate(dt * 2.9);
      prop("arrow_back", 0, -props.arrow_back.height * halfScale / 2, props.arrow_back.width * halfScale); ctx.restore();
    }
    // Magnify the engine's sword matrix, keeping the real articulated blade on the cut mark.
    const rig = rigs.general;
    const cutAngles = blendPose(poseBank.general.cutRaise, poseBank.general.follow, .5);
    const current = rig.manifest.poses.timeline.angles;
    rig.manifest.poses.timeline.angles = cutAngles; rig.setPose("timeline");
    const anchor = partPoint("general", "sword", [49, 345]);
    rig.manifest.poses.timeline.angles = current; rig.setPose("timeline");
    const zoom = 1.8;
    const dx = clamp(motionTime * 140, -100, 170);
    ctx.save(); ctx.translate(splitX + dx, splitY); ctx.scale(-zoom, zoom); ctx.translate(-anchor[0], -anchor[1]);
    for (const id of ["uArmN", "fArmN", "sword", "handN"]) drawPart("general", id);
    ctx.restore();
    if (state.cut && t < CUT_TIME + .14) whiteMark(splitX, splitY, 33 * (1 - (t - CUT_TIME) / .14));
    ctx.restore();
    text("一 刃 断 矢", 800, 794, 28, "#ead3a5", "center");
    ctx.restore();
  }

  function mist(t) {
    const rise = ease((t - 63) / 1.25);
    const fade = 1 - ease((t - 65.5) / 1.6);
    prop("black_mist", 810 + 36 * ease((t - 64) / 2), 825 - 700 * rise, 930, fade);
    prop("black_mist", 960, 825 - 410 * rise, 660, fade * .8);
  }

  /**
   * 结幕卡：原版这里是「决战将启 / 待入决战」的静态提示。
   * 正式页面把这块位置交给四个按钮（CurtainHub），所以只保留「序幕演毕」这行小字，
   * 避免出现两个并列的「决战将启」。
   */
  function endCard(amount) {
    ctx.save(); ctx.globalAlpha = amount;
    ctx.fillStyle = "#efe0beeF"; ctx.fillRect(END_CARD_RECT.x, END_CARD_RECT.y, END_CARD_RECT.w, END_CARD_RECT.h);
    ornament(END_CARD_RECT.x, END_CARD_RECT.y, END_CARD_RECT.w, END_CARD_RECT.h, RED);
    text("序 幕 演 毕", 1110, 380, 23, GOLD, "center");
    text("妖雾未散 · 交锋未了", 1110, 445, 27, INK, "center");
    text("— 幕 后 已 开 —", 1110, 520, 19, GOLD, "center");
    ctx.restore();
  }

  function render(state) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    backdrop(state);
    if (state.phase === "dialogue") drawDialogue(state);
    else {
      applyPose("general", state.general); applyPose("warrior", state.warrior);
      if (state.rain) rain(state.music);
      drawActor("warrior", state.warrior.opacity); drawActor("general", state.general.opacity);
      if (state.impact) { const contact = contactPoint(); if (contact) whiteMark(...contact); }
      // 注意：原版这里在人物下方标「将 领」「徐 鸿 儒」，正式页面按要求不再显示
      if (state.closeup) closeup(state);
      if (state.mist) mist(state.music);
      if (state.endCard) endCard(state.endCard);
    }
    return state;
  }

  return {
    render, rigs, catalog, contactPoint,
    snapshot: () => canvas.toDataURL("image/jpeg", .94),
    destroy: () => { Object.values(rigs).forEach(rig => rig.destroy()); mounts.replaceChildren(); },
  };
}

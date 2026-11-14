/**
 * 实现功能：皮影关节装配引擎（manifest 驱动，可移植）
 * 来源：testdemo/piying-rig/rig-engine.js（已测试完全），迁入主工程时做了以下增强：
 *   1) 路径：素材不再写死相对目录，改由 options.baseUrl / resolveSrc 解析；
 *      默认解析器支持 data: / blob: / http(s) / 以 / 开头的绝对 URL（本地导入角色与 AI 生成部件要用）。
 *   2) 新增公共 API：refresh / setAngles / setNodeAngle / setStagePos —— 供「人影动作同步」
 *      每帧写入关节角度，以及切换形象后重新居中。
 *   3) 新增 options.className / options.stagePos / options.interactive（过场里不需要拖动）。
 * 没有角色数据被写死：全部来自传入的 manifest 对象；样式自带（py- 前缀），宿主页面无需额外 CSS。
 *
 *   import { createRig } from "@/piying/rig-engine.js";
 *   const rig = createRig(mountEl, manifest, { baseUrl, scale: 0.8 });
 *   rig.setPose("rest"); rig.setIdle(true); rig.snapshot(1, false);
 */

const STYLE_ID = 'piying-rig-style';

const CSS = `
.py-stage{position:relative;overflow:hidden;border-radius:4px;touch-action:none;cursor:default;
  background:radial-gradient(70% 60% at 50% 42%, rgba(255,246,222,.95) 0%, rgba(247,235,205,.7) 45%, rgba(232,214,175,.55) 100%),linear-gradient(#f6ead0,#ecdab8);
  box-shadow:inset 0 0 60px rgba(150,110,60,.35), inset 0 0 0 1px rgba(120,80,40,.25);}
.py-stage::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.06;
  background:repeating-linear-gradient(0deg,#000 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,#000 0 1px,transparent 1px 3px);}
.py-ground{position:absolute;left:50%;bottom:8%;width:46%;height:5%;transform:translateX(-50%);
  background:radial-gradient(closest-side, rgba(60,35,15,.28),rgba(60,35,15,0) 72%);filter:blur(2px);pointer-events:none;}
.py-part{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;image-rendering:auto;
  will-change:transform;filter:drop-shadow(0 3px 4px rgba(40,20,8,.28));}
.py-handle{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#fff,#e9c65a 55%,#a9781f);border:2px solid #6e4a12;
  box-shadow:0 1px 3px rgba(0,0,0,.4);cursor:grab;z-index:9999;transition:transform .08s;}
.py-handle:hover{transform:scale(1.22);}
.py-handle:active{cursor:grabbing;}
.py-handle.move{border-radius:5px;background:radial-gradient(circle at 35% 30%,#fff,#7fb0e0 55%,#2f6aa9);border-color:#1f4a7a;}
.py-handle.hidden{display:none;}
`;

function injectStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const s = doc.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  doc.head.appendChild(s);
}

// 2D affine matrix [a,b,c,d,e,f]
const T = (x, y) => [1, 0, 0, 1, x, y];
const R = (deg) => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, -s, c, 0, 0];
};
function mul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** 默认素材解析：绝对 / data / blob / 协议 URL 原样用，其余拼 baseUrl */
const defaultResolveSrc = (baseUrl) => (key, def) => {
  const src = String(def?.src ?? '');
  if (!src) return '';
  if (/^(data:|blob:|https?:|\/\/)/i.test(src) || src.startsWith('/')) return src;
  return `${baseUrl || ''}${src}`;
};

export function createRig(container, manifest, options = {}) {
  const doc = container.ownerDocument || document;
  injectStyle(doc);

  const stageW = manifest.stage?.width || 900;
  const stageH = manifest.stage?.height || 860;
  /**
   * 舞台底部额外留白（虚拟单位）。
   * 「持剑拄地」这类姿势的剑尖可能略微超出 manifest 的虚拟画布，py-stage 又是 overflow:hidden，
   * 不留白就会把剑尖裁掉。留白只影响舞台高度与自适应缩放，不改变人物自身几何。
   */
  let extraBottom = Math.max(0, Number(options.extraBottom) || 0);
  const bg = manifest.stage?.background || '#f2e3c4';
  const resolveSrc = options.resolveSrc || defaultResolveSrc(options.baseUrl);

  // mutable working copy of nodes
  const nodes = manifest.nodes.map((n) => ({
    ...n,
    pivot: [...n.pivot],
    attach: [...n.attach],
    tip: [...(n.tip || n.pivot)],
  }));
  const byId = {};
  nodes.forEach((n) => (byId[n.id] = n));
  const root = nodes.find((n) => n.parent === null) || nodes[0];
  const REST = {};
  nodes.forEach((n) => (REST[n.id] = n.angle));
  const poses = manifest.poses || { rest: { label: '默认', angles: {} } };
  const idleCfg = manifest.idle || {};

  const stage = doc.createElement('div');
  stage.className = 'py-stage';
  if (options.className) stage.className += ` ${options.className}`;
  const ground = doc.createElement('div');
  ground.className = 'py-ground';
  stage.appendChild(ground);
  container.appendChild(stage);

  const imgs = {};
  const handles = {};
  const W = {};
  let stagePos = options.stagePos ? [...options.stagePos] : [...root.attach];
  let scale = options.scale || 0.6;
  let idleOn = false;
  let handlesOn = options.handles !== false;
  let selected = null;
  let drag = null;
  let t0 = performance.now();
  let raf = 0;

  [...nodes]
    .sort((a, b) => a.z - b.z)
    .forEach((n) => {
      const def = manifest.parts[n.part];
      const im = doc.createElement('img');
      im.className = 'py-part';
      im.alt = '';
      im.src = resolveSrc(n.part, def);
      im.width = def.size[0];
      im.height = def.size[1];
      im.draggable = false;
      stage.appendChild(im);
      imgs[n.id] = im;
    });
  nodes.forEach((n) => {
    const h = doc.createElement('div');
    h.className = 'py-handle' + (n.parent === null ? ' move' : '');
    h.title = n.id;
    h.dataset.id = n.id;
    if (!handlesOn) h.classList.add('hidden');
    stage.appendChild(h);
    handles[n.id] = h;
  });

  function effAngle(n, now) {
    let a = n.angle;
    if (idleOn && idleCfg[n.id]) {
      const [amp, sp, ph] = idleCfg[n.id];
      a += amp * Math.sin(((now - t0) / 1000) * sp + ph);
    }
    return a;
  }
  function compute(now) {
    nodes.forEach((n) => {
      const ang = effAngle(n, now);
      if (n.parent === null) {
        W[n.id] = mul(
          [scale, 0, 0, scale, 0, 0],
          mul(T(stagePos[0], stagePos[1]), mul(R(ang), T(-n.pivot[0], -n.pivot[1]))),
        );
      } else {
        const local = mul(T(n.attach[0], n.attach[1]), mul(R(ang), T(-n.pivot[0], -n.pivot[1])));
        W[n.id] = mul(W[n.parent], local);
      }
    });
  }
  function render() {
    nodes.forEach((n) => {
      const m = W[n.id];
      imgs[n.id].style.transform = `matrix(${m[0]},${m[1]},${m[2]},${m[3]},${m[4]},${m[5]})`;
      const p = apply(m, n.tip[0], n.tip[1]);
      handles[n.id].style.left = `${p[0]}px`;
      handles[n.id].style.top = `${p[1]}px`;
    });
  }
  function refresh() {
    compute(performance.now());
    render();
  }
  function frame(now) {
    compute(now);
    render();
    if (idleOn) raf = requestAnimationFrame(frame);
  }

  function applySize() {
    stage.style.width = `${stageW * scale}px`;
    stage.style.height = `${(stageH + extraBottom) * scale}px`;
  }

  /** 舞台底部留白（虚拟单位），用于给「拄地长剑」腾出空间 */
  function setExtraBottom(value) {
    extraBottom = Math.max(0, Number(value) || 0);
    applySize();
    refresh();
    return extraBottom;
  }

  // ---- interaction ----
  function stageXY(e) {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }
  function onDown(e) {
    if (!interactive) return;
    const h = e.target.closest('.py-handle');
    if (!h) return;
    const n = byId[h.dataset.id];
    const [px, py] = stageXY(e);
    selected = n.id;
    if (n.parent === null) {
      drag = { id: n.id, mode: 'move', start: [px, py], base: [...stagePos] };
    } else {
      const O = apply(W[n.id], n.pivot[0], n.pivot[1]);
      drag = { id: n.id, mode: 'rot', O, startAng: Math.atan2(py - O[1], px - O[0]), base: n.angle };
    }
    try {
      h.setPointerCapture(e.pointerId);
    } catch (_) {
      /* 指针捕获在个别浏览器不可用，忽略 */
    }
    e.preventDefault();
  }
  function onMove(e) {
    if (!drag) return;
    const [px, py] = stageXY(e);
    const n = byId[drag.id];
    if (drag.mode === 'move') {
      stagePos = [drag.base[0] + (px - drag.start[0]) / scale, drag.base[1] + (py - drag.start[1]) / scale];
    } else {
      const cur = Math.atan2(py - drag.O[1], px - drag.O[0]);
      n.angle = drag.base + ((cur - drag.startAng) * 180) / Math.PI;
    }
    if (!idleOn) refresh();
  }
  function onUp() {
    drag = null;
  }
  function onKey(e) {
    if (!selected) return;
    const n = byId[selected];
    if (!n || n.parent === null) return;
    const step = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowLeft') {
      n.angle -= step;
      refresh();
      e.preventDefault();
    }
    if (e.key === 'ArrowRight') {
      n.angle += step;
      refresh();
      e.preventDefault();
    }
  }
  const interactive = options.interactive !== false;
  if (interactive) {
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
  }
  const keyTarget = options.keyTarget || doc.defaultView || window;
  keyTarget.addEventListener('keydown', onKey);

  // ---- public API ----
  function setPose(key) {
    const p = poses[key];
    if (!p) return;
    const angles = p.angles || {};
    nodes.forEach((n) => {
      const v = n.id in angles ? angles[n.id] : REST[n.id];
      if (v === null) {
        imgs[n.id].style.display = 'none';
        handles[n.id].classList.add('hidden');
      } else {
        n.angle = v;
        imgs[n.id].style.display = '';
        handles[n.id].classList.toggle('hidden', !handlesOn);
      }
    });
    refresh();
    if (options.onPose) options.onPose(key);
  }

  /** 批量写入关节角度（人影动作同步 / 姿态映射用），不触发 pose 重置 */
  function setAngles(angles, { apply: applyNow = true } = {}) {
    if (!angles) return;
    for (const [id, value] of Object.entries(angles)) {
      const n = byId[id];
      if (!n || value === null || value === undefined || Number.isNaN(Number(value))) continue;
      n.angle = Number(value);
    }
    if (applyNow && !idleOn) refresh();
  }

  function setNodeAngle(id, value) {
    const n = byId[id];
    if (!n) return;
    n.angle = Number(value);
    if (!idleOn) refresh();
  }

  function reset() {
    stagePos = [...root.attach];
    setPose('rest');
  }
  function setIdle(on) {
    idleOn = on === undefined ? !idleOn : !!on;
    if (idleOn) {
      t0 = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(raf);
      refresh();
    }
    return idleOn;
  }
  function setHandlesVisible(on) {
    handlesOn = on === undefined ? !handlesOn : !!on;
    nodes.forEach((n) => {
      if (imgs[n.id].style.display !== 'none') handles[n.id].classList.toggle('hidden', !handlesOn);
    });
    return handlesOn;
  }
  function setScale(s) {
    scale = Math.max(0.1, s);
    applySize();
    refresh();
    return scale;
  }
  function setStagePos(pos) {
    if (!Array.isArray(pos) || pos.length < 2) return stagePos;
    stagePos = [Number(pos[0]), Number(pos[1])];
    if (!idleOn) refresh();
    return [...stagePos];
  }
  function fit(box) {
    const m = manifest.stage?.fit || {};
    const w = (box?.width || doc.defaultView?.innerWidth || stageW) - (m.marginX ?? 44);
    const h = (box?.height || doc.defaultView?.innerHeight || stageH) - (m.marginY ?? 130);
    return setScale(Math.max(m.min ?? 0.3, Math.min(w / stageW, h / (stageH + extraBottom), m.max ?? 1)));
  }
  function exportAngles() {
    const o = {};
    nodes.forEach((n) => (o[n.id] = Math.round(n.angle * 10) / 10));
    o._stagePos = stagePos.map((v) => Math.round(v));
    return o;
  }
  function snapshot(s = 0.85, drawHandles = false) {
    const save = scale;
    scale = s;
    compute(performance.now());
    const cv = doc.createElement('canvas');
    cv.width = Math.round(stageW * s);
    cv.height = Math.round(stageH * s);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cv.width, cv.height);
    [...nodes]
      .sort((a, b) => a.z - b.z)
      .forEach((n) => {
        const im = imgs[n.id];
        if (im.style.display === 'none') return;
        const m = W[n.id];
        ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
        try {
          ctx.drawImage(im, 0, 0, manifest.parts[n.part].size[0], manifest.parts[n.part].size[1]);
        } catch (_) {
          /* 图片未解码时跳过，快照仍可用 */
        }
      });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (drawHandles)
      nodes.forEach((n) => {
        if (imgs[n.id].style.display === 'none') return;
        const p = apply(W[n.id], n.tip[0], n.tip[1]);
        ctx.beginPath();
        if (n.parent === null) {
          ctx.fillStyle = '#3f86c9';
          ctx.strokeStyle = '#1f4a7a';
          ctx.rect(p[0] - 7, p[1] - 7, 14, 14);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = '#e9c65a';
          ctx.strokeStyle = '#6e4a12';
          ctx.arc(p[0], p[1], 7, 0, 7);
          ctx.fill();
          ctx.stroke();
        }
      });
    scale = save;
    compute(performance.now());
    return cv.toDataURL('image/jpeg', 0.9);
  }
  function ready() {
    return Promise.all(
      Object.values(imgs).map((im) =>
        im.complete
          ? Promise.resolve()
          : new Promise((res) => {
              im.onload = res;
              im.onerror = res;
            }),
      ),
    );
  }
  function destroy() {
    cancelAnimationFrame(raf);
    if (interactive) {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
    }
    keyTarget.removeEventListener('keydown', onKey);
    stage.remove();
  }

  applySize();
  setPose(options.pose || 'rest');

  return {
    manifest,
    nodes,
    byId,
    stageEl: stage,
    W,
    imgs,
    poses: Object.keys(poses).map((k) => ({ key: k, label: poses[k].label || k })),
    setPose,
    setAngles,
    setNodeAngle,
    setExtraBottom,
    setStagePos,
    refresh,
    reset,
    setIdle,
    setHandlesVisible,
    setScale,
    fit,
    exportAngles,
    snapshot,
    ready,
    destroy,
    get scale() {
      return scale;
    },
    get idle() {
      return idleOn;
    },
    get handlesVisible() {
      return handlesOn;
    },
    get stagePos() {
      return [...stagePos];
    },
    get rootNode() {
      return root;
    },
  };
}

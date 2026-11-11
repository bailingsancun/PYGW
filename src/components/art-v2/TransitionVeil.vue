<!--
  实现功能：「云海启幕」转场（实装自草案 05 · testdemo/05-cloud-sea.html）
  职责：点击「启幕寻影」后，用一整套云海 + 皮影人物覆盖首页，
        云从屏幕外平移到构图位、人物绕脚部旋转升起（带阻尼晃动），
        短暂停留后原路散场，背景放大淡出，露出下面的地图页。
  设计：全部姿态由 rAF 时间轴逐帧写 transform/opacity（不用 CSS keyframes），
        重播/慢放都不会累积误差；横竖屏各一套构图。
  用法：<TransitionVeil /> 挂在 App 级别（必须在 router-view 之外），
        通过 utils/transition.js 的 playVeil() 触发。
-->
<template>
  <div v-if="veilPlaying" class="veil" aria-hidden="true">
    <div class="orient" :class="`orient-${orientation}`">
      <div ref="sceneEl" class="scene">
        <div class="scene-bg" :class="`bg-${orientation}`"></div>

        <!-- 上半场云：从屏幕外飞入 -->
        <img
          v-for="(c, i) in layout.clouds"
          :key="`top-${i}`"
          class="cloud"
          :src="c.src"
          :style="c.style"
          :data-fx="c.fx"
          :data-fy="c.fy"
          alt=""
        />

        <!-- 皮影人物：锚点=脚部，绕脚底旋转升起 -->
        <div class="figure-anchor" :style="layout.figure.style">
          <div ref="figureEl" class="figure-pivot" :style="{ '--fh': layout.figure.height }">
            <img :src="FIGURE" alt="" />
          </div>
        </div>

        <!-- 下半场云：底部云海，压在人物前方，形成「从云后升起」的层次 -->
        <img
          v-for="(c, i) in layout.bottomClouds"
          :key="`bottom-${i}`"
          class="cloud"
          :src="c.src"
          :style="c.style"
          :data-fx="c.fx"
          :data-fy="c.fy"
          alt=""
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { emitVeilReveal, finishVeil, veilPlaying } from '@/utils/transition.js';

const LEAD = 260; // 转场层淡入，盖住首页
const TAIL = 300; // 余量，交棒给目标页

/** 与草案一致的默认姿态参数 */
const P = {
  assemble: 1500, // 入场时长
  hold: 600, // 停留时长
  disperse: 1400, // 散场时长
  wobble: 7, // 落位前晃动幅度（度）
  angle: -150, // 入场起始角度
  zoom: 1.18, // 散场时背景放大倍数
  scale: 1, // 云的整体缩放
};

// 素材走 /images 中间件，用常量 + :src 绑定（静态 src 字面量会被 Vite 提取成 import 而报错）
const CLOUD = {
  xiangyunTeal: '/images/web/elements/cloud_xiangyun_teal.png',
  xiangyunRust: '/images/web/elements/cloud_xiangyun_rust.png',
  yulinTeal: '/images/web/elements/cloud_yulin_teal.png',
  ruyiTeal: '/images/web/elements/cloud_ruyi_teal.png',
  yunweiGold: '/images/web/elements/cloud_yunwei_gold.png',
  loukongGold: '/images/web/elements/cloud_loukong_gold.png',
};
const FIGURE = '/images/web/elements/figure_dan_liyun.png';

/** 竖屏构图（对照 bg_cloud_sea_portrait.png） */
const PORTRAIT_TOP = [
  { style: { left: '-14%', top: '-7%', width: '58%' }, fx: -90, fy: -30, src: CLOUD.xiangyunTeal },
  { style: { left: '-22%', top: '9%', width: '46%' }, fx: -90, fy: -10, src: CLOUD.xiangyunRust },
  { style: { right: '-14%', top: '2%', width: '52%' }, fx: 90, fy: -24, src: CLOUD.xiangyunRust },
  { style: { right: '-10%', top: '-7%', width: '40%' }, fx: 90, fy: -30, src: CLOUD.yulinTeal },
  { style: { right: '-16%', top: '14%', width: '60%' }, fx: 90, fy: -6, src: CLOUD.xiangyunTeal },
  { style: { left: '6%', top: '24%', width: '52%' }, fx: -90, fy: 2, src: CLOUD.ruyiTeal },
  { style: { left: '-18%', top: '35%', width: '44%' }, fx: -90, fy: 8, src: CLOUD.xiangyunTeal },
  { style: { left: '-12%', top: '44%', width: '54%' }, fx: -90, fy: 12, src: CLOUD.yunweiGold },
  { style: { right: '-14%', top: '37%', width: '50%' }, fx: 90, fy: 8, src: CLOUD.loukongGold },
  { style: { right: '-12%', top: '50%', width: '40%' }, fx: 90, fy: 14, src: CLOUD.yulinTeal },
];
const PORTRAIT_BOTTOM = [
  { style: { left: '-14%', bottom: '-7%', width: '70%' }, fx: -30, fy: 80, src: CLOUD.xiangyunRust },
  { style: { left: '26%', bottom: '2%', width: '58%' }, fx: 6, fy: 84, src: CLOUD.xiangyunTeal },
  { style: { right: '-18%', bottom: '7%', width: '56%' }, fx: 30, fy: 80, src: CLOUD.xiangyunRust },
  { style: { right: '-12%', bottom: '-8%', width: '60%' }, fx: 24, fy: 88, src: CLOUD.yulinTeal },
  { style: { left: '34%', bottom: '-10%', width: '54%' }, fx: 0, fy: 90, src: CLOUD.loukongGold },
];

/** 横屏构图（对照 bg_cloud_stage_wide.png，顶部中间留空） */
const LANDSCAPE_TOP = [
  { style: { left: '6%', top: '-10%', width: '32%' }, fx: -40, fy: -34, src: CLOUD.loukongGold },
  { style: { left: '-10%', top: '-8%', width: '34%' }, fx: -70, fy: -30, src: CLOUD.xiangyunTeal },
  { style: { left: '8%', top: '32%', width: '22%' }, fx: -70, fy: -6, src: CLOUD.yulinTeal },
  { style: { left: '-8%', top: '30%', width: '22%' }, fx: -70, fy: 4, src: CLOUD.xiangyunRust },
  { style: { left: '-6%', top: '52%', width: '26%' }, fx: -70, fy: 12, src: CLOUD.yunweiGold },
  { style: { left: '10%', top: '58%', width: '18%' }, fx: -60, fy: 16, src: CLOUD.ruyiTeal },
  { style: { right: '16%', top: '-10%', width: '30%' }, fx: 40, fy: -34, src: CLOUD.loukongGold },
  { style: { right: '-10%', top: '-8%', width: '34%' }, fx: 70, fy: -30, src: CLOUD.xiangyunTeal },
  { style: { right: '-6%', top: '-4%', width: '22%' }, fx: 70, fy: -26, src: CLOUD.xiangyunRust },
  { style: { right: '-10%', top: '16%', width: '26%' }, fx: 70, fy: -6, src: CLOUD.xiangyunTeal },
  { style: { right: '2%', top: '22%', width: '24%' }, fx: 70, fy: 4, src: CLOUD.xiangyunRust },
  { style: { right: '-8%', top: '44%', width: '28%' }, fx: 70, fy: 12, src: CLOUD.yulinTeal },
  { style: { right: '10%', top: '48%', width: '20%' }, fx: 60, fy: 10, src: CLOUD.yunweiGold },
];

const LAYOUTS = {
  portrait: {
    clouds: PORTRAIT_TOP,
    bottomClouds: PORTRAIT_BOTTOM,
    figure: { style: { left: '27%', top: '78%' }, height: '26vh' },
  },
  landscape: {
    clouds: LANDSCAPE_TOP,
    bottomClouds: [],
    figure: { style: { left: '22%', top: '88%' }, height: '40vh' },
  },
};

const sceneEl = ref(null);
const figureEl = ref(null);

/**
 * 播放开始时锁定一次横竖屏：中途旋转屏幕不该让构图突然换一套，
 * 否则场景会在动画中途跳变。
 */
const orientation = ref('portrait');
const layout = computed(() => LAYOUTS[orientation.value]);

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const outCubic = (t) => 1 - (1 - t) ** 3;
const inCubic = (t) => t ** 3;
const smooth = (t) => t * t * (3 - 2 * t);

const vw = () => window.innerWidth / 100;
const vh = () => window.innerHeight / 100;
const total = () => LEAD + P.assemble + P.hold + P.disperse + TAIL;

let rafId = 0;
let playing = false;
let lastNow = 0;
let vt = 0;
let revealed = false;

const render = (now) => {
  const scene = sceneEl.value;
  if (!scene) return;

  vt += now - lastNow;
  lastNow = now;
  const t = vt;

  const bg = scene.querySelector('.scene-bg');
  const figure = figureEl.value;
  const clouds = scene.querySelectorAll('.cloud');

  const a = clamp01((t - LEAD) / P.assemble);
  const q = clamp01((t - LEAD - P.assemble - P.hold) / P.disperse);
  const ea = outCubic(a);
  const eq = inCubic(q);

  scene.style.opacity = String(smooth(clamp01(t / LEAD)));

  // 散场开始：此时画面仍被转场层盖住，正是切换路由的时机
  if (!revealed && t >= LEAD + P.assemble + P.hold) {
    revealed = true;
    emitVeilReveal();
  }

  if (bg) {
    bg.style.transform = `scale(${1 + (P.zoom - 1) * eq})`;
    bg.style.opacity = String(1 - smooth(clamp01(q * 1.12)));
  }

  const off = a < 1 ? 1 - ea : eq * 1.06;
  const presence = a < 1 ? ea : 1 - eq;
  const cloudOpacity = clamp01(a / 0.2) * (1 - clamp01((q - 0.55) / 0.45));
  const cloudScale = P.scale * (0.94 + 0.06 * presence);

  clouds.forEach((el) => {
    const fx = Number(el.dataset.fx) || 0;
    const fy = Number(el.dataset.fy) || 0;
    el.style.transform = `translate(${fx * vw() * off}px, ${fy * vh() * off}px) scale(${cloudScale})`;
    el.style.opacity = String(cloudOpacity);
  });

  // 人物：入场时从起始角转正，落位前叠加一段阻尼晃动；散场按原路转回
  let angle;
  if (q > 0) {
    angle = P.angle * eq;
  } else {
    angle = P.angle * (1 - ea);
    if (a > 0.62) {
      const u = (a - 0.62) / 0.38;
      angle += P.wobble * (1 - u) * Math.exp(-2.2 * u) * Math.sin(u * Math.PI * 2 * 2.2);
    }
  }
  const figureOpacity = clamp01(a / 0.15) * (1 - clamp01((q - 0.55) / 0.45));
  if (figure) {
    figure.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    figure.style.opacity = String(figureOpacity);
  }

  if (playing && t < total()) {
    rafId = requestAnimationFrame(render);
  } else {
    playing = false;
    finishVeil();
  }
};

const start = () => {
  orientation.value = window.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait';
  revealed = false;
  vt = 0;
  playing = true;
  lastNow = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(render);
};

watch(
  veilPlaying,
  (active) => {
    if (active) {
      start();
    } else {
      playing = false;
      cancelAnimationFrame(rafId);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  playing = false;
  cancelAnimationFrame(rafId);
});
</script>

<style scoped>
/*
 * 转场层：必须盖住整个应用（含顶栏与底部导航），
 * 且播放期间接管指针事件，避免重复触发「启幕寻影」。
 */
.veil {
  position: fixed;
  inset: 0;
  z-index: 200;
  overflow: hidden;
  pointer-events: auto;
  contain: strict;
}

.orient {
  position: absolute;
  inset: 0;
}

.scene {
  position: absolute;
  inset: 0;
  overflow: hidden;
  opacity: 0;
  will-change: opacity;
}

.scene-bg {
  position: absolute;
  inset: 0;
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  transform-origin: 50% 46%;
  will-change: transform, opacity;
}

.bg-portrait {
  background-image: url('/images/web/bg/bg_stage_clean_portrait.png');
}

.bg-landscape {
  background-image: url('/images/web/bg/bg_stage_clean_wide.png');
}

.cloud {
  position: absolute;
  display: block;
  height: auto;
  opacity: 0;
  filter: drop-shadow(0 14px 26px rgba(96, 54, 16, 0.2));
  will-change: transform, opacity;
}

.figure-anchor {
  position: absolute;
  width: 0;
  height: 0;
}

.figure-pivot {
  position: absolute;
  left: 0;
  bottom: 0;
  height: var(--fh, 28vh);
  opacity: 0;
  transform-origin: 50% 100%;
  will-change: transform, opacity;
}

.figure-pivot img {
  display: block;
  width: auto;
  height: 100%;
  /* 素材朝左，构图里朝右 —— 水平翻转 */
  transform: scaleX(-1);
  filter: drop-shadow(0 12px 26px rgba(60, 30, 10, 0.34)) drop-shadow(0 0 28px rgba(255, 196, 110, 0.22));
}
</style>

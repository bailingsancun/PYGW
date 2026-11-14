<!--
  实现功能：身入影幕 · 过场校准引导（角落角标，不暂停、不暗屏）
  职责：在动画继续播放的同时，于画面角落给出「示意图 + 招式名 + 要领 + 倒计时」，
        玩家在判定窗口内做出对应动作（摄像头视觉识别，或鼠标/触摸划出轨迹）即算校准通过；
        到达节点时刻结算：通过就继续演武，未通过由播放器停下并交给页面做黑屏回退。
  位置：三式分别落在左上、左下、右下（node.placement），避开画面中央的打斗。
  时序：出现于 node.time - 3.3s（看图 1.3s + 判定前半 2s），
        判定窗口为节点前后各 2 秒，结算于 node.time + 2s（与动画时间轴严格同步）。
  Props：node / playback / vision / visionReady / visionStatus
  Emits：done（成功展示完毕后收起）/ enable-camera
-->
<template>
  <svg class="qte-trace-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <polyline v-if="tracePoints" :points="tracePoints" />
  </svg>

  <div class="qte-hud" :class="[placementClass, phase]">
    <div class="hud-head">
      <span class="hud-order">第 {{ node.order }} 式 · 共 3 式</span>
      <span class="hud-phase">{{ phaseText }}</span>
    </div>

    <div class="hud-body">
      <div class="hud-guide" v-html="guideMarkup"></div>
      <div class="hud-copy">
        <p class="hud-name">{{ node.name }}</p>
        <p class="hud-brief">{{ node.brief }}</p>
        <p class="hud-hint">{{ guideMeta.hint }}</p>
        <div class="hud-meter" :class="{ live: visionReady }">
          <i :style="{ width: `${Math.round(meter * 100)}%` }"></i>
        </div>
        <p class="hud-meter-label">{{ meterLabel }}</p>
      </div>
    </div>

    <div class="hud-bar"><i :style="{ width: `${barPercent}%` }"></i></div>

    <div v-if="visionReady" class="hud-camera">
      <canvas ref="previewCanvas" aria-label="摄像头预览"></canvas>
    </div>
    <button v-else type="button" class="hud-camera-btn" @click="$emit('enable-camera')">
      开启摄像头识别
    </button>

    <div v-if="success" class="hud-success">校准成功 · 继续演武</div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { GUIDE_META, guideSvg } from '@/piying/cv/guides.js';
import { TracePad, classifySequence } from '@/piying/qte/trace.js';
import { QTE_JUDGE_START_SECONDS, QTE_RESOLVE_SECONDS, QTE_TOTAL_SECONDS } from '@/piying/battle/qteTimeline.js';

const props = defineProps({
  node: { type: Object, required: true },
  playback: { type: Object, default: null },
  vision: { type: Object, default: null },
  visionReady: { type: Boolean, default: false },
  visionStatus: { type: String, default: '' },
});

const emit = defineEmits(['done', 'enable-camera']);

const WINDOW_SECONDS = QTE_JUDGE_START_SECONDS + QTE_RESOLVE_SECONDS;
/** 「保持型」动作（X 交叉）需要连续命中多久才算数 */
const HOLD_MS = 260;

const previewCanvas = ref(null);
const now = ref(0);
const success = ref(false);
const meter = ref(0);
const tracePoints = ref('');

const guideMeta = computed(() => GUIDE_META[props.node.action] || GUIDE_META.x);
const guideMarkup = computed(() => guideSvg(props.node.action, `curtain-${props.node.id}`));
const placementClass = computed(() => `at-${props.node.placement || 'top-left'}`);

/** 判定窗口：以节点为中心，前 2 秒 ~ 后 2 秒 */
const judgeStartAt = computed(() => Number(props.node.time) - QTE_JUDGE_START_SECONDS);
const resolveAt = computed(() => Number(props.node.time) + QTE_RESOLVE_SECONDS);
/** 距离结算还剩多少秒（角标出现时约 5.3s，归零即结算） */
const remain = computed(() => Math.max(0, resolveAt.value - Number(now.value || 0)));
/** 判定窗口是否已经开启 */
const inJudge = computed(() => Number(now.value || 0) >= judgeStartAt.value);

const phase = computed(() => {
  if (success.value) return 'success';
  return inJudge.value ? 'judge' : 'prepare';
});

const phaseText = computed(() => {
  if (success.value) return '已校准';
  if (phase.value === 'prepare') return '看示意图 · 预备';
  return '判定中';
});

/** 进度条：从角标出现（节点前 3.3s）走到结算（节点后 2s） */
const barPercent = computed(() => {
  const total = Math.max(0.1, QTE_TOTAL_SECONDS);
  return Math.max(0, Math.min(100, (remain.value / total) * 100));
});

const meterLabel = computed(() => {
  if (success.value) return '动作已识别';
  if (!props.visionReady) return '未开摄像头：也可用鼠标/触摸划出动作';
  if (props.node.action === 'x') return `交叉完成度 ${Math.round(meter.value * 100)}%`;
  if (props.node.action === 'thrust') return `直臂前送 ${Math.round(meter.value * 100)}%`;
  return `挥斩幅度 ${Math.round(meter.value * 100)}%`;
});

let raf = 0;
let holdSince = 0;
let doneTimer = 0;
let tracePad = null;

function settleSuccess(confidence, source) {
  if (success.value) return;
  success.value = true;
  props.playback?.markPassed?.(props.node.id);
  meter.value = 1;
  window.clearTimeout(doneTimer);
  // 成功提示留 1.1 秒再收起，让玩家看到「接住了」
  doneTimer = window.setTimeout(() => emit('done', { confidence, source }), 1100);
}

function tick() {
  if (!props.playback || success.value) return;
  now.value = props.playback.time;
  const scores = props.vision?.status?.scores;
  meter.value = scores ? Number(scores[props.node.action] || 0) : 0;

  // 保持型动作：X 交叉在判定窗口里保持住即可（玩家常常提前摆好）
  if (
    props.vision?.ready &&
    props.node.action === 'x' &&
    inJudge.value &&
    meter.value >= (props.vision.xEnter || 0.62)
  ) {
    if (!holdSince) holdSince = performance.now();
    if (performance.now() - holdSince >= HOLD_MS) settleSuccess(meter.value, 'vision');
  } else {
    holdSince = 0;
  }

  raf = requestAnimationFrame(tick);
}

/** 供父组件转发视觉识别事件 */
function handleGesture(event) {
  if (!event || success.value) return false;
  if (event.type !== props.node.action) return false;
  settleSuccess(event.confidence, 'vision');
  return true;
}

function onStroke(_stroke, strokes) {
  if (success.value) return;
  const match = classifySequence(strokes, window.innerWidth, window.innerHeight, props.node.action);
  if (match && match.type === props.node.action) settleSuccess(match.confidence, 'trace');
}

function syncPreview() {
  if (props.vision && props.visionReady && previewCanvas.value) {
    props.vision.attachPreview(previewCanvas.value);
  } else {
    props.vision?.detachPreview?.();
  }
}

watch(() => props.visionReady, syncPreview);

onMounted(() => {
  tracePad = new TracePad({
    target: document.body,
    onStroke,
    onProgress: (points) => {
      if (!points.length) {
        tracePoints.value = '';
        return;
      }
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      tracePoints.value = points
        .map((point) => `${((point.x / width) * 100).toFixed(2)},${((point.y / height) * 100).toFixed(2)}`)
        .join(' ');
    },
  });
  tracePad.attach();
  syncPreview();
  now.value = props.playback?.time || 0;
  raf = requestAnimationFrame(tick);
});

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf);
  window.clearTimeout(doneTimer);
  tracePad?.detach();
  props.vision?.detachPreview?.();
});

defineExpose({ handleGesture });
</script>

<style scoped>
/* 指针轨迹墨迹：全屏但完全穿透，不影响画面操作 */
.qte-trace-layer {
  position: absolute;
  inset: 0;
  z-index: 54;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.qte-trace-layer polyline {
  fill: none;
  stroke: rgba(255, 226, 168, 0.85);
  stroke-width: 0.9;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 0.6px rgba(255, 207, 120, 0.8));
}

/* 角标：默认左上，按 node.placement 切换三个角落 */
.qte-hud {
  position: absolute;
  z-index: 56;
  width: min(340px, 38vw);
  padding: calc(10 * var(--rpx)) calc(12 * var(--rpx)) calc(9 * var(--rpx));
  box-sizing: border-box;
  border: calc(1 * var(--rpx)) solid rgba(231, 185, 90, 0.42);
  border-radius: calc(10 * var(--rpx));
  background: linear-gradient(180deg, rgba(26, 15, 8, 0.84), rgba(10, 5, 2, 0.88));
  box-shadow: 0 calc(12 * var(--rpx)) calc(30 * var(--rpx)) rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  pointer-events: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  animation: hudIn 260ms ease-out both;
}

.qte-hud.at-top-left {
  left: calc(24 * var(--rpx));
  top: calc(12 * var(--rpx));
}

.qte-hud.at-bottom-left {
  left: calc(24 * var(--rpx));
  bottom: calc(180 * var(--rpx));
}

.qte-hud.at-bottom-right {
  right: calc(24 * var(--rpx));
  bottom: calc(180 * var(--rpx));
}

.qte-hud.judge {
  border-color: rgba(255, 217, 138, 0.7);
  box-shadow: 0 calc(12 * var(--rpx)) calc(30 * var(--rpx)) rgba(0, 0, 0, 0.5),
    0 0 calc(24 * var(--rpx)) rgba(255, 207, 120, 0.24);
}

.qte-hud.success {
  border-color: rgba(255, 226, 168, 0.95);
  box-shadow: 0 0 calc(34 * var(--rpx)) rgba(255, 207, 120, 0.42);
}

.hud-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: rgba(255, 227, 163, 0.6);
  font-size: calc(18 * var(--rpx));
  letter-spacing: calc(1 * var(--rpx));
}

.hud-phase {
  color: rgba(255, 217, 138, 0.9);
}

.hud-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(6 * var(--rpx));
  margin-top: calc(6 * var(--rpx));
}

.hud-guide {
  flex: 0 0 auto;
  width: clamp(96px, 10vw, 138px);
  aspect-ratio: 260 / 330;
  filter: drop-shadow(0 calc(6 * var(--rpx)) calc(16 * var(--rpx)) rgba(0, 0, 0, 0.5));
}

.hud-copy {
  width: 100%;
  min-width: 0;
  text-align: center;
}

.hud-name {
  margin: 0;
  color: #ffe9bd;
  font-family: var(--art-font-title);
  font-size: calc(28 * var(--rpx));
  letter-spacing: calc(2 * var(--rpx));
  line-height: 1.25;
}

.hud-brief {
  margin: calc(3 * var(--rpx)) 0 0;
  color: rgba(255, 248, 225, 0.82);
  font-size: calc(19 * var(--rpx));
  line-height: 1.45;
}

.hud-hint {
  margin: calc(4 * var(--rpx)) 0 0;
  color: rgba(255, 227, 163, 0.55);
  font-size: calc(17 * var(--rpx));
  line-height: 1.5;
}

.hud-meter {
  height: calc(4 * var(--rpx));
  margin-top: calc(10 * var(--rpx));
  border-radius: calc(4 * var(--rpx));
  background: rgba(231, 185, 90, 0.16);
  overflow: hidden;
}

.hud-meter i {
  display: block;
  height: 100%;
  width: 0;
  background: linear-gradient(90deg, #7d5a26, #ffd98a);
  transition: width 0.12s linear;
}

.hud-meter.live i {
  background: linear-gradient(90deg, #a97a32, #ffe3a3);
  box-shadow: 0 0 calc(10 * var(--rpx)) rgba(231, 185, 90, 0.6);
}

.hud-meter-label {
  margin: calc(3 * var(--rpx)) 0 0;
  color: rgba(255, 227, 163, 0.46);
  font-size: calc(16 * var(--rpx));
  line-height: 1.4;
}

.hud-bar {
  height: calc(3 * var(--rpx));
  margin-top: calc(7 * var(--rpx));
  border-radius: calc(3 * var(--rpx));
  background: rgba(231, 185, 90, 0.14);
  overflow: hidden;
}

.hud-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #8d6224, #ffe3a3);
  transition: width 0.12s linear;
}

.hud-camera {
  margin-top: calc(7 * var(--rpx));
  border-radius: calc(6 * var(--rpx));
  overflow: hidden;
  border: calc(1 * var(--rpx)) solid rgba(231, 185, 90, 0.28);
  background: #050302;
}

.hud-camera canvas {
  display: block;
  width: 100%;
  height: calc(78 * var(--rpx));
  object-fit: cover;
  transform: scaleX(-1);
}

.hud-camera-btn {
  width: 100%;
  margin-top: calc(7 * var(--rpx));
  padding: calc(6 * var(--rpx)) 0;
  border: calc(1 * var(--rpx)) solid rgba(231, 185, 90, 0.5);
  border-radius: calc(6 * var(--rpx));
  background: rgba(180, 118, 40, 0.35);
  color: #ffe9bd;
  font-family: inherit;
  font-size: calc(17 * var(--rpx));
  cursor: pointer;
  pointer-events: auto;
}

.hud-success {
  margin-top: calc(6 * var(--rpx));
  padding: calc(4 * var(--rpx)) 0;
  border-radius: calc(4 * var(--rpx));
  background: rgba(255, 207, 120, 0.16);
  color: #ffe9bd;
  font-size: calc(18 * var(--rpx));
  letter-spacing: calc(2 * var(--rpx));
  text-align: center;
}

@keyframes hudIn {
  from {
    opacity: 0;
    transform: translateY(calc(6 * var(--rpx)));
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* 示意图 SVG 通过 v-html 注入，样式需要穿透 scoped */
:deep(.guide-svg) {
  display: block;
  width: 100%;
  height: 100%;
}

:deep(.g-frame) {
  fill: none;
  stroke: rgba(231, 185, 90, 0.8);
  stroke-width: 2.4;
  stroke-linejoin: round;
}

:deep(.g-frame-inner) {
  fill: none;
  stroke: rgba(231, 185, 90, 0.22);
  stroke-width: 1;
}

:deep(.g-corners path) {
  fill: none;
  stroke: rgba(231, 185, 90, 0.36);
  stroke-width: 1;
}

:deep(.g-corners circle) {
  fill: rgba(255, 217, 138, 0.55);
}

:deep(.g-index) {
  fill: rgba(231, 185, 90, 0.8);
  font-family: var(--art-font-title);
  font-size: 15px;
  letter-spacing: 0.2em;
}

:deep(.g-caption) {
  fill: rgba(255, 233, 189, 0.86);
  font-family: var(--art-font-title);
  font-size: 11px;
  letter-spacing: 0.1em;
}

:deep(.g-body .g-head),
:deep(.g-body .g-torso) {
  fill: rgba(255, 217, 138, 0.08);
  stroke: rgba(255, 219, 158, 0.62);
  stroke-width: 1.8;
  stroke-linejoin: round;
}

:deep(.g-neck),
:deep(.g-hip),
:deep(.g-leg) {
  fill: none;
  stroke: rgba(255, 215, 150, 0.4);
  stroke-width: 1.5;
  stroke-linecap: round;
}

:deep(.g-cut) {
  fill: none;
  stroke: rgba(255, 215, 150, 0.24);
  stroke-width: 1;
  stroke-dasharray: 5 5;
}

:deep(.g-face) {
  fill: none;
  stroke: rgba(255, 215, 150, 0.42);
  stroke-width: 1.2;
  stroke-linecap: round;
}

:deep(.g-arm) {
  fill: none;
  stroke: #efc775;
  stroke-width: 3.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

:deep(.g-arm.hot) {
  stroke: #ffe3a6;
  stroke-width: 4.2;
  filter: drop-shadow(0 0 6px rgba(255, 207, 120, 0.85));
}

:deep(.g-arm.ghost) {
  stroke: rgba(255, 217, 138, 0.38);
  stroke-width: 2.2;
  stroke-dasharray: 5 5;
}

:deep(.g-hand) {
  fill: none;
  stroke: #ffd98a;
  stroke-width: 2.2;
  stroke-linecap: round;
}

:deep(.g-hand.ghost) {
  stroke: rgba(255, 217, 138, 0.36);
  stroke-dasharray: 4 4;
}

:deep(.g-motions .g-arrow) {
  fill: none;
  stroke: #ffd98a;
  stroke-width: 1.9;
  stroke-linecap: round;
}

:deep(.g-motions .g-arrow.pale) {
  stroke: rgba(255, 217, 138, 0.34);
}

:deep(.g-motions .g-speed) {
  fill: none;
  stroke: rgba(255, 217, 138, 0.5);
  stroke-width: 1.4;
  stroke-linecap: round;
}

:deep(.g-pulse) {
  fill: rgba(255, 217, 138, 0.85);
}

@media (max-width: 900px) {
  .qte-hud {
    width: min(62vw, 300px);
  }

  .qte-hud.at-top-left {
    left: calc(12 * var(--rpx));
    top: calc(8 * var(--rpx));
  }

  .qte-hud.at-bottom-left,
  .qte-hud.at-bottom-right {
    bottom: calc(176 * var(--rpx) + env(safe-area-inset-bottom));
  }

  .qte-hud.at-bottom-left {
    left: calc(10 * var(--rpx));
  }

  .qte-hud.at-bottom-right {
    right: calc(10 * var(--rpx));
  }

  .hud-camera canvas {
    height: calc(62 * var(--rpx));
  }
}
</style>

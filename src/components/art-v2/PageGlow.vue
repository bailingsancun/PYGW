<!--
  实现功能：页面内「灯晕扩散」转场层（方案 4）
  职责：一个以点击点为圆心的大圆，从 scale(0) 扩到盖满屏幕，
        暖色径向渐变（中心接近白热、边缘暗棕），盖满后淡出。
  挂载：App.vue（与 TransitionVeil / PageFlash / PageCurtain 同级）
  触发：utils/pageGlow.js → playPageGlow()
  层级：z-index 97 —— 高于 PageCurtain(96)、PageFlash(95)，低于 ArtToast(999)
-->
<template>
  <div
    class="page-glow"
    :class="{ 'is-on': glowActive }"
    :style="{ left: `${glowX}px`, top: `${glowY}px` }"
    aria-hidden="true"
  ></div>
</template>

<script setup>
import { glowActive, glowX, glowY } from '@/utils/pageGlow.js';
</script>

<style scoped>
.page-glow {
  position: fixed;
  z-index: 97;
  /* 直径 300vmin（含 blur 的视觉收缩余量）：scale(0.92) 时半径已盖住从屏幕中部到最远角落。
     vmin 而不是 vmax —— 圆太大会让屏幕只落在渐变最平缓的中心区，看不出「中心亮、边缘暗」 */
  width: 300vmin;
  height: 300vmin;
  margin: -150vmin 0 0 -150vmin;
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
  /* 灯晕：柔和的米金 → 暖橙 → 赭棕，不再有白热中心，整体压暗一档 */
  background: radial-gradient(
    circle at 50% 50%,
    rgba(244, 212, 162, 0.96) 0%,
    rgba(236, 198, 146, 0.96) 16%,
    rgba(218, 170, 118, 0.96) 32%,
    rgba(190, 138, 90, 0.96) 50%,
    rgba(152, 104, 66, 0.96) 70%,
    rgba(108, 72, 44, 0.96) 86%,
    rgba(68, 44, 26, 0.96) 100%
  );
  /* 模糊感：让光晕边缘和内部层次都柔下来，像隔着灯罩看火 */
  filter: blur(14px);
  transform: scale(0);
  will-change: transform, opacity, filter;
}

.page-glow.is-on {
  animation: pageGlow 640ms cubic-bezier(0.25, 0.8, 0.35, 1) both;
}

@keyframes pageGlow {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  /* 约 300ms：光晕盖住画面，视图在这一刻切换 */
  47% {
    transform: scale(0.92);
    opacity: 1;
  }
  /* 约 435ms：切完视图后再盖住一小会儿，然后才开始散 */
  68% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(1.06);
    opacity: 0;
  }
}
</style>

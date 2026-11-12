<!--
  实现功能：页面间「幕布斜扫」微转场层（方案 3，试装）
  职责：一道柔边斜幕从画面左侧扫到右侧，扫到正中时完成路由切换；
        这条斜幕本身是暖调深棕，边缘羽化，不做硬边，避免像加载条。
  挂载：App.vue（与 TransitionVeil / PageFlash 同级）
  触发：utils/pageCurtain.js → playPageCurtain()
  层级：z-index 96 —— 高于 PageFlash(95)，低于 ArtToast(999)
-->
<template>
  <div class="page-curtain" :class="{ 'is-on': curtainActive }" aria-hidden="true"></div>
</template>

<script setup>
import { curtainActive } from '@/utils/pageCurtain.js';
</script>

<style scoped>
.page-curtain {
  position: fixed;
  top: -10%;
  bottom: -10%;
  left: -50%;
  right: -50%;
  z-index: 96;
  opacity: 0;
  pointer-events: none;
  /* 105° 斜幕：两侧羽化，中间是暖调深棕，宽度约 80vw */
  background: linear-gradient(
    105deg,
    rgba(20, 11, 6, 0) 0%,
    rgba(20, 11, 6, 0) 12%,
    rgba(28, 15, 8, 0.9) 32%,
    rgba(34, 18, 10, 0.98) 50%,
    rgba(28, 15, 8, 0.9) 68%,
    rgba(20, 11, 6, 0) 88%,
    rgba(20, 11, 6, 0) 100%
  );
  transform: translateX(-100%);
  will-change: transform, opacity;
}

.page-curtain.is-on {
  animation: pageCurtain 260ms cubic-bezier(0.5, 0, 0.3, 1) both;
}

@keyframes pageCurtain {
  0% {
    transform: translateX(-100%);
    opacity: 1;
  }
  100% {
    transform: translateX(100%);
    opacity: 1;
  }
}
</style>

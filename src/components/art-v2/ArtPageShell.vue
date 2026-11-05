<!--
  实现功能：art-v2 风格页面外壳（Web 版）
  职责：统一背景图、遮罩层、滚动容器与底部导航安全区。
        Web 差异：<image> → <img> + object-fit:cover；<scroll-view> → 原生滚动 div。
   Props：bg / theme / overlay / withBottomNav / scroll / contentClass
-->
<template>
  <div class="art-page-shell" :class="[`theme-${theme}`, { 'with-bottom-nav': withBottomNav }]">
    <img v-if="bg" class="art-page-bg" :src="bg" alt="" aria-hidden="true" />
    <div v-if="overlay" class="art-page-overlay" :style="{ background: overlay }"></div>

    <div v-if="scroll" class="art-page-scroll art-scroll-host">
      <div class="art-page-inner" :class="contentClass">
        <slot />
      </div>
    </div>

    <div v-else class="art-page-content" :class="contentClass">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  bg: { type: String, default: '' },
  theme: { type: String, default: 'dark' },
  overlay: { type: String, default: '' },
  withBottomNav: { type: Boolean, default: false },
  scroll: { type: Boolean, default: false },
  contentClass: { type: String, default: '' },
});
</script>

<style scoped>
.art-page-shell {
  position: relative;
  width: 100%;
  height: 100vh;
  /* dvh 处理移动端地址栏收放；旧浏览器回落 vh */
  height: 100dvh;
  min-height: 100vh;
  min-height: 100dvh;
  overflow: hidden;
  background: #3e2723;
  color: #fff8e1;
  font-family: var(--art-font-body);
}

.theme-paper {
  background: #f5e6d3;
  color: #2b1a16;
}

.art-page-bg,
.art-page-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.art-page-bg {
  z-index: 0;
  object-fit: cover;
  user-select: none;
}

.art-page-overlay {
  z-index: 1;
  pointer-events: none;
}

.art-page-content,
.art-page-scroll {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.art-page-content {
  overflow: hidden;
}

.art-page-inner {
  min-height: 100%;
  box-sizing: border-box;
  padding-bottom: calc(40 * var(--rpx));
}

.with-bottom-nav .art-page-content,
.with-bottom-nav .art-page-scroll {
  padding-bottom: calc(154 * var(--rpx) + env(safe-area-inset-bottom));
}

.with-bottom-nav .art-page-inner {
  padding-bottom: calc(190 * var(--rpx) + env(safe-area-inset-bottom));
}
</style>

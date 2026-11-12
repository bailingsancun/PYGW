<!--
  实现功能：底部 tab 互切时的「灯焰呼吸」微转场层（方案 1，试装）
  职责：一层固定的暖暗色遮罩，400ms 内做一次「压暗 → 回升」，
        页面在它最暗的时刻完成替换，避免底栏直接硬切。
  挂载：App.vue（与 TransitionVeil 同级；转场层必须在路由之外，否则组件随页面卸载）
  触发：utils/pageFlash.js → playPageFlash()
  层级：z-index 95 —— 盖住页面与底栏（90），但低于 ArtToast（999）
-->
<template>
  <div class="page-flash" :class="{ 'is-on': flashActive }" aria-hidden="true"></div>
</template>

<script setup>
import { flashActive } from '@/utils/pageFlash.js';
</script>

<style scoped>
.page-flash {
  position: fixed;
  inset: 0;
  z-index: 95;
  opacity: 0;
  pointer-events: none;
  /* 暖暗色：像油灯被风压了一下，中心还留一点亮 */
  background: radial-gradient(ellipse at 50% 44%, rgba(48, 25, 13, 0.52) 0%, rgba(10, 5, 3, 0.78) 100%);
  will-change: opacity;
}

.page-flash.is-on {
  animation: pageFlash 400ms cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes pageFlash {
  0% {
    opacity: 0;
  }
  40% {
    opacity: 0.72;
  }
  100% {
    opacity: 0;
  }
}
</style>

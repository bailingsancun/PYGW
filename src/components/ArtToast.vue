<!--
  实现功能：全局轻提示组件
  职责：渲染 toastState，屏幕下方居中浮现。
-->
<template>
  <transition name="art-toast">
    <div v-if="toastState.visible" class="art-toast" role="status" aria-live="polite">
      {{ toastState.message }}
    </div>
  </transition>
</template>

<script setup>
import { toastState } from '@/utils/toast.js';
</script>

<style scoped>
.art-toast {
  position: fixed;
  left: 50%;
  bottom: calc(220 * var(--rpx));
  transform: translateX(-50%);
  z-index: 999;
  max-width: calc(640 * var(--rpx));
  padding: calc(18 * var(--rpx)) calc(30 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.45);
  border-radius: calc(999 * var(--rpx));
  background: rgba(43, 26, 22, 0.92);
  color: #fff8e1;
  font-family: var(--art-font-body);
  font-size: calc(26 * var(--rpx));
  line-height: 1.4;
  text-align: center;
  box-shadow: 0 calc(10 * var(--rpx)) calc(24 * var(--rpx)) rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.art-toast-enter-active,
.art-toast-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.art-toast-enter-from,
.art-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(calc(16 * var(--rpx)));
}
</style>

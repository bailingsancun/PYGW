<!--
  实现功能：QTE 失败的黑屏闪回转场层
  职责：一个全屏黑幕，按 pageFlashBack 的相位做「压黑 → 微光 → 压黑 → 淡出」，
        中间那一下微光里显示「校准未过 · 退回前一处」，让回退看起来是戏台换场而不是卡顿。
  挂载：CurtainPage（身入影幕页内，z-index 高于 QTE 面板）
-->
<template>
  <div v-if="flashActive" class="curtain-flash" :class="`is-${flashPhase}`" aria-hidden="true">
    <div class="flash-glow"></div>
    <p class="flash-label">{{ flashLabel }}</p>
  </div>
</template>

<script setup>
import { flashActive, flashLabel, flashPhase } from '@/utils/pageFlashBack.js';
</script>

<style scoped>
.curtain-flash {
  position: absolute;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  pointer-events: none;
  opacity: 1;
}

.curtain-flash.is-in {
  animation: flashIn 90ms linear both;
}

.curtain-flash.is-hold {
  animation: flashHold 230ms ease-in-out both;
}

.curtain-flash.is-out {
  animation: flashOut 300ms ease-out both;
}

.flash-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 48%, rgba(255, 214, 138, 0.16) 0%, rgba(0, 0, 0, 0) 62%);
  opacity: 0;
}

.curtain-flash.is-hold .flash-glow {
  opacity: 1;
  animation: glowPulse 230ms ease-out both;
}

.flash-label {
  position: relative;
  margin: 0;
  color: rgba(255, 226, 168, 0.86);
  font-family: var(--art-font-title);
  font-size: calc(30 * var(--rpx));
  letter-spacing: calc(4 * var(--rpx));
  text-shadow: 0 0 calc(20 * var(--rpx)) rgba(255, 190, 90, 0.45);
  opacity: 0;
}

.curtain-flash.is-hold .flash-label {
  animation: labelIn 230ms ease-out both;
}

@keyframes flashIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes flashHold {
  0% {
    opacity: 1;
    background: #000;
  }
  40% {
    background: #120a06;
  }
  100% {
    opacity: 1;
    background: #000;
  }
}

@keyframes flashOut {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes glowPulse {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes labelIn {
  0% {
    opacity: 0;
    transform: translateY(calc(6 * var(--rpx)));
  }
  60% {
    opacity: 1;
  }
  100% {
    opacity: 0.92;
  }
}
</style>

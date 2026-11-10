<!--
  实现功能：地图标记点（Web 版）
  职责：按百分比坐标定位省份标记，选中时放大高亮。
  Props：region / x / y / active
  Events：clickMapIcon
-->
<template>
  <div
    class="map-marker"
    :class="{ active }"
    :style="{ left: x, top: y }"
    role="button"
    tabindex="0"
    @click.stop="handleClick"
    @keydown.enter.stop="handleClick"
  >
    <img class="marker-img" :src="active ? artAssets.map.markerActive : artAssets.map.marker" alt="" />
    <span class="marker-label">{{ region }}</span>
  </div>
</template>

<script setup>
import { artAssets } from '@/config/artAssets.js';

const props = defineProps({
  region: { type: String, required: true },
  x: { type: String, required: true },
  y: { type: String, required: true },
  active: { type: Boolean, default: false },
});

const emit = defineEmits(['clickMapIcon']);

const handleClick = () => {
  // 小程序 uni.vibrateShort 的 Web 等价物，不支持时静默忽略
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(10);
  }
  emit('clickMapIcon', props.region);
};
</script>

<style scoped>
.map-marker {
  position: absolute;
  z-index: 20;
  width: calc(112 * var(--rpx));
  height: calc(116 * var(--rpx));
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 让图标中心对准地图百分比坐标；标签自然落在图标下方 */
  transform: translate(-50%, calc(-36 * var(--rpx)));
  cursor: pointer;
  animation: markerFloat 2.4s ease-in-out infinite;
}

.marker-img {
  width: calc(72 * var(--rpx));
  height: calc(72 * var(--rpx));
  object-fit: contain;
  filter: drop-shadow(0 calc(8 * var(--rpx)) calc(12 * var(--rpx)) rgba(0, 0, 0, 0.45));
}

.active .marker-img {
  width: calc(94 * var(--rpx));
  height: calc(94 * var(--rpx));
  margin-top: calc(-12 * var(--rpx));
}

.marker-label {
  margin-top: calc(-2 * var(--rpx));
  padding: calc(2 * var(--rpx)) calc(10 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(255, 179, 0, 0.32);
  border-radius: calc(999 * var(--rpx));
  background: rgba(43, 26, 22, 0.72);
  color: #fff8e1;
  font-family: var(--art-font-body);
  font-size: calc(20 * var(--rpx));
  line-height: 1.2;
  white-space: nowrap;
  text-shadow: 0 calc(2 * var(--rpx)) calc(6 * var(--rpx)) rgba(0, 0, 0, 0.8);
}

.active .marker-label {
  color: #ffb300;
  font-weight: 700;
}

@keyframes markerFloat {
  0%,
  100% {
    transform: translate(-50%, calc(-36 * var(--rpx))) translateY(0);
  }
  50% {
    transform: translate(-50%, calc(-36 * var(--rpx))) translateY(calc(-8 * var(--rpx)));
  }
}
</style>

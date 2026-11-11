<!--
  实现功能：地图标记点（Web 版）
  职责：按百分比坐标定位省份标记，选中时放大高亮。
  Props：region / x / y / active
  Events：clickMapIcon

  命中区域设计（重要）：
    容器 .map-marker 是 112×116rpx 的矩形（图标 + 文字标签），若把点击绑在容器上，
    相邻标记（如河北 67,40 与山西 61,42）的矩形会大量重叠，且 DOM 靠后的元素盖在上层，
    导致「点 A 命中 B」。因此容器与标签一律 pointer-events:none，只由 .marker-hit 这个
    与视觉圆点同心、直径 76rpx 的圆形按钮接管点击——命中区贴合看到的圆，不再越界。
-->
<template>
  <div class="map-marker" :class="{ active }" :style="{ left: x, top: y }">
    <img class="marker-img" :src="active ? artAssets.map.markerActive : artAssets.map.marker" alt="" />
    <span class="marker-label">{{ region }}</span>

    <button
      type="button"
      class="marker-hit"
      :aria-label="`选择${region}`"
      :aria-pressed="active"
      @click.stop="handleClick"
      @keydown.enter.stop="handleClick"
    ></button>
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
  /* 容器不接管点击，避免矩形命中区压到相邻标记 */
  pointer-events: none;
  animation: markerFloat 2.4s ease-in-out infinite;
}

/* 选中的标记提到上层，避免被未选中的邻居盖住 */
.map-marker.active {
  z-index: 30;
}

.marker-img,
.marker-label {
  pointer-events: none;
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

/*
 * 命中区：与图标同心（容器内 y=36rpx 即坐标点位置）的圆形按钮。
 * 直径 76rpx 略大于 72rpx 的视觉图标，既容易点中，又不会像矩形那样横向越界。
 */
.marker-hit {
  position: absolute;
  left: 50%;
  top: calc(36 * var(--rpx));
  width: calc(76 * var(--rpx));
  height: calc(76 * var(--rpx));
  margin-left: calc(-38 * var(--rpx));
  margin-top: calc(-38 * var(--rpx));
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
}

.marker-hit:focus-visible {
  outline: calc(2 * var(--rpx)) solid #ffb300;
  outline-offset: calc(3 * var(--rpx));
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

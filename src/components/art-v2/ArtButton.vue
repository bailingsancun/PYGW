<!--
  实现功能：art-v2 通用按钮（Web 版）
  职责：primary/secondary 两种底图、三档尺寸、图标、按压缩放。
        Web 差异：@tap → @click；同时派发 click 与 tap 两个事件以兼容页面写法。
  Props：text / variant / size / icon / disabled / bg / pressedBg
  Events：click、tap
-->
<template>
  <button
    type="button"
    class="art-button"
    :class="[`size-${size}`, `variant-${variant}`, { disabled, pressed }]"
    :style="{ backgroundImage: `url(${currentBg})` }"
    :disabled="disabled"
    @click="handleClick"
    @pointerdown="pressed = true"
    @pointerup="pressed = false"
    @pointerleave="pressed = false"
    @pointercancel="pressed = false"
  >
    <img v-if="icon" class="button-icon" :src="icon" alt="" />
    <span class="button-text">
      <slot>{{ text }}</slot>
    </span>
  </button>
</template>

<script setup>
import { computed, ref } from 'vue';
import { artAssets } from '@/config/artAssets.js';

const props = defineProps({
  text: { type: String, default: '' },
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'medium' },
  icon: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  bg: { type: String, default: '' },
  pressedBg: { type: String, default: '' },
});

const emit = defineEmits(['click', 'tap']);
const pressed = ref(false);

const normalBg = computed(() => {
  if (props.bg) return props.bg;
  return props.variant === 'secondary' ? artAssets.common.btnSecondary : artAssets.common.btnPrimary;
});

const activeBg = computed(() => {
  if (props.pressedBg) return props.pressedBg;
  return props.variant === 'secondary'
    ? artAssets.common.btnSecondaryPressed
    : artAssets.common.btnPrimaryPressed;
});

const currentBg = computed(() => (pressed.value && !props.disabled ? activeBg.value : normalBg.value));

const handleClick = () => {
  if (props.disabled) return;
  emit('click');
  emit('tap');
};
</script>

<style scoped>
.art-button {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0;
  border: 0;
  appearance: none;
  background-color: transparent;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  color: #2b1a16;
  font-family: var(--art-font-title);
  font-weight: 700;
  text-shadow: 0 calc(2 * var(--rpx)) 0 rgba(255, 248, 225, 0.35);
  cursor: pointer;
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.pressed {
  transform: scale(0.97);
}

.disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.size-large {
  width: calc(520 * var(--rpx));
  height: calc(128 * var(--rpx));
  font-size: calc(38 * var(--rpx));
}

.size-medium {
  width: calc(420 * var(--rpx));
  height: calc(104 * var(--rpx));
  font-size: calc(32 * var(--rpx));
}

.size-small {
  width: calc(300 * var(--rpx));
  height: calc(82 * var(--rpx));
  font-size: calc(26 * var(--rpx));
}

.variant-secondary {
  color: #fff8e1;
  text-shadow: 0 calc(3 * var(--rpx)) calc(8 * var(--rpx)) rgba(0, 0, 0, 0.45);
}

.button-icon {
  width: calc(42 * var(--rpx));
  height: calc(42 * var(--rpx));
  margin-right: calc(12 * var(--rpx));
  object-fit: contain;
}

.button-text {
  line-height: 1;
  white-space: nowrap;
}
</style>

<!--
  实现功能：art-v2 风格顶部导航栏（Web 版）
  职责：标题 + 返回按钮 + 可选分享按钮，背景图随主题切换。
  用法：<ArtTopBar title="工艺流程" theme="dark" back-text="返回" />
-->
<template>
  <div class="art-top-bar" :class="[`theme-${theme}`]" :style="{ backgroundImage: `url(${barBg})` }">
    <div v-if="showBack" class="top-action left-action" role="button" tabindex="0" @click="handleBack" @keydown.enter="handleBack">
      <img class="top-icon" :src="artAssets.common.iconBack" alt="" />
      <span v-if="backText" class="action-text">{{ backText }}</span>
    </div>

    <span class="top-title">{{ title }}</span>

    <div
      v-if="showShare"
      class="top-action right-action"
      role="button"
      tabindex="0"
      @click="$emit('share')"
      @keydown.enter="$emit('share')"
    >
      <img class="top-icon" :src="artAssets.common.iconShare" alt="" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { artAssets } from '@/config/artAssets.js';

const props = defineProps({
  title: { type: String, default: '' },
  theme: { type: String, default: 'dark' },
  showBack: { type: Boolean, default: true },
  showShare: { type: Boolean, default: false },
  backText: { type: String, default: '' },
});

defineEmits(['share']);

const router = useRouter();

const barBg = computed(() => (props.theme === 'paper' ? artAssets.common.topBarPaper : artAssets.common.topBarDark));

/** 等价于小程序：有页面栈就返回，否则替身到首页 */
const handleBack = () => {
  if (window.history.length > 1) router.back();
  else router.replace('/');
};
</script>

<style scoped>
.art-top-bar {
  position: relative;
  z-index: 80;
  height: calc(160 * var(--rpx));
  padding: calc(54 * var(--rpx)) calc(28 * var(--rpx)) 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  background-position: center top;
}

.top-title {
  max-width: calc(430 * var(--rpx));
  overflow: hidden;
  color: #ffb300;
  font-family: var(--art-font-title);
  font-size: calc(38 * var(--rpx));
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
  text-overflow: ellipsis;
  text-shadow: 0 calc(4 * var(--rpx)) calc(12 * var(--rpx)) rgba(0, 0, 0, 0.55);
  white-space: nowrap;
}

.theme-paper .top-title {
  color: #3e2723;
  text-shadow: 0 calc(2 * var(--rpx)) 0 rgba(255, 248, 225, 0.5);
}

.top-action {
  position: absolute;
  top: calc(62 * var(--rpx));
  min-width: calc(78 * var(--rpx));
  height: calc(78 * var(--rpx));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.left-action {
  left: calc(24 * var(--rpx));
}

.right-action {
  right: calc(24 * var(--rpx));
}

.top-icon {
  width: calc(58 * var(--rpx));
  height: calc(58 * var(--rpx));
  object-fit: contain;
}

.action-text {
  margin-left: calc(2 * var(--rpx));
  color: #fff8e1;
  font-size: calc(26 * var(--rpx));
}
</style>

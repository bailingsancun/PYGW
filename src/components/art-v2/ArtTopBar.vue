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

/** 等价于小程序：有页面栈就返回，否则回落到着陆页 */
const handleBack = () => {
  // history.state.back 由 vue-router 维护：仅当上一条记录是本应用页面时才 back；
  // 否则（如从外链直接进入）back 会退出网站，此时回落到着陆页。
  if (window.history.state?.back) router.back();
  else router.replace('/');
};
</script>

<style scoped>
.art-top-bar {
  position: relative;
  z-index: 80;
  height: calc(160 * var(--rpx));
  /*
   * 原样式 padding-top: 54rpx 是照搬小程序给系统状态栏留的位置，
   * 但 Web 端没有状态栏，这段留白会把标题和图标整体压到偏下、且两者基线不齐
   * （标题中心 107rpx vs 图标中心 101rpx）。这里去掉顶部偏移，让内容在整条栏内居中。
   */
  padding: 0 calc(28 * var(--rpx));
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
  /* 与标题共用同一条垂直中线（栏高 160rpx 的中心），不再用固定的 top: 62rpx */
  top: 50%;
  transform: translateY(-50%);
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

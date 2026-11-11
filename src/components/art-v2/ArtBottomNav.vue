<!--
  实现功能：art-v2 底部 4 tab 导航（Web 版）
  职责：固定底部、图标高亮、跳转时携带当前地区参数。
        Web 差异：宽屏下居中限宽，避免 1920px 上被拉成长条。
  用法：<ArtBottomNav current-tab="process" :region="currentRegion" />
-->
<template>
  <div class="art-bottom-nav-wrap">
    <nav class="art-bottom-nav" :style="{ backgroundImage: `url(${artAssets.common.bottomNav})` }">
      <div
        v-for="item in artNavTabs"
        :key="item.id"
        class="nav-item"
        :class="{ active: currentTab === item.id }"
        role="link"
        tabindex="0"
        :aria-current="currentTab === item.id ? 'page' : undefined"
        @click="handleNav(item)"
        @keydown.enter="handleNav(item)"
      >
        <img class="nav-icon" :src="getIcon(item)" alt="" />
        <span class="nav-text">{{ item.text }}</span>
      </div>
    </nav>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { artAssets, artNavTabs } from '@/config/artAssets.js';
import { getCurrentRegion, saveRegion } from '@/utils/navigation.js';

const props = defineProps({
  currentTab: { type: String, required: true },
  region: { type: String, default: '' },
});

const router = useRouter();

const getIcon = (item) => {
  const key = props.currentTab === item.id ? `${item.icon}Active` : item.icon;
  return artAssets.common.navIcons[key];
};

const handleNav = (item) => {
  if (props.currentTab === item.id) return;

  const currentRegion = saveRegion(props.region || getCurrentRegion());
  // 与源工程一致：地图不带 region，其余带
  const query = item.id === 'map' ? {} : { region: currentRegion };

  router.replace({ path: item.url, query });
};
</script>

<style scoped>
.art-bottom-nav-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 90;
  display: flex;
  justify-content: center;
  pointer-events: none;
  /*
   * 底栏是居中的圆角卡片，四角之外仍然会露出页面内容（工艺页是米黄纸卡，很扎眼）。
   * 这里铺一条全宽的「由透明到深色」渐变，把卡片下方的页面压暗，
   * 让底栏看起来是浮在深色底上，而不是半透着压在纸面上。
   */
  background: linear-gradient(
    180deg,
    rgba(26, 14, 10, 0) 0%,
    rgba(26, 14, 10, 0.92) 24%,
    rgba(26, 14, 10, 0.985) 55%,
    rgba(26, 14, 10, 1) 100%
  );
}

.art-bottom-nav {
  pointer-events: auto;
  width: 100%;
  max-width: 960px;
  height: calc(154 * var(--rpx) + env(safe-area-inset-bottom));
  padding: calc(18 * var(--rpx)) calc(16 * var(--rpx)) calc(12 * var(--rpx) + env(safe-area-inset-bottom));
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-repeat: no-repeat;
  background-position: center bottom;
  background-size: 100% 100%;
  /*
   * 底栏背景是一张半透明 PNG，页面内容（工艺卡片、地图等）会透出来，显得很脏。
   * 垫一层接近不透明的深色底，图案仍在上层，观感不变但能彻底挡住后面的页面。
   */
  background-color: #24140d;
  /*
   * 圆角略大于背景图自带的圆角：裁切区把图片四角完全包住，
   * 否则两者半径不一致时，圆角缝隙会漏出页面底色。
   */
  border-radius: calc(52 * var(--rpx));
  overflow: hidden;
}

.nav-item {
  width: 25%;
  height: calc(112 * var(--rpx));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  opacity: 0.72;
  cursor: pointer;
  transition: transform 0.16s ease, opacity 0.16s ease;
}

.nav-item.active {
  opacity: 1;
  transform: translateY(calc(-6 * var(--rpx)));
}

.nav-icon {
  width: calc(48 * var(--rpx));
  height: calc(48 * var(--rpx));
  object-fit: contain;
}

.nav-text {
  margin-top: calc(4 * var(--rpx));
  color: #d4af37;
  font-family: var(--art-font-body);
  font-size: calc(22 * var(--rpx));
  line-height: 1;
  text-shadow: 0 calc(3 * var(--rpx)) calc(8 * var(--rpx)) rgba(0, 0, 0, 0.7);
}

.active .nav-text {
  color: #fff8e1;
  font-weight: 700;
}
</style>

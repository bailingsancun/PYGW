<!--
  实现功能：地区导航弹窗（Web 版）
  职责：地图页选中省份后弹出，提供「皮影展示 / 工艺流程 / 光影互动」三个入口。
  Props：region
-->
<template>
  <div class="region-popup" :style="{ backgroundImage: `url(${artAssets.map.popup})` }">
    <span class="popup-title">{{ region }}</span>
    <div class="popup-divider"></div>

    <div
      v-for="item in menuOptions"
      :key="item.id"
      class="menu-item"
      :style="{ backgroundImage: `url(${artAssets.map.menuItem})` }"
      role="link"
      tabindex="0"
      @click="handleNavigate(item)"
      @keydown.enter="handleNavigate(item)"
    >
      <span class="menu-text">{{ item.id === 'display' ? `${region}皮影` : item.label }}</span>
      <span class="menu-arrow">›</span>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { artAssets } from '@/config/artAssets.js';
import { saveRegion } from '@/utils/navigation.js';
import { showToast } from '@/utils/toast.js';

const props = defineProps({
  region: { type: String, default: '陕西' },
});

const router = useRouter();

const menuOptions = [
  { id: 'display', label: '皮影展示', path: '/display' },
  { id: 'process', label: '工艺流程', path: '/process' },
  { id: 'interactive', label: '光影互动', path: '/interactive' },
];

const handleNavigate = (option) => {
  if (!props.region) {
    showToast('请先选择地区');
    return;
  }

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(10);
  }
  const currentRegion = saveRegion(props.region);
  router.replace({ path: option.path, query: { region: currentRegion } });
};
</script>

<style scoped>
.region-popup {
  width: calc(360 * var(--rpx));
  min-height: calc(300 * var(--rpx));
  padding: calc(30 * var(--rpx)) calc(30 * var(--rpx)) calc(26 * var(--rpx));
  box-sizing: border-box;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  filter: drop-shadow(0 calc(18 * var(--rpx)) calc(24 * var(--rpx)) rgba(0, 0, 0, 0.45));
}

.popup-title {
  display: block;
  color: #ffb300;
  font-family: var(--art-font-title);
  font-size: calc(34 * var(--rpx));
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
  text-shadow: 0 calc(4 * var(--rpx)) calc(10 * var(--rpx)) rgba(0, 0, 0, 0.75);
}

.popup-divider {
  width: calc(96 * var(--rpx));
  height: calc(3 * var(--rpx));
  margin: calc(12 * var(--rpx)) auto calc(16 * var(--rpx));
  border-radius: calc(999 * var(--rpx));
  background: linear-gradient(90deg, transparent, #d4af37, transparent);
}

.menu-item {
  width: calc(300 * var(--rpx));
  height: calc(72 * var(--rpx));
  margin: calc(10 * var(--rpx)) auto 0;
  padding: 0 calc(24 * var(--rpx));
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  color: #fff8e1;
  cursor: pointer;
}

.menu-item:active {
  transform: scale(0.97);
}

.menu-text {
  max-width: calc(220 * var(--rpx));
  overflow: hidden;
  font-family: var(--art-font-body);
  font-size: calc(26 * var(--rpx));
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-arrow {
  color: #ffb300;
  font-size: calc(34 * var(--rpx));
  line-height: 1;
}
</style>

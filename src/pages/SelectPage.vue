<!--
  实现功能：地图寻影页（Web 版）
  职责：展示中国地图艺术图 + 10 个省份皮影流派标记点；
        点击标记 → 高亮选中并弹出地区导航弹窗（OptionOne，内含展示/工艺/互动三个入口）；
        点击空白或关闭按钮收起弹窗。
  接口/函数清单：
    - markers：10 个省份标记点坐标（与源码 select.vue 完全一致，百分比相对地图容器）
    - handleMapIconClick(region)：选中地区 → saveRegion → 打开弹窗
    - closeMenu()：关闭弹窗
  与源工程的差异：
    - view/text/image → div/span/img（image mode=aspectFit → object-fit: contain）
    - 地图容器宽度 min(760rpx, 100%) + aspect-ratio 760/720：源码 760rpx 在 375px 屏上
      会超出视口 5px，这里限宽到 100%，比例与 china_map_art.png（760×720）保持一致，
      标记点仍是百分比定位，不会错位
    - 宽屏（≥900px）：改为「左侧文案/当前地区 + 右侧大尺寸地图」两栏，地图按视口高度
      撑到最大并保持原比例；移动端仍是源码的单列顺序（文案 → 地图 → 当前地区条）
    - 容器自身开纵向滚动（对齐源码无 scroll-view 的整页行为）：手机与桌面内容都装得下、
      不会出现滚动条；只有 <900px 的平板竖屏会滚，避免「当前地区」条被外层裁掉
    - 弹窗在窄屏用 position: fixed 锚定视口（≈源码「距页面底部 178rpx」的屏幕位置），
      页面再高也不会飘出可视区；≥900px 才回到相对页面的 absolute
    - 弹窗新增一个关闭按钮（源码只能点空白收起），便于桌面鼠标操作
    - 本页不请求任何 shim 端点：/assets/common 由 App.vue 应用级初始化
-->
<template>
  <ArtPageShell :bg="artAssets.map.bg" with-bottom-nav overlay="rgba(14, 8, 5, 0.08)">
    <div class="map-page" @click="closeMenu">
      <ArtTopBar title="地图寻影" />

      <div class="map-copy">
        <span class="map-title">方寸之间，影戏千里</span>
        <span class="map-desc">点亮地区标记，进入对应的展示、工艺与互动戏台。</span>
      </div>

      <div class="map-stage" @click.stop>
        <img class="compass" :src="artAssets.map.compass" alt="" aria-hidden="true" />
        <img class="china-map" :src="artAssets.map.china" alt="" aria-hidden="true" />

        <MapIcon
          v-for="item in markers"
          :key="item.region"
          :region="item.region"
          :x="item.x"
          :y="item.y"
          :active="selectedRegion === item.region"
          @clickMapIcon="handleMapIconClick"
        />
      </div>

      <div class="selected-strip">
        <span class="strip-label">当前地区</span>
        <span class="strip-region">{{ selectedRegion }}</span>
      </div>

      <div class="option-container" :class="{ show: showMenu }" @click.stop>
        <button
          v-if="showMenu"
          type="button"
          class="popup-close"
          aria-label="关闭地区导航"
          @click="closeMenu"
        >
          ×
        </button>
        <OptionOne v-if="showMenu" :region="selectedRegion" />
      </div>
    </div>

    <ArtBottomNav current-tab="map" :region="selectedRegion" />
  </ArtPageShell>
</template>

<script setup>
import { ref } from 'vue';
import ArtPageShell from '@/components/art-v2/ArtPageShell.vue';
import ArtTopBar from '@/components/art-v2/ArtTopBar.vue';
import ArtBottomNav from '@/components/art-v2/ArtBottomNav.vue';
import MapIcon from '@/components/MapIcon.vue';
import OptionOne from '@/components/OptionOne.vue';
import { artAssets } from '@/config/artAssets.js';
import { getCurrentRegion, saveRegion } from '@/utils/navigation.js';

// 源码用 getCurrentRegion() 初始化（默认陕西），陕西标记点首屏即高亮
const selectedRegion = ref(getCurrentRegion());
const showMenu = ref(false);

// 与源码 select.vue 的 markers 完全一致，坐标是相对地图容器的百分比
const markers = [
  { region: '辽宁', x: '77%', y: '47%' },
  { region: '河北', x: '66%', y: '52%' },
  { region: '山西', x: '62%', y: '54%' },
  { region: '浙江', x: '74%', y: '65%' },
  { region: '福建', x: '69%', y: '72%' },
  { region: '湖北', x: '61%', y: '62%' },
  { region: '广东', x: '62%', y: '77%' },
  { region: '四川', x: '47%', y: '64%' },
  { region: '陕西', x: '55%', y: '57%' },
  { region: '甘肃', x: '37%', y: '47%' }
];

const handleMapIconClick = (region) => {
  selectedRegion.value = region;
  saveRegion(region);
  showMenu.value = true;
};

const closeMenu = () => {
  showMenu.value = false;
};
</script>

<style scoped>
/*
 * 页面容器：源页面是 100% 高度的整页，没有 scroll-view。
 * Web 版在窄/中等宽度（<900px 的平板竖屏）内容会高于视口，外层 ArtPageShell 是
 * 100dvh + overflow:hidden，所以这里给容器自身开纵向滚动，保证「当前地区」条与
 * 弹窗不会被裁掉；手机（375/390）与桌面（≥900）内容都不超出容器，行为与源码一致。
 */
.map-page {
  position: relative;
  min-height: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.map-page::-webkit-scrollbar {
  width: 0;
  height: 0;
}

/* ---------- 文案 ---------- */
.map-copy {
  padding: 24rpx 44rpx 0;
  display: flex;
  flex-direction: column;
}

.map-title {
  color: #fff8e1;
  font-size: 44rpx;
  font-weight: 700;
  line-height: 1.2;
  text-shadow: 0 5rpx 16rpx rgba(0, 0, 0, 0.72);
}

.map-desc {
  max-width: 570rpx;
  margin-top: 12rpx;
  color: rgba(255, 248, 225, 0.72);
  font-size: 25rpx;
  line-height: 1.6;
}

/* ---------- 地图舞台：比例固定 760:720（= china_map_art.png），标记点百分比定位 ---------- */
.map-stage {
  position: relative;
  width: min(760rpx, 100%);
  aspect-ratio: 760 / 720;
  margin: 48rpx auto 0;
}

.china-map {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 22rpx 28rpx rgba(0, 0, 0, 0.45));
  user-select: none;
  pointer-events: none;
}

.compass {
  position: absolute;
  z-index: 2;
  top: -70rpx;
  right: 18rpx;
  width: 142rpx;
  height: 142rpx;
  object-fit: contain;
  opacity: 0.92;
  user-select: none;
  pointer-events: none;
}

/* ---------- 当前地区条 ---------- */
.selected-strip {
  width: 630rpx;
  margin: 36rpx auto 0;
  padding: 18rpx 28rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1rpx solid rgba(212, 175, 55, 0.36);
  border-radius: 8rpx;
  background: rgba(43, 26, 22, 0.62);
}

.strip-label {
  color: rgba(255, 248, 225, 0.72);
  font-size: 24rpx;
}

.strip-region {
  color: #ffb300;
  font-size: 32rpx;
  font-weight: 700;
}

/* ---------- 地区导航弹窗 ---------- */
/* 窄屏固定到视口（≡ 源码里「距页面底部 178rpx」的屏幕位置），页面再高也不会飘出可视区 */
.option-container {
  position: fixed;
  right: 34rpx;
  bottom: calc(178rpx + env(safe-area-inset-bottom));
  z-index: 60;
  opacity: 0;
  transform: translateX(120%);
  transition: opacity 0.24s ease, transform 0.28s ease;
}

.option-container.show {
  opacity: 1;
  transform: translateX(0);
}

.popup-close {
  position: absolute;
  top: -18rpx;
  right: -18rpx;
  z-index: 2;
  width: 52rpx;
  height: 52rpx;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(212, 175, 55, 0.56);
  border-radius: 50%;
  background: rgba(43, 26, 22, 0.94);
  color: #ffb300;
  font-size: 32rpx;
  line-height: 1;
  cursor: pointer;
}

.popup-close:hover,
.popup-close:focus-visible {
  border-color: #ffb300;
  color: #fff8e1;
  outline: none;
}

/* ---------- 宽屏：左栏文案 + 右侧大尺寸地图（保持原比例） ---------- */
@media (min-width: 900px) {
  .map-page {
    /* 左侧文案栏宽 / 栏间距 / 页面左右留白 */
    --map-aside-w: 340px;
    --map-gap: 56rpx;
    --map-pad: 56rpx;
    /* 高度预算：减去顶栏 160rpx、底栏 154rpx 与 48rpx 呼吸位，其余全部给地图；
       max() 兜底极端矮窗口（否则 min() 会算出负宽度） */
    --map-stage-max-h: max(240px, calc(100vh - 362 * var(--rpx)));
    /* 宽度同时受高度（保持 760:720）与右栏可用宽度约束，1440px 下不会横向溢出 */
    --map-stage-w: min(
      calc(var(--map-stage-max-h) * 760 / 720),
      calc(100vw - var(--map-aside-w) - var(--map-gap) - var(--map-pad) * 2)
    );

    display: grid;
    grid-template-columns: minmax(260px, var(--map-aside-w)) minmax(0, 1fr);
    grid-template-rows: auto auto auto;
    align-content: start;
    align-items: start;
    column-gap: var(--map-gap);
    padding-inline: var(--map-pad);
  }

  .map-page :deep(.art-top-bar) {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .map-copy {
    grid-column: 1;
    grid-row: 2;
    align-self: end;
    padding: 0;
  }

  .map-desc {
    max-width: 100%;
  }

  .map-title {
    font-size: 48rpx;
  }

  .selected-strip {
    grid-column: 1;
    grid-row: 3;
    align-self: start;
    width: 100%;
    margin: 32rpx 0 0;
  }

  .map-stage {
    grid-column: 2;
    grid-row: 2 / span 2;
    align-self: center;
    justify-self: center;
    width: var(--map-stage-w);
    height: calc(var(--map-stage-w) * 720 / 760);
    aspect-ratio: auto;
    margin: 0;
  }

  /* 桌面端地图顶部紧挨顶栏，罗盘收进地图右上角，避免被顶栏背景挡住 */
  .compass {
    top: 8rpx;
    right: 8rpx;
    width: 130rpx;
    height: 130rpx;
  }

  .option-container {
    position: absolute;
    right: 40rpx;
    bottom: 200rpx;
  }
}
</style>

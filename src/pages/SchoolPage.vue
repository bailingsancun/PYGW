<!--
  实现功能：地域流派详情页（Web 版）
  职责：展示当前省份皮影流派的流行地区、造型、色彩、唱腔特色与代表剧目；
        以「造型 / 色彩 / 唱腔 / 剧目」四个 tab 组织四宫格维度卡，当前 tab 高亮聚焦。
  接口/函数清单：
    - fetchRegionData(provinceName)：GET /regions/by-name?name=<省名>
    - normalizeRegionInfo(data, provinceName)：保留源页多重字段回落
    - featureCards：四宫格维度卡（造型 / 色彩 / 唱腔 / 剧目）
    - plays：从代表剧目字符串解析剧目列表（支持《》格式与顿号分隔）
  与源工程的差异：
    - uni onLoad → onMounted + route.query（并优先沿用本地 currentRegion）
    - view/text/image → div/span/img
    - 源页 3 个 tab（造型/色彩/唱腔）+ 独立剧目块，按 Web 任务要求合并为 4 个 tab，
      并把四段内容同时放进响应式四宫格，保证六个字段都有真实文案渲染
    - 新增 ArtBottomNav，currentTab 沿用「展示」模块（display）
    - 宽屏铺满桌面：四宫格在桌面 2×2，移动端单列
-->
<template>
  <ArtPageShell
    :bg="artAssets.timeline.bg"
    scroll
    with-bottom-nav
    overlay="rgba(8, 4, 2, 0.2)"
  >
    <div class="school-page">
      <ArtTopBar :title="`${regionInfo.provinceName}流派`" theme="dark" back-text="展示" />

      <ArtStatus v-if="loading" title="正在读取流派详情" description="从 /regions/by-name 加载省份资料" />

      <div
        v-else
        class="school-panel"
        :style="{ backgroundImage: `url(${artAssets.common.panelPaper})` }"
      >
        <div class="panel-header">
          <span class="province-title">{{ regionInfo.provinceName }}</span>
          <span class="province-subtitle">地域流派详情</span>
        </div>

        <div
          class="info-card"
          :style="{ backgroundImage: `url(${artAssets.common.cardPaper})` }"
        >
          <span class="info-label">流行地区</span>
          <span class="info-text">{{ regionInfo.popularAreas }}</span>
        </div>

        <div class="tab-list" role="tablist" aria-label="流派维度">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            role="tab"
            class="tab-item"
            :class="{ active: currentTab === tab.key }"
            :aria-selected="currentTab === tab.key"
            :style="{
              backgroundImage: `url(${
                currentTab === tab.key ? artAssets.timeline.tabActive : artAssets.timeline.tabInactive
              })`,
            }"
            @click="currentTab = tab.key"
          >
            <span>{{ tab.label }}</span>
          </button>
        </div>

        <div class="feature-grid">
          <div
            v-for="card in featureCards"
            :key="card.key"
            class="feature-card"
            :class="{ active: currentTab === card.key }"
            :style="{ backgroundImage: `url(${artAssets.common.cardPaper})` }"
            @click="currentTab = card.key"
          >
            <div class="feature-head">
              <span class="feature-index">{{ card.index }}</span>
              <span class="feature-title">{{ card.label }}</span>
              <span v-if="currentTab === card.key" class="feature-current">当前查看</span>
            </div>

            <span v-if="card.key !== 'plays'" class="feature-text">{{ card.text }}</span>

            <div v-else class="play-tags">
              <span v-for="(play, index) in plays" :key="index" class="play-tag">{{ play }}</span>
              <span v-if="!plays.length" class="empty-play">暂无剧目数据</span>
            </div>
          </div>
        </div>

        <span class="sr-only" aria-live="polite">
          {{ currentTabLabel }}：{{ currentContent }}
        </span>
      </div>
    </div>

    <ArtBottomNav current-tab="display" :region="currentRegion" />
  </ArtPageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import request from '@/api/index.js';
import ArtPageShell from '@/components/art-v2/ArtPageShell.vue';
import ArtTopBar from '@/components/art-v2/ArtTopBar.vue';
import ArtBottomNav from '@/components/art-v2/ArtBottomNav.vue';
import ArtStatus from '@/components/art-v2/ArtStatus.vue';
import { artAssets } from '@/config/artAssets.js';
import { getCurrentRegion, normalizeRegion, saveRegion } from '@/utils/navigation.js';

const route = useRoute();

const tabs = [
  { key: 'styling', label: '造型', index: '壹' },
  { key: 'coloring', label: '色彩', index: '贰' },
  { key: 'singing', label: '唱腔', index: '叁' },
  { key: 'plays', label: '剧目', index: '肆' },
];

const currentTab = ref('styling');
const loading = ref(true);
const currentRegion = ref(getCurrentRegion());

const regionInfo = ref({
  provinceName: '',
  popularAreas: '',
  featureStyling: '',
  featureColoring: '',
  featureSinging: '',
  representativePlays: '',
});

/** 保留源页的多重字段回落（camel → 别名 → 兜底文案） */
const normalizeRegionInfo = (data, provinceName) => ({
  provinceName: data.provinceName || data.name || provinceName,
  popularAreas: data.popularAreas || data.popularArea || data.region || '暂无数据',
  featureStyling:
    data.featureStyling || data.styling || data.shapeFeatures || data.shapeFeature || '暂无数据',
  featureColoring:
    data.featureColoring || data.coloring || data.colorFeatures || data.colorFeature || '暂无数据',
  featureSinging:
    data.featureSinging || data.singing || data.singingFeatures || data.vocalFeature || '暂无数据',
  representativePlays: data.representativePlays || data.plays || data.repertoire || '',
});

const featureCards = computed(() => [
  { key: 'styling', label: '造型', index: '壹', text: regionInfo.value.featureStyling },
  { key: 'coloring', label: '色彩', index: '贰', text: regionInfo.value.featureColoring },
  { key: 'singing', label: '唱腔', index: '叁', text: regionInfo.value.featureSinging },
  { key: 'plays', label: '剧目', index: '肆', text: regionInfo.value.representativePlays },
]);

const currentContent = computed(() => {
  if (currentTab.value === 'styling') return regionInfo.value.featureStyling || '暂无数据';
  if (currentTab.value === 'coloring') return regionInfo.value.featureColoring || '暂无数据';
  if (currentTab.value === 'singing') return regionInfo.value.featureSinging || '暂无数据';
  return regionInfo.value.representativePlays || '暂无剧目数据';
});

const currentTabLabel = computed(
  () => tabs.find((tab) => tab.key === currentTab.value)?.label || '详情',
);

/** 兼容《剧目》与顿号/逗号/空白分隔两种写法 */
const plays = computed(() => {
  const raw = regionInfo.value.representativePlays || '';
  const matches = raw.match(/《.*?》/g);
  if (matches && matches.length) return matches;
  return raw.split(/[、,，;；\s]+/).filter(Boolean);
});

const fetchRegionData = async (provinceName) => {
  loading.value = true;
  try {
    const res = await request({
      url: '/regions/by-name',
      method: 'GET',
      data: { name: provinceName },
    });
    const data = res && res.code === 200 ? res.data : res?.data || res;
    if (data) {
      regionInfo.value = normalizeRegionInfo(data, provinceName);
    } else {
      regionInfo.value = normalizeRegionInfo({ provinceName }, provinceName);
    }
  } catch (error) {
    regionInfo.value = normalizeRegionInfo({ provinceName }, provinceName);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  // 兼容展示页 ?name= / 通用 ?region=；裸进页面时用本地 currentRegion（默认「陕西」，不带行政后缀）
  const queryRegion = normalizeRegion(route.query.region || route.query.name);
  const region = queryRegion || getCurrentRegion();
  currentRegion.value = region;
  saveRegion(region);
  fetchRegionData(region);
});
</script>

<style scoped>
.school-page {
  min-height: 100%;
}

/* 纸张主面板：移动端按源码 760rpx 比例收缩到视口内，桌面由媒体查询铺宽 */
.school-panel {
  width: calc(100% - 48rpx);
  max-width: 1560px;
  margin: calc(24 * var(--rpx)) auto calc(50 * var(--rpx));
  padding: calc(62 * var(--rpx)) calc(48 * var(--rpx)) calc(52 * var(--rpx));
  box-sizing: border-box;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  color: #2b1a16;
}

.panel-header {
  text-align: center;
}

.province-title,
.province-subtitle {
  display: block;
}

.province-title {
  color: #3e2723;
  font-family: var(--art-font-title);
  font-size: 58rpx;
  font-weight: 800;
  line-height: 1.12;
}

.province-subtitle {
  margin-top: 10rpx;
  color: #7a5b4a;
  font-size: 24rpx;
  letter-spacing: 2rpx;
}

.info-card,
.feature-card {
  box-sizing: border-box;
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

.info-card {
  min-height: 142rpx;
  margin-top: 28rpx;
  padding: calc(28 * var(--rpx)) calc(34 * var(--rpx));
}

.info-label {
  display: block;
  color: #b23a2e;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.info-text {
  display: block;
  margin-top: 8rpx;
  color: #3e2723;
  font-size: 26rpx;
  line-height: 1.58;
  word-break: break-word;
}

.tab-list {
  margin-top: 26rpx;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
}

.tab-item {
  min-width: 0;
  height: 76rpx;
  padding: 0 8rpx;
  border: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  color: #f5e6d3;
  font-family: var(--art-font-title);
  font-size: 26rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
  text-shadow: 0 calc(3 * var(--rpx)) calc(8 * var(--rpx)) rgba(0, 0, 0, 0.62);
  cursor: pointer;
  opacity: 0.82;
  transition: opacity 0.16s ease, transform 0.16s ease;
  -webkit-tap-highlight-color: transparent;
}

.tab-item.active {
  color: #ffe9a8;
  opacity: 1;
  transform: translateY(calc(-2 * var(--rpx)));
}

.feature-grid {
  margin-top: 24rpx;
  display: grid;
  grid-template-columns: 1fr;
  gap: 18rpx;
  align-items: stretch;
}

.feature-card {
  position: relative;
  min-width: 0;
  min-height: 150rpx;
  padding: calc(28 * var(--rpx)) calc(32 * var(--rpx)) calc(28 * var(--rpx));
  border-radius: calc(8 * var(--rpx));
  cursor: pointer;
  transition: box-shadow 0.18s ease, transform 0.18s ease;
}

.feature-card.active {
  box-shadow:
    inset 0 0 0 calc(4 * var(--rpx)) rgba(255, 179, 0, 0.52),
    0 0 calc(22 * var(--rpx)) rgba(255, 179, 0, 0.3);
  transform: translateY(calc(-2 * var(--rpx)));
}

.feature-head {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}

.feature-index {
  flex: 0 0 auto;
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(178, 58, 46, 0.4);
  border-radius: 50%;
  background: rgba(178, 58, 46, 0.1);
  color: #b23a2e;
  font-family: var(--art-font-title);
  font-size: 21rpx;
  font-weight: 700;
}

.feature-title {
  color: #3e2723;
  font-family: var(--art-font-title);
  font-size: 30rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.feature-current {
  margin-left: auto;
  padding: 3rpx 10rpx;
  border-radius: 4rpx;
  background: #b23a2e;
  color: #fff8e1;
  font-size: 19rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  white-space: nowrap;
}

.feature-text {
  display: block;
  margin-top: 14rpx;
  color: #3e2723;
  font-size: 26rpx;
  line-height: 1.7;
  word-break: break-word;
}

.play-tags {
  margin-top: 14rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.play-tag {
  padding: 8rpx 14rpx;
  border: 1rpx solid rgba(178, 58, 46, 0.28);
  border-radius: 6rpx;
  background: rgba(178, 58, 46, 0.08);
  color: #5d4037;
  font-size: 23rpx;
  line-height: 1.35;
}

.empty-play {
  color: #7a5b4a;
  font-size: 25rpx;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 桌面：面板铺满横向，信息卡改为单行，四宫格排成 2×2 */
@media (min-width: 900px) {
  .school-panel {
    width: calc(100% - 96rpx);
    margin-top: calc(28 * var(--rpx));
    padding: calc(48 * var(--rpx)) calc(64 * var(--rpx)) calc(52 * var(--rpx));
  }

  .province-title {
    font-size: 64rpx;
  }

  .province-subtitle {
    font-size: 25rpx;
  }

  /*
   * 桌面卡片宽度接近 1300px，card_paper（720×360）若继续 100%×100% 会被压成
   * 20:1 的扁条，卡纸边框完全失真；这里改成金色细线 + 红印章标签的信息带。
   */
  .info-card {
    max-width: 1080px;
    min-height: 0;
    margin: 22rpx auto 0;
    padding: calc(16 * var(--rpx)) calc(30 * var(--rpx));
    display: flex;
    align-items: center;
    gap: 20rpx;
    border-top: calc(1 * var(--rpx)) solid rgba(176, 141, 60, 0.5);
    border-bottom: calc(1 * var(--rpx)) solid rgba(176, 141, 60, 0.5);
    background-color: rgba(255, 248, 225, 0.3);
    background-image: linear-gradient(
      90deg,
      rgba(255, 248, 225, 0.66),
      rgba(255, 248, 225, 0.06)
    ) !important;
  }

  .info-label {
    flex: 0 0 auto;
    padding: 2rpx 12rpx;
    border: 1rpx solid rgba(178, 58, 46, 0.4);
    border-radius: 999px;
    background: rgba(178, 58, 46, 0.08);
    white-space: nowrap;
  }

  .info-text {
    margin-top: 0;
  }

  .tab-list {
    max-width: 900px;
    margin: 22rpx auto 0;
    gap: 18rpx;
  }

  .tab-item {
    height: 78rpx;
    font-size: 27rpx;
  }

  .feature-grid {
    margin-top: 22rpx;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22rpx;
  }

  .feature-card {
    min-height: 230rpx;
    padding: calc(30 * var(--rpx)) calc(34 * var(--rpx));
  }
}
</style>

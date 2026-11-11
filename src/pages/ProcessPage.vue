<!--
  实现功能：工艺流程页（Web 版，试点页）
  职责：展示皮影制作八道工序（选皮→制皮→画稿→过稿→镂刻→敷彩→发汗熨平→缀结合成），
        含步骤图、标题、摘要与详情；步骤图缺失时回落到 art-v2 兜底图。
  与源工程的差异：
    - uni onLoad → onMounted + route.query
    - view/text/image → div/span/img
    - 宽屏改为多列网格铺满桌面（「全响应式」策略），移动端仍是单列
-->
<template>
  <ArtPageShell
    :bg="artAssets.process.bg"
    scroll
    with-bottom-nav
    overlay="rgba(14, 7, 4, 0.18)"
  >
    <div class="process-page">
      <ArtTopBar title="工艺流程" theme="dark" back-text="返回" />

      <div class="page-intro">
        <span class="intro-title">八步成影，刀色入魂</span>
        <span class="intro-desc">循八道匠心工序，走近皮影从皮料到成偶的完整过程。</span>
      </div>

      <ArtStatus v-if="loading" title="正在铺开工艺卷轴" description="八道匠心工序即将呈现" />

      <ArtStatus
        v-else-if="loadError"
        type="error"
        title="工艺数据加载失败"
        description="无法连接服务器，请确认 shim 已启动"
        action-text="重试"
        @action="fetchProcessSteps"
      />

      <ArtStatus v-else-if="!steps.length" title="暂无工艺数据" description="请检查后端接口或数据库脚本" />

      <div v-else class="process-list">
        <div
          v-for="item in steps"
          :key="item.id"
          class="process-card"
          :style="{ backgroundImage: `url(${artAssets.process.card})` }"
        >
          <div class="card-top">
            <div class="step-badge" :style="{ backgroundImage: `url(${artAssets.process.stepBadge})` }">
              <span>{{ toChineseNum(item.stepSort) }}</span>
            </div>
            <div class="title-group">
              <span class="step-title">{{ item.title }}</span>
              <span class="step-subtitle">{{ item.subtitle || `第 ${item.stepSort} 道工序` }}</span>
            </div>
          </div>

          <img class="step-image" :src="item.imageUrl" :alt="item.title" loading="lazy" />

          <span class="summary-text">{{ item.summary }}</span>
          <span v-if="item.detailsContent" class="detail-text">{{ item.detailsContent }}</span>
        </div>
      </div>
    </div>

    <ArtBottomNav current-tab="process" :region="currentRegion" />
  </ArtPageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import request from '@/api/index.js';
import ArtPageShell from '@/components/art-v2/ArtPageShell.vue';
import ArtTopBar from '@/components/art-v2/ArtTopBar.vue';
import ArtBottomNav from '@/components/art-v2/ArtBottomNav.vue';
import ArtStatus from '@/components/art-v2/ArtStatus.vue';
import { artAssets, getProcessFallbackImage } from '@/config/artAssets.js';
import { normalizeImageUrl as normalizeServerImageUrl } from '@/store/imageStore.js';
import { getCurrentRegion, normalizeRegion, saveRegion } from '@/utils/navigation.js';

const route = useRoute();
const currentRegion = ref(getCurrentRegion());
const steps = ref([]);
const loading = ref(true);
const loadError = ref(false);

const normalizeImageUrl = (url, stepSort) => {
  if (!url) return getProcessFallbackImage(stepSort);
  return normalizeServerImageUrl(url) || getProcessFallbackImage(stepSort);
};

const normalizeStep = (item, index) => {
  const stepSort = Number(item.stepSort || item.sort || index + 1);
  return {
    id: item.id || `step-${stepSort}`,
    stepSort,
    title: item.title || item.stepName || `第 ${stepSort} 步`,
    subtitle: item.subtitle || item.subTitle || item.stageName || '',
    summary: item.summary || item.description || item.content || '',
    detailsContent: item.detailsContent || item.detailContent || item.detail || '',
    imageUrl: normalizeImageUrl(item.imageUrl || item.image_url, stepSort),
  };
};

const fetchProcessSteps = async () => {
  loading.value = true;
  loadError.value = false;
  try {
    const res = await request({ url: '/craft-process/steps', method: 'GET' });
    const data = res && res.code === 200 ? res.data : res?.data || res;
    if (Array.isArray(data) && data.length) {
      steps.value = data.map(normalizeStep).sort((a, b) => a.stepSort - b.stepSort);
    } else {
      steps.value = [];
    }
  } catch (err) {
    loadError.value = true;
    steps.value = [];
  } finally {
    loading.value = false;
  }
};

const toChineseNum = (num) => {
  const map = { 1: '壹', 2: '贰', 3: '叁', 4: '肆', 5: '伍', 6: '陆', 7: '柒', 8: '捌' };
  return map[num] || num;
};

onMounted(() => {
  const region = normalizeRegion(route.query.region) || getCurrentRegion();
  currentRegion.value = region;
  saveRegion(region);
  fetchProcessSteps();
});
</script>

<style scoped>
.process-page {
  min-height: 100%;
}

.page-intro {
  margin: calc(20 * var(--rpx)) calc(34 * var(--rpx)) calc(8 * var(--rpx));
  padding: calc(30 * var(--rpx)) calc(32 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.32);
  border-radius: calc(8 * var(--rpx));
  background: rgba(43, 26, 22, 0.62);
}

.intro-title,
.intro-desc {
  display: block;
}

.intro-title {
  color: #ffb300;
  font-family: var(--art-font-title);
  font-size: calc(38 * var(--rpx));
  font-weight: 700;
}

.intro-desc {
  margin-top: calc(12 * var(--rpx));
  color: rgba(255, 248, 225, 0.75);
  font-size: calc(25 * var(--rpx));
  line-height: 1.6;
}

.process-list {
  padding: calc(24 * var(--rpx)) calc(24 * var(--rpx)) 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: calc(26 * var(--rpx));
}

/*
 * 宽屏：铺满桌面，自动多列；移动端保持单列原样。
 * minmax(560px) 让 1440px 屏落在 2 列（约 690px/列），卡片宽高比接近原设计 750:850，
 * 避免 3 列时卡片过窄导致背景卡片框被纵向拉伸、标题压到装饰带上。
 */
@media (min-width: 900px) {
  .process-list {
    grid-template-columns: repeat(auto-fill, minmax(560px, 1fr));
    /*
     * 同排卡片等高：卡片高度由内容决定，而八道工序的文字长短不一，
     * 原来 align-items:start 会让同一行右侧卡片的背景框比左侧矮一截。
     * 用 stretch（grid 默认值）让矮的卡片被拉齐，背景图随之铺满整张卡。
     */
    align-items: stretch;
  }
}

.process-card {
  min-height: calc(360 * var(--rpx));
  padding: calc(42 * var(--rpx)) calc(44 * var(--rpx)) calc(36 * var(--rpx));
  box-sizing: border-box;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  color: #2b1a16;
}

.card-top {
  display: flex;
  align-items: center;
}

.step-badge {
  width: calc(100 * var(--rpx));
  height: calc(100 * var(--rpx));
  margin-right: calc(20 * var(--rpx));
  display: flex;
  align-items: center;
  justify-content: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  flex-shrink: 0;
}

.step-badge span {
  color: #3e2723;
  font-size: calc(32 * var(--rpx));
  font-weight: 800;
}

.title-group {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.step-title {
  color: #2b1a16;
  font-family: var(--art-font-title);
  font-size: calc(34 * var(--rpx));
  font-weight: 800;
  line-height: 1.2;
}

.step-subtitle {
  margin-top: calc(8 * var(--rpx));
  color: #7a5b4a;
  font-size: calc(24 * var(--rpx));
}

.step-image {
  width: 100%;
  height: calc(220 * var(--rpx));
  margin-top: calc(20 * var(--rpx));
  border-radius: calc(8 * var(--rpx));
  object-fit: cover;
  display: block;
}

.summary-text {
  display: block;
  margin-top: calc(18 * var(--rpx));
  color: #3e2723;
  font-size: calc(27 * var(--rpx));
  line-height: 1.62;
}

.detail-text {
  display: block;
  margin-top: calc(12 * var(--rpx));
  padding: calc(14 * var(--rpx)) calc(18 * var(--rpx));
  border-left: calc(6 * var(--rpx)) solid #d4af37;
  border-radius: calc(6 * var(--rpx));
  background: rgba(255, 248, 225, 0.58);
  color: #5d4037;
  font-size: calc(25 * var(--rpx));
  line-height: 1.66;
}
</style>

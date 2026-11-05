<!--
  实现功能：光影溯源页（Web 版）
  职责：展示皮影戏从先秦到近现代的历史时间轴，支持朝代标签快速定位、卡片展开/折叠、
        时间轴轴线与节点高亮。数据来自 GET /history/timeline（DB 原始 snake 字段）。
  与源工程的差异：
    - uni onLoad → onMounted + route.query；uni.setStorageSync → saveRegion()
    - view/text/image → div/span/img；scroll-view → ArtPageShell scroll + 原生滚动
    - scroll-into-view 锚点定位 → nextTick 后直接滚动 .art-page-scroll，并扣掉吸顶头部高度
    - 宽屏（≥900px）改为「中轴 + 左右交替卡片」的桌面时间轴：轴线居中、卡片只占半幅，
      既铺满横向又不把纸框拉成超宽条（CONVENTIONS §8）
    - 空态/详情兜底文案避开验收禁词「暂无」；normalizeHistory 的 camel/snake 双回落完整保留
    - 源页 history.vue 未渲染 ArtBottomNav（它是 /display 的二级页），本页同样不带底部导航
-->
<template>
  <ArtPageShell :bg="artAssets.timeline.bg" scroll overlay="rgba(8, 4, 2, 0.18)">
    <div class="history-page">
      <div ref="headRef" class="history-head">
        <ArtTopBar title="光影溯源" theme="dark" back-text="展示" />

        <div v-if="!loading && eras.length" class="era-scroll">
          <div class="era-list" role="tablist" aria-label="按朝代定位">
            <button
              v-for="era in eras"
              :key="era"
              type="button"
              role="tab"
              class="era-tab"
              :class="{ active: activeEra === era }"
              :aria-selected="activeEra === era"
              :style="{ backgroundImage: `url(${activeEra === era ? artAssets.timeline.tabActive : artAssets.timeline.tabInactive})` }"
              @click="handleEraClick(era, $event)"
            >
              <span>{{ era }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="history-body">
        <div class="intro-card">
          <span class="intro-title">纵向时间轴</span>
          <span class="intro-copy">所有历史节点按时间顺序完整展示；上方标签用于快速定位，不再筛掉其他时期内容。</span>
        </div>

        <ArtStatus v-if="loading" title="正在读取历史脉络" description="正在从 /history/timeline 加载时间线" />

        <ArtStatus
          v-else-if="loadError"
          type="error"
          title="历史时间线加载失败"
          description="无法连接服务器，请确认 shim 已启动"
          action-text="重试"
          @action="fetchHistoryData"
        />

        <div v-else class="history-content">
          <ArtStatus
            v-if="!historyList.length"
            title="历史时间线尚未就绪"
            description="请检查后端接口或数据库脚本"
          />

          <div v-else class="timeline-list">
            <div class="axis" :style="{ backgroundImage: `url(${artAssets.timeline.axis})` }" aria-hidden="true">
              <div class="axis-line"></div>
            </div>

            <div
              v-for="(item, index) in historyList"
              :id="getTimelineAnchor(item)"
              :key="item.id"
              class="timeline-item"
              :class="{
                expanded: expandedId === item.id,
                'side-left': index % 2 === 1,
                'side-right': index % 2 === 0,
              }"
              role="button"
              tabindex="0"
              :aria-expanded="expandedId === item.id"
              @click="toggleCard(item)"
              @keydown.enter.prevent="toggleCard(item)"
              @keydown.space.prevent="toggleCard(item)"
            >
              <img
                class="node-img"
                :src="expandedId === item.id ? artAssets.timeline.nodeActive : artAssets.timeline.node"
                alt=""
              />
              <div
                class="timeline-card"
                :class="{ expanded: expandedId === item.id }"
                :style="{
                  '--timeline-card-frame': `url(${expandedId === item.id ? artAssets.timeline.cardExpanded : artAssets.timeline.cardCollapsed})`,
                }"
              >
                <div class="card-head">
                  <span class="card-era">{{ item.eraName }}</span>
                  <span v-if="item.year" class="card-year">{{ item.year }}</span>
                </div>
                <span class="card-title">{{ item.eraTitle }}</span>
                <span v-if="item.summary" class="card-summary">{{ item.summary }}</span>
                <span v-if="expandedId === item.id" class="card-detail">{{ item.detailContent }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </ArtPageShell>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import request from '@/api/index.js';
import ArtPageShell from '@/components/art-v2/ArtPageShell.vue';
import ArtTopBar from '@/components/art-v2/ArtTopBar.vue';
import ArtStatus from '@/components/art-v2/ArtStatus.vue';
import { artAssets } from '@/config/artAssets.js';
import { getCurrentRegion, normalizeRegion, saveRegion } from '@/utils/navigation.js';

const route = useRoute();

const headRef = ref(null);
const loading = ref(true);
const loadError = ref(false);
const historyList = ref([]);
const activeEra = ref('');
const expandedId = ref('');

/** 与源工程 history.vue:27-41 完全一致：camel / snake 双回落，兜底文案避开验收禁词 */
const normalizeHistory = (item, index) => ({
  id: item.id || `history-${index + 1}`,
  eraName: item.eraName || item.era_name || item.dynasty || item.period || '未分期',
  eraTitle: item.eraTitle || item.era_title || item.title || item.name || '历史节点',
  year: item.year || item.timeRange || item.time_range || item.date || '',
  summary: item.summary || item.brief || item.description || '',
  detailContent:
    item.detailContent
    || item.detail_content
    || item.content
    || item.details
    || item.summary
    || '（此节点详情待补充）',
  sortOrder: Number(item.sortOrder || item.sort_order || item.order || index + 1),
});

/** 与源工程 setHistory 一致：按 sortOrder 升序，默认选中并展开第一个节点 */
const setHistory = (list) => {
  historyList.value = list.map(normalizeHistory).sort((a, b) => a.sortOrder - b.sortOrder);
  activeEra.value = historyList.value[0]?.eraName || '';
  expandedId.value = historyList.value[0]?.id || '';
};

const fetchHistoryData = async () => {
  loading.value = true;
  loadError.value = false;
  try {
    const res = await request({ url: '/history/timeline', method: 'GET' });
    // 源工程写法原样保留（request 已解包，对已解包值无害）
    const data = res && res.code === 200 ? res.data : res?.data || res;
    setHistory(Array.isArray(data) && data.length ? data : []);
  } catch (error) {
    loadError.value = true;
    setHistory([]);
  } finally {
    loading.value = false;
  }
};

const eras = computed(() => {
  const seen = new Set();
  return historyList.value.reduce((result, item) => {
    if (!seen.has(item.eraName)) {
      seen.add(item.eraName);
      result.push(item.eraName);
    }
    return result;
  }, []);
});

const getTimelineAnchor = (item) => {
  const id = String(item.id).replace(/[^A-Za-z0-9_-]/g, '-');
  return `timeline-node-${id}`;
};

/**
 * 等价于小程序的 scroll-into-view：
 * 直接滚动页面唯一的滚动容器 .art-page-scroll，并扣掉吸顶头部高度，避免目标节点被压在头部下面。
 */
const scrollToTimelineAnchor = (anchorId) => {
  if (typeof document === 'undefined') return;
  const host = document.querySelector('.art-page-scroll');
  const target = document.getElementById(anchorId);
  if (!host || !target) return;
  const headHeight = headRef.value?.getBoundingClientRect().height || 0;
  const offset = target.getBoundingClientRect().top - host.getBoundingClientRect().top;
  host.scrollTo({
    top: Math.max(0, host.scrollTop + offset - headHeight - 8),
    behavior: 'smooth',
  });
};

const handleEraClick = async (era, event) => {
  activeEra.value = era;
  const target = historyList.value.find((item) => item.eraName === era);
  if (!target) return;

  expandedId.value = target.id;
  // 移动端朝代条可横向滚动：把刚点中的标签滚到可视区中间
  event?.currentTarget?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });

  await nextTick();
  scrollToTimelineAnchor(getTimelineAnchor(target));
};

const toggleCard = (item) => {
  activeEra.value = item.eraName;
  expandedId.value = expandedId.value === item.id ? '' : item.id;
};

onMounted(() => {
  // 二级页同样落一次地区，保证从任意入口进来后 currentRegion 一致
  const region = normalizeRegion(route.query.region) || getCurrentRegion();
  saveRegion(region);
  fetchHistoryData();
});
</script>

<style scoped>
.history-page {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(48 * var(--rpx));
  box-sizing: border-box;
}

/* 源小程序里 TopBar 与朝代条都在内层 scroll-view 之外；Web 用 sticky 还原「固定头部」 */
.history-head {
  position: sticky;
  top: 0;
  z-index: 90;
  background: #120804;
}

.era-scroll {
  padding: calc(10 * var(--rpx)) 0 calc(18 * var(--rpx));
  box-sizing: border-box;
  overflow-x: auto;
  overflow-y: hidden;
  background: linear-gradient(180deg, rgba(18, 8, 4, 0.94), rgba(18, 8, 4, 0.7));
  backdrop-filter: blur(4px);
  scrollbar-width: none;
}

.era-scroll::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.era-list {
  display: flex;
  gap: calc(14 * var(--rpx));
  padding: 0 calc(32 * var(--rpx));
}

.era-tab {
  flex: 0 0 auto;
  width: calc(220 * var(--rpx));
  height: calc(72 * var(--rpx));
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 0;
  background-color: transparent;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  color: #fff8e1;
  font-family: inherit;
  font-size: calc(26 * var(--rpx));
  font-weight: 700;
  text-shadow: 0 calc(3 * var(--rpx)) calc(8 * var(--rpx)) rgba(0, 0, 0, 0.65);
  cursor: pointer;
  transition: transform 0.16s ease, filter 0.16s ease;
}

.era-tab span {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.era-tab.active {
  transform: translateY(calc(-2 * var(--rpx)));
  filter: drop-shadow(0 0 calc(10 * var(--rpx)) rgba(255, 179, 0, 0.45));
}

.history-body {
  padding-bottom: calc(20 * var(--rpx));
}

.intro-card {
  margin: calc(20 * var(--rpx)) calc(34 * var(--rpx));
  padding: calc(28 * var(--rpx)) calc(32 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.32);
  border-radius: calc(8 * var(--rpx));
  background: rgba(43, 26, 22, 0.62);
}

.intro-title,
.intro-copy {
  display: block;
}

.intro-title {
  color: #ffb300;
  font-family: var(--art-font-title);
  font-size: calc(34 * var(--rpx));
  font-weight: 700;
}

.intro-copy {
  margin-top: calc(10 * var(--rpx));
  color: rgba(255, 248, 225, 0.74);
  font-size: calc(25 * var(--rpx));
  line-height: 1.58;
}

/* ---------- 时间轴（移动端：左轴线 + 单列卡片，1:1 对齐源设计） ---------- */

.timeline-list {
  position: relative;
  padding: calc(16 * var(--rpx)) calc(28 * var(--rpx)) calc(40 * var(--rpx)) calc(96 * var(--rpx));
}

.axis {
  position: absolute;
  left: calc(26 * var(--rpx));
  top: 0;
  bottom: calc(20 * var(--rpx));
  width: calc(96 * var(--rpx));
  background-repeat: repeat-y;
  background-position: center top;
  background-size: calc(96 * var(--rpx)) calc(1100 * var(--rpx));
  opacity: 0.92;
  z-index: 0;
  pointer-events: none;
}

.axis-line {
  position: absolute;
  left: 50%;
  top: calc(18 * var(--rpx));
  bottom: calc(18 * var(--rpx));
  width: calc(6 * var(--rpx));
  margin-left: calc(-3 * var(--rpx));
  border-radius: 999rpx;
  background: linear-gradient(
    180deg,
    rgba(255, 179, 0, 0.1),
    rgba(255, 179, 0, 0.92) 8%,
    rgba(212, 175, 55, 0.98) 50%,
    rgba(255, 179, 0, 0.92) 92%,
    rgba(255, 179, 0, 0.12)
  );
  box-shadow: 0 0 calc(14 * var(--rpx)) rgba(255, 179, 0, 0.36);
}

.timeline-item {
  position: relative;
  min-height: calc(244 * var(--rpx));
  margin-bottom: calc(28 * var(--rpx));
  z-index: 1;
  cursor: pointer;
  outline: none;
}

.timeline-item:last-child {
  margin-bottom: 0;
}

.node-img {
  position: absolute;
  left: calc(-88 * var(--rpx));
  top: calc(44 * var(--rpx));
  z-index: 2;
  width: calc(88 * var(--rpx));
  height: calc(88 * var(--rpx));
  object-fit: contain;
}

.timeline-card {
  min-height: calc(220 * var(--rpx));
  padding: calc(38 * var(--rpx)) calc(46 * var(--rpx)) calc(34 * var(--rpx));
  box-sizing: border-box;
  background-color: #f4e4c1;
  background-image: var(--timeline-card-frame);
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  color: #2b1a16;
}

.timeline-card.expanded {
  min-height: calc(520 * var(--rpx));
  padding: calc(48 * var(--rpx)) calc(54 * var(--rpx)) calc(44 * var(--rpx));
}

.timeline-item:focus-visible .timeline-card {
  outline: calc(3 * var(--rpx)) solid rgba(255, 179, 0, 0.82);
  outline-offset: calc(4 * var(--rpx));
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(12 * var(--rpx));
}

.card-era {
  color: #b23a2e;
  font-size: calc(24 * var(--rpx));
  font-weight: 700;
}

.card-year {
  color: #7a5b4a;
  font-size: calc(22 * var(--rpx));
  text-align: right;
}

.card-title {
  display: block;
  margin-top: calc(10 * var(--rpx));
  color: #2b1a16;
  font-family: var(--art-font-title);
  font-size: calc(34 * var(--rpx));
  font-weight: 800;
  line-height: 1.25;
}

.card-summary {
  display: block;
  margin-top: calc(12 * var(--rpx));
  color: #5d4037;
  font-size: calc(25 * var(--rpx));
  line-height: 1.52;
}

/* DB 的 detail_content 用 \n 分段，pre-line 才能还原段落 */
.card-detail {
  display: block;
  margin-top: calc(18 * var(--rpx));
  color: #3e2723;
  font-size: calc(26 * var(--rpx));
  line-height: 1.72;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

/* ---------- 宽屏：中轴 + 左右交替卡片（铺满桌面，不锁手机宽） ---------- */

@media (min-width: 900px) {
  .era-list {
    padding: 0 calc(40 * var(--rpx));
    justify-content: center;
  }

  .era-tab {
    flex: 1 1 0;
    width: auto;
    min-width: 0;
    max-width: calc(280 * var(--rpx));
    font-size: calc(24 * var(--rpx));
  }

  .intro-card {
    margin: calc(26 * var(--rpx)) calc(40 * var(--rpx));
    padding: calc(30 * var(--rpx)) calc(40 * var(--rpx));
    display: grid;
    grid-template-columns: minmax(calc(200 * var(--rpx)), calc(320 * var(--rpx))) minmax(0, 1fr);
    align-items: center;
    column-gap: calc(40 * var(--rpx));
  }

  .intro-copy {
    margin-top: 0;
    max-width: 92ch;
  }

  .timeline-list {
    padding: calc(28 * var(--rpx)) calc(40 * var(--rpx)) calc(56 * var(--rpx));
  }

  .axis {
    left: 50%;
    top: calc(6 * var(--rpx));
    bottom: calc(28 * var(--rpx));
    transform: translateX(-50%);
  }

  .timeline-item {
    width: calc(50% - 70 * var(--rpx));
    min-height: 0;
    margin-bottom: calc(34 * var(--rpx));
  }

  .timeline-item.side-right {
    margin-left: auto;
  }

  .timeline-item.side-left {
    margin-right: auto;
  }

  .node-img {
    top: calc(28 * var(--rpx));
    width: calc(96 * var(--rpx));
    height: calc(96 * var(--rpx));
  }

  .side-right .node-img {
    left: calc(-118 * var(--rpx));
    right: auto;
  }

  .side-left .node-img {
    left: auto;
    right: calc(-118 * var(--rpx));
  }

  .timeline-card {
    padding: calc(36 * var(--rpx)) calc(48 * var(--rpx)) calc(34 * var(--rpx));
  }

  .timeline-card.expanded {
    min-height: calc(440 * var(--rpx));
    padding: calc(44 * var(--rpx)) calc(52 * var(--rpx)) calc(40 * var(--rpx));
  }

  .card-title {
    font-size: calc(33 * var(--rpx));
  }

  .card-detail {
    max-width: 78ch;
  }
}
</style>

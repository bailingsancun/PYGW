<!--
  实现功能：皮影展示页（Web 版）
  职责：每日一赏展示区（卷轴卡片框 + 皮影图 + 标题/描述 + 日期/标签），
        支持「换一赏」随机抽取、加载/空态/错误态、骰子旋转反馈与底部 5 tab 导航。
  与源工程的差异：
    - uni onLoad → onMounted + route.query；region 仍按 query → localStorage 的顺序解析
    - view/text/image → div/span/img；image mode="aspectFit" → object-fit: contain
    - 宽屏按「全响应式」策略改为左图右文两栏并铺满桌面，移动端仍是单列原版式
    - 增加 refresh 态（保留当前赏品、仅显示换赏中），避免后端抖动导致整页闪空
-->
<template>
  <ArtPageShell
    :bg="artAssets.daily.bg"
    scroll
    with-bottom-nav
    overlay="linear-gradient(180deg, rgba(18, 8, 4, 0.16), rgba(18, 8, 4, 0.52))"
  >
    <div class="display-page">
      <ArtTopBar title="皮影展示" theme="dark" show-share @share="handleShare" />

      <div class="display-content">
        <!-- 地区横滑条：对应源码 region-scroll，切换当前地区 -->
        <div class="region-strip" role="group" aria-label="切换地区">
          <button
            v-for="item in regions"
            :key="item"
            type="button"
            class="region-tag"
            :class="{ active: currentRegion === item }"
            :aria-pressed="currentRegion === item"
            @click="handleRegionClick(item)"
          >
            {{ item }}
          </button>
        </div>

        <!-- hero：对应源码 hero-panel -->
        <div class="hero-panel">
          <span class="hero-kicker">{{ currentRegion }}皮影</span>
          <span class="hero-title">看见流派，也看见一方水土</span>
          <span class="hero-desc">从地域流派到历史脉络，循着灯影走近各地皮影的造型、唱腔与故事。</span>
        </div>

        <!-- 功能入口：对应源码 feature-grid，补齐 /history、/school、/quiz 的入口 -->
        <nav class="feature-grid" aria-label="皮影展馆功能入口">
          <button
            v-for="item in featureCards"
            :key="item.id"
            type="button"
            class="feature-card"
            @click="navToFeature(item)"
          >
            <span class="feature-title">{{ item.title }}</span>
            <span class="feature-desc">{{ item.desc }}</span>
            <span class="feature-arrow">进入 ›</span>
          </button>
        </nav>

        <div class="section-heading">
          <div class="heading-copy">
            <span class="section-title">每日一赏</span>
            <span class="section-subtitle">Daily Appreciation</span>
          </div>
          <span class="heading-rule" aria-hidden="true"></span>
          <span class="section-region">{{ currentRegion }} · 皮影</span>
          <ArtButton
            class="daily-button"
            :class="{ 'is-spinning': dailyLoading }"
            text="换一赏"
            size="medium"
            :icon="artAssets.daily.dice"
            :bg="artAssets.daily.randomButton"
            :pressed-bg="artAssets.daily.randomButton"
            :disabled="dailyLoading"
            @click="fetchDailyPick"
          />
        </div>

        <!-- 该地区没有专属赏品时，后端会回落全库随机，这里明确告知用户 -->
        <p v-if="regionFallback && !loading && !isDailyEmpty" class="region-fallback">
          「{{ currentRegion }}」暂无专属赏品，已为你抽取其他地区的藏品
        </p>

        <ArtStatus
          v-if="loading"
          title="正在挑一件今日赏品"
          description="灯影将起，请稍候片刻"
        />

        <ArtStatus
          v-else-if="loadError"
          type="error"
          title="赏品没能取回来"
          description="请确认数据服务已就绪，再试一次"
          action-text="重新抽取"
          @action="fetchDailyPick"
        />

        <ArtStatus
          v-else-if="isDailyEmpty"
          type="empty"
          title="今日赏品正在备场"
          description="稍后再来，或轻触下方按钮再抽一张"
          action-text="换一赏"
          @action="fetchDailyPick"
        />

        <section v-else class="daily-section" aria-live="polite">
          <div
            class="daily-card"
            :class="{ 'is-refreshing': dailyLoading }"
            :style="{ backgroundImage: `url(${artAssets.daily.cardFrame})` }"
          >
            <div class="artwork-mat">
              <img
                v-if="daily.imageUrl && !artworkFailed"
                class="daily-artwork"
                :src="daily.imageUrl"
                :alt="dailyTitle"
                @error="artworkFailed = true"
              />
              <div v-else class="artwork-fallback" aria-hidden="true">
                <span class="fallback-seal">影</span>
                <span class="fallback-text">皮影</span>
              </div>
            </div>

            <div v-if="dailyLoading" class="daily-loading" role="status">
              <span class="loading-dot"></span>
              正在换赏…
            </div>
          </div>

          <div class="daily-side">
            <div
              class="daily-info"
              :style="{ backgroundImage: `url(${artAssets.daily.infoPanel})` }"
            >
              <div class="date-box">
                <span class="date-day">{{ daily.date }}</span>
                <span class="date-month">{{ daily.month }}</span>
              </div>

              <div class="daily-copy">
                <span class="daily-title">{{ dailyTitle }}</span>
                <span class="daily-desc">{{ dailyDescription }}</span>
              </div>

              <span v-if="daily.tag" class="daily-tag">{{ daily.tag }}</span>
            </div>

          </div>
        </section>
      </div>
    </div>

    <ArtBottomNav current-tab="display" :region="currentRegion" />
  </ArtPageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import request from '@/api/index.js';
import ArtPageShell from '@/components/art-v2/ArtPageShell.vue';
import ArtTopBar from '@/components/art-v2/ArtTopBar.vue';
import ArtBottomNav from '@/components/art-v2/ArtBottomNav.vue';
import ArtButton from '@/components/art-v2/ArtButton.vue';
import ArtStatus from '@/components/art-v2/ArtStatus.vue';
import { artAssets } from '@/config/artAssets.js';
import { normalizeImageUrl as normalizeServerImageUrl } from '@/store/imageStore.js';
import { getCurrentRegion, normalizeRegion, saveRegion } from '@/utils/navigation.js';
import { copyText, showToast } from '@/utils/toast.js';
import { playPageSlide } from '@/utils/pageSlide.js';

/** 换赏请求的最短时长：给骰子旋转动效留出可感知的反馈时间 */
const MIN_LOADING_MS = 420;

const route = useRoute();
const router = useRouter();
const currentRegion = ref(getCurrentRegion());

/*
 * 以下三块内容在源工程 display.vue 里都有，复刻时一度按「每日一赏 + 底部 tab」的范围漏掉了，
 * 导致 /history（时间轴）、/school（地域流派）、/quiz（答题）三个页面在 Web 端没有任何入口。
 * 这里按源码顺序补齐：地区横滑条 → hero 介绍 → 三个功能入口卡 → 每日一赏。
 */
const regions = ['辽宁', '河北', '山西', '浙江', '福建', '湖北', '广东', '四川', '陕西', '甘肃'];

const featureCards = [
  { id: 'origin', title: '光影溯源', desc: '沿时间轴追溯皮影戏的生成与流变' },
  { id: 'school', title: '地域流派', desc: '查看十省皮影的造型、唱腔与剧目' },
  { id: 'quiz', title: '知识挑战', desc: '用答题闯关检验你的皮影知识' },
];

/** 与源码 handleRegionClick 一致地切换并持久化；此外按新地区重新抽一件赏品 */
const handleRegionClick = (region) => {
  if (region === currentRegion.value) return;
  currentRegion.value = region;
  saveRegion(region);
  fetchDailyPick();
};

/** 与源码 navToFeature 一致：按卡片 id 跳转；地域流派带上当前地区
 *  三张功能卡走「影人推移」（方案 2）：旧页向左淡出、子页从右侧推入 */
const navToFeature = (item) => {
  if (item.id === 'quiz') {
    playPageSlide('forward', () => router.push('/quiz'));
    return;
  }
  if (item.id === 'origin') {
    playPageSlide('forward', () => router.push('/history'));
    return;
  }
  if (item.id === 'school') {
    playPageSlide('forward', () =>
      router.push({ path: '/school', query: { region: currentRegion.value } }),
    );
  }
};

const daily = ref(createEmptyDaily());
const loading = ref(true);
const dailyLoading = ref(false);
const loadError = ref(false);
const artworkFailed = ref(false);
/** 切换到的地区没有专属赏品，后端回落成全库随机时置真（用于给用户一行提示） */
const regionFallback = ref(false);

const isDailyEmpty = computed(() => !daily.value.title && !daily.value.imageUrl);
const dailyTitle = computed(() => daily.value.title || '皮影作品');
const dailyDescription = computed(() => daily.value.description || '一灯一影，一偶一世界。');

function getTodayMeta() {
  const now = new Date();
  return {
    date: now.getDate(),
    // 与源码一致：英文月份缩写并大写（例：NOV）
    month: now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
  };
}

function createEmptyDaily() {
  return {
    id: '',
    imageUrl: '',
    title: '',
    description: '',
    tag: '',
    region: '',
    ...getTodayMeta(),
  };
}

/** 保留源码 applyDailyData 的回落链，避免后端字段改名后整页空掉 */
const applyDailyData = (data = {}) => {
  daily.value = {
    id: data.id || '',
    imageUrl: normalizeImageUrl(data.imageUrl || data.image_url || data.url),
    title: data.title || data.name || data.puppetName || '',
    description: data.description || data.introduction || data.desc || data.summary || '',
    tag: data.tag || data.category || '',
    region: data.region || '',
    ...getTodayMeta(),
  };
  artworkFailed.value = false;
};

const normalizeImageUrl = (url) => {
  if (!url) return '';
  return normalizeServerImageUrl(url) || '';
};

/*
 * 请求序号令牌：地区条可能在上一请求在途时再次切换，旧实现用 dailyLoading 直接 return
 * 会把后一次地区静默丢弃（地区条高亮 B、赏品却还是 A）。改为每次调用自增序号、只让最新
 * 一次落地，过期响应（含错误）一律丢弃——既不串区，也不会误弹「换赏失败」。
 */
let dailyReqSeq = 0;

const fetchDailyPick = async () => {
  const reqId = ++dailyReqSeq;
  const region = currentRegion.value;

  const firstLoad = isDailyEmpty.value;
  if (firstLoad) {
    loading.value = true;
  }
  loadError.value = false;
  dailyLoading.value = true;

  const startedAt = Date.now();
  try {
    // 带上当前地区：后端优先在该地区内抽取（含「辽宁 -> 辽东」「河北 -> 唐山」这类别名），
    // 该地区没有专属藏品时回落全库并回报 regionMatched=false
    const res = await request({ url: '/daily-appreciations/random', data: { region } });
    if (reqId !== dailyReqSeq) return; // 已有更新的地区请求，丢弃过期响应
    const data = res && res.code === 200 ? res.data : res?.data || res;
    const payload = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    applyDailyData(payload);
    regionFallback.value = payload.regionMatched === false;
  } catch (error) {
    if (reqId !== dailyReqSeq) return; // 过期请求的错误不提示
    if (firstLoad) {
      loadError.value = true;
    } else {
      // 已有赏品时换赏失败：不清空画面，只提示一次
      showToast('换赏失败，请稍后重试');
    }
  } finally {
    // 只有最新请求负责收尾：等够动效时长再复位加载态，避免过期请求提前清掉 loading
    if (reqId === dailyReqSeq) {
      const remaining = MIN_LOADING_MS - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      loading.value = false;
      dailyLoading.value = false;
    }
  }
};

/** 与源码 resolveRegionParam 一致：query 多个别名回落，最终回落到本地存储 */
const resolveRegionParam = (query = {}) => {
  const rawRegion = query.region || query.name || query.province || query.area || '';
  const region = Array.isArray(rawRegion) ? rawRegion[0] : rawRegion;
  return normalizeRegion(region) || getCurrentRegion();
};

const handleShare = () => {
  copyText(window.location.href);
};

onMounted(() => {
  const region = resolveRegionParam(route.query);
  currentRegion.value = region;
  saveRegion(region);
  fetchDailyPick();
});
</script>

<style scoped>
.display-page {
  min-height: 100%;
}

.display-content {
  padding: calc(20 * var(--rpx)) calc(34 * var(--rpx)) 0;
}

/* ---------- 地区横滑条（源码 region-scroll / region-tag） ---------- */
.region-strip {
  display: flex;
  gap: calc(12 * var(--rpx));
  margin-bottom: calc(16 * var(--rpx));
  padding-bottom: calc(4 * var(--rpx));
  overflow-x: auto;
  scrollbar-width: none;
}

.region-strip::-webkit-scrollbar {
  height: 0;
}

.region-tag {
  flex: 0 0 auto;
  padding: calc(8 * var(--rpx)) calc(20 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.28);
  border-radius: 999rpx;
  background: rgba(43, 26, 22, 0.55);
  color: rgba(255, 248, 225, 0.78);
  font-family: var(--art-font-body);
  font-size: calc(23 * var(--rpx));
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease;
}

.region-tag.active {
  border-color: #d4af37;
  background: rgba(212, 175, 55, 0.18);
  color: #ffb300;
  font-weight: 700;
}

/* ---------- hero 介绍（源码 hero-panel） ---------- */
.hero-panel {
  display: flex;
  flex-direction: column;
  gap: calc(6 * var(--rpx));
  margin-bottom: calc(18 * var(--rpx));
  padding: calc(22 * var(--rpx)) calc(26 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.26);
  border-radius: calc(10 * var(--rpx));
  background: rgba(43, 26, 22, 0.5);
}

.hero-kicker {
  color: #ffb300;
  font-size: calc(23 * var(--rpx));
  font-weight: 700;
  letter-spacing: calc(1 * var(--rpx));
}

.hero-title {
  color: #fff8e1;
  font-family: var(--art-font-title);
  font-size: calc(34 * var(--rpx));
  font-weight: 700;
  line-height: 1.25;
}

.hero-desc {
  color: rgba(255, 248, 225, 0.72);
  font-size: calc(24 * var(--rpx));
  line-height: 1.6;
}

/* ---------- 功能入口卡（源码 feature-grid） ---------- */
.feature-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: calc(14 * var(--rpx));
  margin-bottom: calc(26 * var(--rpx));
}

.feature-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: calc(6 * var(--rpx));
  padding: calc(20 * var(--rpx)) calc(24 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.3);
  border-radius: calc(10 * var(--rpx));
  background: linear-gradient(160deg, rgba(94, 58, 40, 0.55), rgba(43, 26, 22, 0.75));
  color: #fff8e1;
  font-family: var(--art-font-body);
  text-align: left;
  cursor: pointer;
  transition: transform 0.16s ease, border-color 0.16s ease;
}

.feature-card:hover,
.feature-card:focus-visible {
  border-color: #d4af37;
  transform: translateY(calc(-2 * var(--rpx)));
}

.feature-card:active {
  transform: scale(0.98);
}

.feature-title {
  color: #ffb300;
  font-family: var(--art-font-title);
  font-size: calc(28 * var(--rpx));
  font-weight: 700;
}

.feature-desc {
  color: rgba(255, 248, 225, 0.72);
  font-size: calc(22 * var(--rpx));
  line-height: 1.55;
}

.feature-arrow {
  margin-top: calc(4 * var(--rpx));
  color: #d4af37;
  font-size: calc(22 * var(--rpx));
  font-weight: 700;
}

@media (min-width: 900px) {
  .feature-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

/* ---------- 每日一赏标题 ---------- */
.section-heading {
  display: flex;
  align-items: flex-end;
  gap: calc(18 * var(--rpx));
  margin-bottom: calc(22 * var(--rpx));
}

/* 地区无专属赏品时的提示条 */
.region-fallback {
  margin: calc(-10 * var(--rpx)) 0 calc(18 * var(--rpx));
  padding: calc(10 * var(--rpx)) calc(18 * var(--rpx));
  border-left: calc(4 * var(--rpx)) solid #d4af37;
  border-radius: calc(6 * var(--rpx));
  background: rgba(212, 175, 55, 0.1);
  color: rgba(255, 248, 225, 0.78);
  font-size: calc(22 * var(--rpx));
  line-height: 1.5;
}

.heading-copy {
  display: flex;
  flex-direction: column;
  padding-left: calc(22 * var(--rpx));
  border-left: calc(5 * var(--rpx)) solid #b23a2e;
}

.section-title {
  display: block;
  color: #fff8e1;
  font-family: var(--art-font-title);
  font-size: calc(42 * var(--rpx));
  font-weight: 700;
  letter-spacing: calc(2 * var(--rpx));
  line-height: 1.2;
}

.section-subtitle {
  display: block;
  margin-top: calc(4 * var(--rpx));
  color: rgba(255, 248, 225, 0.52);
  font-size: calc(20 * var(--rpx));
  letter-spacing: calc(3 * var(--rpx));
  text-transform: uppercase;
}

.heading-rule {
  display: none;
}

.section-region {
  margin-left: auto;
  padding: calc(10 * var(--rpx)) calc(20 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.34);
  border-radius: 999rpx;
  background: rgba(43, 26, 22, 0.58);
  color: #ffb300;
  font-size: calc(23 * var(--rpx));
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

/* ---------- 展示区：移动端单列 ---------- */
.daily-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(24 * var(--rpx));
}

.daily-card {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  width: min(100%, calc(600 * var(--rpx)));
  max-width: 100%;
  aspect-ratio: 760 / 900;
  /*
   * 图片必须脱离文档流：不同赏品的原图长宽比差异很大（0.63～1.4），
   * 若让 <img> 参与撑高，aspect-ratio 会被内容最小高度覆盖，
   * 长图会把信息面板和换赏按钮顶出首屏、甚至盖到底部导航下面。
   */
  min-height: 0;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  filter: drop-shadow(0 calc(20 * var(--rpx)) calc(36 * var(--rpx)) rgba(0, 0, 0, 0.42));
}

/* 与画框原图 760×900 的内衬比例对齐，四周留出金色边框与角饰 */
.artwork-mat {
  position: absolute;
  inset: 10% 9.5% 11.5%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.daily-artwork {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  /* 卡片框内是米色宣纸，人物图是白底：正片叠底把白底融进纸纹 */
  mix-blend-mode: multiply;
  transition: opacity 0.24s ease, transform 0.24s ease;
}

.is-refreshing .daily-artwork {
  opacity: 0.48;
  transform: scale(0.985);
}

.artwork-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(18 * var(--rpx));
  color: #b23a2e;
}

.fallback-seal {
  width: calc(96 * var(--rpx));
  height: calc(96 * var(--rpx));
  display: flex;
  align-items: center;
  justify-content: center;
  border: calc(3 * var(--rpx)) solid currentColor;
  border-radius: calc(8 * var(--rpx));
  font-family: var(--art-font-title);
  font-size: calc(48 * var(--rpx));
  font-weight: 700;
  line-height: 1;
}

.fallback-text {
  font-family: var(--art-font-title);
  font-size: calc(30 * var(--rpx));
  font-weight: 700;
  letter-spacing: calc(8 * var(--rpx));
}

.daily-loading {
  position: absolute;
  left: 50%;
  bottom: 12%;
  display: flex;
  align-items: center;
  gap: calc(10 * var(--rpx));
  padding: calc(10 * var(--rpx)) calc(22 * var(--rpx));
  border-radius: 999rpx;
  background: rgba(43, 26, 22, 0.82);
  box-shadow: 0 calc(6 * var(--rpx)) calc(18 * var(--rpx)) rgba(0, 0, 0, 0.28);
  color: #ffb300;
  font-size: calc(24 * var(--rpx));
  white-space: nowrap;
  transform: translateX(-50%);
}

.loading-dot {
  width: calc(10 * var(--rpx));
  height: calc(10 * var(--rpx));
  border-radius: 50%;
  background: #ffb300;
  animation: loadingPulse 0.8s ease-in-out infinite alternate;
}

.daily-side {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.daily-info {
  position: relative;
  width: 100%;
  min-height: calc(250 * var(--rpx));
  padding: calc(44 * var(--rpx)) calc(42 * var(--rpx)) calc(38 * var(--rpx));
  box-sizing: border-box;
  display: flex;
  align-items: center;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  color: #2b1a16;
  filter: drop-shadow(0 calc(14 * var(--rpx)) calc(26 * var(--rpx)) rgba(0, 0, 0, 0.3));
}

.date-box {
  width: calc(112 * var(--rpx));
  padding-right: calc(24 * var(--rpx));
  border-right: calc(2 * var(--rpx)) solid rgba(62, 39, 35, 0.18);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.date-day {
  color: #b23a2e;
  font-size: calc(60 * var(--rpx));
  font-weight: 800;
  line-height: 1;
}

.date-month {
  margin-top: calc(8 * var(--rpx));
  color: #7a5b4a;
  font-size: calc(22 * var(--rpx));
  font-weight: 700;
  letter-spacing: calc(1 * var(--rpx));
}

.daily-copy {
  flex: 1;
  min-width: 0;
  padding-left: calc(26 * var(--rpx));
  /* 给右上角的分类标签留位，避免长标题压到标签 */
  padding-right: calc(84 * var(--rpx));
}

.daily-title {
  display: block;
  color: #2b1a16;
  font-family: var(--art-font-title);
  font-size: calc(34 * var(--rpx));
  font-weight: 700;
  line-height: 1.25;
}

.daily-desc {
  display: block;
  margin-top: calc(14 * var(--rpx));
  color: #5d4037;
  font-size: calc(25 * var(--rpx));
  line-height: 1.55;
}

.daily-tag {
  position: absolute;
  right: calc(40 * var(--rpx));
  top: calc(28 * var(--rpx));
  max-width: 45%;
  overflow: hidden;
  color: #b23a2e;
  font-size: calc(22 * var(--rpx));
  font-weight: 700;
  letter-spacing: calc(1 * var(--rpx));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-heading .daily-button {
  flex: 0 0 auto;
  width: calc(180 * var(--rpx));
  height: calc(74 * var(--rpx));
  font-size: calc(25 * var(--rpx));
}

.daily-button.is-spinning :deep(.button-icon) {
  animation: diceSpin 0.75s linear infinite;
}

@keyframes diceSpin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes loadingPulse {
  from {
    opacity: 0.35;
    transform: scale(0.82);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* ---------- 宽屏：左图右文，整体居中 ---------- */
@media (min-width: 900px) {
  /*
   * 标题行与内容区统一收进一个居中的定宽容器：
   * 原来两栏用 0.94fr / 1.06fr 不对称比例，图片 justify-self:end、文字 justify-self:start
   * 又各自往中间挤，视觉重心整体偏右，右侧几乎贴边、左侧留白过多。
   */
  .section-heading,
  .daily-section {
    width: 100%;
    max-width: 1240px;
    margin-left: auto;
    margin-right: auto;
  }

  .section-heading {
    margin-bottom: calc(24 * var(--rpx));
  }

  .heading-rule {
    display: block;
    flex: 1;
    height: 1px;
    margin: 0 calc(6 * var(--rpx)) calc(4 * var(--rpx));
    background: linear-gradient(90deg, rgba(212, 175, 55, 0.45), rgba(212, 175, 55, 0));
  }

  .section-region {
    margin-left: 0;
  }

  /*
   * 用 flex + 定宽让「图 + 文」作为一个整体居中。
   * 两栏等宽网格做不到这点：图片卡实际只有 450px、文字块约 590px，
   * 各自在列内对齐后整体重心必然偏一侧（实测左留白 241、右留白 100）。
   */
  .daily-section {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: clamp(28px, 4vw, 64px);
  }

  /*
   * 卡片用高度反推宽度（画框原图 760×900），既保持画框不变形，
   * 又保证 900px 高的桌面视口里「卡片 + 信息 + 换赏按钮」不出首屏。
   */
  .daily-card {
    flex: 0 0 auto;
    width: min(calc(760 * var(--rpx)), 50vh, 520px);
  }

  .daily-side {
    flex: 0 0 auto;
    width: min(46vw, 620px);
  }

  .daily-info {
    min-height: 260px;
  }

  .daily-copy {
    /* 原为 100rpx，把文字块整体往左挤；减小后与右侧留白基本对称 */
    padding-right: calc(28 * var(--rpx));
  }

  .daily-title {
    font-size: calc(38 * var(--rpx));
  }

  .daily-desc {
    font-size: calc(26 * var(--rpx));
  }

}
</style>

<!--
  实现功能：光影互动页（Web 版）
  职责：全屏灯幕里用手电筒寻找隐藏影偶的小游戏：
        - 调用 GET /interactive-materials/random 取随机影偶（shim 不返回坐标），
          由前端 buildPuppetList 随机布点并补齐 found/justFound 状态
        - 按住指针移动光圈，松手时用 Math.hypot 判定命中（HIT_RADIUS=50）
        - 顶部进度轨道显示已寻回数量，全部找到后弹出完成面板，可再玩一次
        - 首次进入有引导层 showGuide，找到的影偶点亮并弹跳
  与源工程的差异：
    - uni.getSystemInfoSync() → window.innerWidth/innerHeight，并监听 resize 重新布点
    - @touchstart/move/end → @pointerdown/move/up/cancel，坐标取 event.clientX/clientY
    - uni.vibrateShort() → navigator.vibrate(10)
    - 游戏图层用 position:absolute + inset:0 铺满整个视口（父级 position:relative），
      宽屏下 HUD 限宽居中，避免提示条底图被横向拉变形
-->
<template>
  <ArtPageShell
    :bg="artAssets.game.bg"
    with-bottom-nav
    overlay="rgba(10, 5, 3, 0.16)"
  >
    <div class="game-page">
      <ArtTopBar title="光影互动" theme="dark" back-text="返回" />

      <!--
        入口选择：
        - 身入影幕：占位（伪功能），等交互方案定稿再接；
        - 影幕寻踪：进入原来的「手电筒寻影」玩法。
      -->
      <div v-if="mode === 'select'" class="mode-select">
        <ArtButton class="mode-btn ghost" text="身入影幕" size="large" @click="handleCurtainMode" />
        <ArtButton ref="trackBtnRef" class="mode-btn" text="影幕寻踪" size="large" @click="enterPlayMode" />
      </div>

      <template v-else>
      <div class="game-hud">
        <div class="hint-bar" :style="{ backgroundImage: `url(${artAssets.game.hint})` }">
          <img class="hint-icon" :src="artAssets.game.flashlight" alt="" draggable="false" />
          <span>按住屏幕移动光圈，寻找隐藏的皮影。</span>
        </div>

        <div class="progress-card" :style="{ backgroundImage: `url(${artAssets.game.progressTrack})` }">
          <div class="progress-slot">
            <div class="progress-fill" :style="{ width: `${progressPercent}%` }">
              <img
                v-if="foundCount > 0"
                class="progress-marker"
                :src="artAssets.game.puppetFound"
                alt=""
                draggable="false"
              />
            </div>
          </div>
          <span class="progress-text">已寻回 {{ foundCount }} / {{ totalCount }}</span>
        </div>
      </div>

      <div
        ref="stageRef"
        class="stage-area"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerCancel"
      >
        <div v-if="loading || !puppetList.length" class="stage-status">
          <ArtStatus v-if="loading" title="正在布置影偶" description="灯幕正在准备新的寻影目标" />
          <ArtStatus v-else title="暂无互动素材" description="请检查后端接口或数据库脚本" />
        </div>

        <div v-else class="puppet-layer">
          <div
            v-for="item in puppetList"
            :key="item.id"
            class="puppet-item"
            :class="{ found: item.found, shaking: item.justFound }"
            :style="{ left: `${item.x}px`, top: `${item.y}px`, width: `${item.size}px`, height: `${item.size}px` }"
          >
            <img class="puppet-img" :src="item.imageUrl" :alt="item.name" draggable="false" />
          </div>
        </div>

        <div class="dark-overlay" :style="{ background: flashlightStyle }"></div>

        <div v-if="showGuide && !loading" class="guide-card">
          <span>按住并移动，光照到影偶后松手确认。</span>
        </div>
      </div>

      <div v-if="isGameClear" class="modal-mask" @click.self="closeModal">
        <div
          class="treasure-modal"
          :style="{ backgroundImage: `url(${artAssets.game.treasureModal})` }"
          role="dialog"
          aria-modal="true"
          aria-label="寻影完成"
        >
          <span class="modal-title">寻影完成</span>
          <span class="modal-desc">所有皮影都已被你点亮，
继续探索工艺与流派会看到更多幕后细节。</span>
          <div class="reward-list">
            <img
              v-for="item in puppetList"
              :key="item.id"
              class="reward-img"
              :src="item.imageUrl"
              :alt="item.name"
              draggable="false"
            />
          </div>
          <ArtButton class="modal-btn" text="再玩一次" size="medium" @click="startGame" />
          <ArtButton class="modal-btn" text="留在现场" size="medium" variant="secondary" @click="closeModal" />
        </div>
      </div>
      </template>
    </div>

    <ArtBottomNav current-tab="interactive" :region="currentRegion" />
  </ArtPageShell>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import request from '@/api/index.js';
import ArtPageShell from '@/components/art-v2/ArtPageShell.vue';
import ArtTopBar from '@/components/art-v2/ArtTopBar.vue';
import ArtBottomNav from '@/components/art-v2/ArtBottomNav.vue';
import ArtButton from '@/components/art-v2/ArtButton.vue';
import { playPageGlow } from '@/utils/pageGlow.js';
import ArtStatus from '@/components/art-v2/ArtStatus.vue';
import { artAssets } from '@/config/artAssets.js';
import { normalizeImageUrl as normalizeServerImageUrl } from '@/store/imageStore.js';
import { getCurrentRegion, normalizeRegion, saveRegion } from '@/utils/navigation.js';
import { showToast } from '@/utils/toast.js';

// 核心流程：随机放置影偶 -> 指针移动光圈 -> 松手时计算命中距离 -> 全部命中后通关。
// 影偶尺寸、命中半径和光圈半径彼此独立，便于分别调整视觉大小与操作难度。
const PUPPET_SIZE = 70;
const HIT_RADIUS = 50;
const FLASHLIGHT_SIZE = 130;
// 引导层自动收起时间（毫秒）：与源码一致的 2600ms，第一次触摸会立刻收起。
const GUIDE_HIDE_DELAY = 2600;

const route = useRoute();
const currentRegion = ref(getCurrentRegion());

/** 「影幕寻踪」按钮：灯晕扩散的圆心取自它的中心点 */
const trackBtnRef = ref(null);

/** 入口模式：select 显示两个入口按钮；play 进入原有的寻影玩法 */
const mode = ref('select');
const puppetList = ref([]);
const loading = ref(false);
const showGuide = ref(true);
const isGameClear = ref(false);
const lightX = ref(-999);
const lightY = ref(-999);
const isTouching = ref(false);
const stageRef = ref(null);

// 视口尺寸：Web 侧替代 uni.getSystemInfoSync()，resize 时同步更新。
const screenWidth = ref(window.innerWidth);
const screenHeight = ref(window.innerHeight);

let guideTimer = null;
let clearTimer = null;

// 进度由影偶的 found 状态实时推导，不额外维护计数，避免状态不同步。
const totalCount = computed(() => puppetList.value.length);
const foundCount = computed(() => puppetList.value.filter((p) => p.found).length);
const progressPercent = computed(() => {
  if (!totalCount.value) return 0;
  return Math.round((foundCount.value / totalCount.value) * 100);
});

const flashlightStyle = computed(() => {
  // 引导结束且用户未触摸屏幕时压暗舞台；保留一点微光，避免影偶完全不可见。
  if (!isTouching.value && !showGuide.value) {
    return 'rgba(0, 0, 0, 0.82)';
  }

  // 新手引导阶段将光圈固定在屏幕中央；正常游戏时跟随指针坐标。
  const x = showGuide.value ? screenWidth.value / 2 : lightX.value;
  const y = showGuide.value ? screenHeight.value / 2 : lightY.value;

  // 径向渐变让光圈中心近乎透明，越靠近边缘遮罩越深，形成手电筒效果。
  // 边缘保留 18% 透光：只是压暗，不让阴影里的影偶变成纯黑不可见（宽屏尤其明显）。
  return `radial-gradient(circle ${FLASHLIGHT_SIZE}px at ${x}px ${y}px, rgba(255, 248, 225, 0.02) 0%, rgba(0, 0, 0, 0.08) 34%, rgba(0, 0, 0, 0.82) 100%)`;
});

const normalizeImageUrl = (url) => {
  if (!url) return artAssets.game.puppetEmpty;
  return normalizeServerImageUrl(url) || artAssets.game.puppetEmpty;
};

/** 影偶可放置区域：顶部让开 HUD，底部让开固定导航，避免小窗口下被遮挡 */
const getPlayArea = () => {
  const hudBottom = document.querySelector('.game-hud')?.getBoundingClientRect().bottom;
  const navTop = document.querySelector('.art-bottom-nav')?.getBoundingClientRect().top;
  const minX = 14;
  const maxX = Math.max(minX + 40, screenWidth.value - PUPPET_SIZE - 14);
  const minY = Math.max(90, (Number.isFinite(hudBottom) ? hudBottom : 130) + 12);
  const maxY = Math.max(
    minY + 40,
    (Number.isFinite(navTop) ? navTop : screenHeight.value - 80) - PUPPET_SIZE - 12,
  );
  return { minX, maxX, minY, maxY };
};

const buildPuppetList = (list) => {
  const area = getPlayArea();

  // 每个影偶独立随机取点；与源码一致，不做防重叠处理。
  return list.map((item, index) => ({
    ...item,
    id: item.id || `puppet-${index}`,
    name: item.name || item.puppetName || `皮影 ${index + 1}`,
    imageUrl: normalizeImageUrl(item.imageUrl || item.image_url || item.url),
    x: area.minX + Math.random() * (area.maxX - area.minX),
    y: area.minY + Math.random() * (area.maxY - area.minY),
    size: PUPPET_SIZE,
    found: false,
    justFound: false,
  }));
};

const startGame = async () => {
  if (loading.value) return;
  loading.value = true;
  isGameClear.value = false;
  showGuide.value = true;
  isTouching.value = false;
  clearTimeout(guideTimer);

  try {
    // 后端只提供本局目标，前端负责补充随机坐标和游戏状态。
    const res = await request({ url: '/interactive-materials/random' });
    const data = res && res.code === 200 ? res.data : res?.data || res;
    if (Array.isArray(data) && data.length) {
      puppetList.value = buildPuppetList(data);
    } else {
      puppetList.value = [];
    }
  } catch (e) {
    puppetList.value = [];
  } finally {
    loading.value = false;
    guideTimer = setTimeout(() => {
      showGuide.value = false;
    }, GUIDE_HIDE_DELAY);
  }
};

/** 「身入影幕」暂为占位（伪功能）：点击只给提示，等交互方案定稿再接 */
const handleCurtainMode = () => {
  showToast('身入影幕 · 敬请期待');
};

/**
 * 「影幕寻踪」= 进入原有玩法。
 * 必须等 DOM 渲染完再布点：buildPuppetList 要读 .game-hud 与底部导航的尺寸来划安全区，
 * select 模式下这些元素还不存在，提前算会让影偶落到 HUD 或导航后面。
 */
const enterPlayMode = () => {
  // 以「影幕寻踪」按钮中心为圆心做一次「灯晕扩散」：
  // 光晕盖满画面时才切到玩法，旧画面不会露出切换的那一帧。
  const btn = trackBtnRef.value?.$el || trackBtnRef.value;
  const rect = btn?.getBoundingClientRect?.();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight * 0.62;

  playPageGlow(x, y, () => {
    mode.value = 'play';
    nextTick(() => {
      startGame();
    });
  });
};

const updateLightPosition = (event) => {
  // clientX/clientY 与游戏图层的视口坐标系一致，可直接用于光圈定位。
  if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return;
  lightX.value = event.clientX;
  lightY.value = event.clientY;
};

const handlePointerDown = (event) => {
  if (loading.value) return;
  // 鼠标只响应左键；触摸/触控笔的 button 同为 0。
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  showGuide.value = false;
  isTouching.value = true;
  updateLightPosition(event);

  // 捕获指针，保证拖到舞台外（如底部导航上方）时仍能继续移动光圈并正确结算。
  try {
    stageRef.value?.setPointerCapture?.(event.pointerId);
  } catch (e) {
    /* 某些浏览器不支持指针捕获，忽略即可 */
  }
};

const handlePointerMove = (event) => {
  // 与 touchmove 语义对齐：只有按住时才更新光圈，鼠标悬停不亮灯。
  if (!isTouching.value) return;
  updateLightPosition(event);
};

const handlePointerUp = (event) => {
  // 命中只在松手时结算，拖动过程只负责预览光圈位置。
  if (!isTouching.value) return;
  isTouching.value = false;
  checkHit(event.clientX, event.clientY);
  try {
    stageRef.value?.releasePointerCapture?.(event.pointerId);
  } catch (e) {
    /* 指针未捕获时 release 会抛错，忽略即可 */
  }
};

const handlePointerCancel = () => {
  // 系统手势、来电等打断时不会再触发 pointerup，必须显式复位，
  // 否则光圈会继续跟随悬停、舞台也不再压暗。
  isTouching.value = false;
};

const checkHit = (cx, cy) => {
  let hasNewFound = false;
  puppetList.value.forEach((p) => {
    if (p.found) return;

    // 影偶的 x/y 是左上角坐标，先换算到中心点，再求触点到中心点的直线距离。
    const dist = Math.hypot(cx - (p.x + p.size / 2), cy - (p.y + p.size / 2));
    if (dist < HIT_RADIUS) {
      // 同一次松手会检查所有影偶，因此命中范围重叠时可以同时找到多个目标。
      p.found = true;
      p.justFound = true;
      hasNewFound = true;
      navigator.vibrate?.(10);
      setTimeout(() => {
        p.justFound = false;
      }, 800);
    }
  });

  // 必须本次确实找到新目标且已全部收集，才延迟显示通关弹窗。
  if (hasNewFound && foundCount.value === totalCount.value && totalCount.value > 0) {
    clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      isGameClear.value = true;
    }, 450);
  }
};

const closeModal = () => {
  isGameClear.value = false;
};

/**
 * resize 后把影偶坐标收进新的安全区域：
 * 保留 found/justFound 状态，避免缩小窗口后影偶落到 HUD 或底部导航下方。
 */
const relocatePuppets = () => {
  if (!puppetList.value.length) return;

  const area = getPlayArea();
  puppetList.value = puppetList.value.map((item) => ({
    ...item,
    x: Math.min(area.maxX, Math.max(area.minX, item.x)),
    y: Math.min(area.maxY, Math.max(area.minY, item.y)),
  }));
};

const handleResize = () => {
  const nextWidth = window.innerWidth;
  const nextHeight = window.innerHeight;
  if (screenWidth.value === nextWidth && screenHeight.value === nextHeight) return;

  screenWidth.value = nextWidth;
  screenHeight.value = nextHeight;
  relocatePuppets();
};

onMounted(() => {
  // 与 uni.getSystemInfoSync() 对齐：先取当前视口，再开始布点。
  screenWidth.value = window.innerWidth;
  screenHeight.value = window.innerHeight;

  const region = normalizeRegion(route.query.region) || getCurrentRegion();
  currentRegion.value = region;
  saveRegion(region);

  window.addEventListener('resize', handleResize);
  // 不在这里开玩法：先让用户从「身入影幕 / 影幕寻踪」里选，选后者才布点。
});

onBeforeUnmount(() => {
  clearTimeout(guideTimer);
  clearTimeout(clearTimer);
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
/*
 * 游戏页铺满整个视口：ArtPageShell 的内容区带底部导航留白，
 * 这里用绝对定位填满其 padding box，使舞台坐标与 window.innerWidth/innerHeight 一致。
 */
.game-page {
  position: absolute;
  inset: 0;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

/* ---------- 入口选择（身入影幕 / 影幕寻踪） ---------- */
.mode-select {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(44 * var(--rpx));
  /* 底部让开固定导航，让按钮组落在视觉中心而不是几何中心 */
  padding: 0 calc(60 * var(--rpx)) calc(180 * var(--rpx));
  box-sizing: border-box;
}

.mode-btn {
  width: min(calc(560 * var(--rpx)), 78vw);
}

/* 「身入影幕」是占位入口：视觉上略淡，提示尚未完全开放 */
.mode-btn.ghost {
  opacity: 0.82;
}

.game-hud {
  position: relative;
  z-index: 35;
  padding: 14rpx 34rpx 0;
}

.hint-bar {
  height: 120rpx;
  padding: 0 42rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  background-repeat: no-repeat;
  /*
   * 提示条底图 760×120，金框只占中间 197..561px（左右是透明留白）。
   * 源码用 100% 100% 会把金框压成条宽的一半、文字溢出框外；
   * 这里把底图横向放大到 209%，让金框正好铺满提示条，文字落在框内。
   */
  background-size: 209% 100%;
  background-position: center;
  color: #fff8e1;
  font-size: 25rpx;
  line-height: 1.42;
  text-shadow: 0 3rpx 8rpx rgba(0, 0, 0, 0.7);
}

.hint-icon {
  width: 54rpx;
  height: 54rpx;
  margin-right: 16rpx;
  flex-shrink: 0;
  object-fit: contain;
}

.progress-card {
  position: relative;
  width: 620rpx;
  height: 72rpx;
  margin: 12rpx auto 0;
  overflow: hidden;
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

/*
 * 进度条底图的金框只占图片中间 127..491/620，内部凹槽约 146..472/620。
 * 源码的 54rpx + max-width 510rpx 会画到金框外面，这里把填充放进凹槽内，
 * 保证不同进度下都不会溢出装饰框。
 */
.progress-slot {
  position: absolute;
  left: 23.5%;
  right: 23.5%;
  top: 50%;
  height: 14rpx;
  transform: translateY(-50%);
}

.progress-fill {
  position: relative;
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #b23a2e, #ffb300);
  transition: width 0.2s ease;
}

/* 进度条头部的小金影：命中后随进度推进，直观标出「已寻回」状态。 */
.progress-marker {
  position: absolute;
  top: 50%;
  right: 0;
  width: 42rpx;
  height: 42rpx;
  object-fit: contain;
  transform: translateY(-50%);
  filter: drop-shadow(0 0 8rpx rgba(255, 179, 0, 0.65));
  pointer-events: none;
}

.progress-text {
  position: relative;
  z-index: 2;
  display: block;
  padding-top: 20rpx;
  color: #fff8e1;
  font-size: 23rpx;
  text-align: center;
  text-shadow: 0 3rpx 8rpx rgba(0, 0, 0, 0.8);
}

.stage-area {
  position: absolute;
  inset: 0;
  z-index: 8;
  touch-action: none;
  cursor: crosshair;
}

.stage-status {
  position: absolute;
  inset: 0;
  z-index: 12;
  padding: calc(220 * var(--rpx)) calc(44 * var(--rpx)) 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.puppet-layer,
.dark-overlay {
  position: absolute;
  inset: 0;
}

.puppet-layer {
  z-index: 5;
}

.dark-overlay {
  z-index: 10;
  pointer-events: none;
  transition: background 0.08s linear;
}

.puppet-item {
  position: absolute;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.25s ease, filter 0.25s ease;
}

.puppet-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: grayscale(100%) brightness(0.85);
  user-select: none;
  pointer-events: none;
}

.puppet-item.found {
  z-index: 12;
  transform: scale(1.35);
}

.puppet-item.found .puppet-img {
  filter: grayscale(0) brightness(1.18) drop-shadow(0 0 18rpx rgba(255, 179, 0, 0.8));
}

.puppet-item.shaking {
  animation: puppetPop 0.55s ease;
}

.guide-card {
  position: absolute;
  left: 50%;
  top: 54%;
  z-index: 22;
  width: 560rpx;
  padding: 24rpx 30rpx;
  box-sizing: border-box;
  border: 1rpx solid rgba(212, 175, 55, 0.36);
  border-radius: 8rpx;
  background: rgba(43, 26, 22, 0.74);
  color: #fff8e1;
  font-size: 27rpx;
  line-height: 1.5;
  text-align: center;
  transform: translate(-50%, -50%);
  animation: guidePulse 1.8s ease-in-out infinite;
  pointer-events: none;
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 210;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.72);
}

.treasure-modal {
  width: 720rpx;
  min-height: 820rpx;
  /*
   * 弹窗底图 720×860，可见金框只有 96..622px（左右各 96px 透明留白）。
   * 源码的 78rpx 内边距会让文字/奖励图压到金框外；加到 112rpx 让内容落在框内。
   */
  padding: 116rpx 112rpx 72rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  color: #2b1a16;
}

.modal-title {
  color: #b23a2e;
  font-size: 46rpx;
  font-weight: 800;
}

/*
 * 弹窗是 column flex + align-items:center，直接放文本/图片行会按 max-content 撑开，
 * 在 Web 上表现为文字与奖励图溢出弹窗边框。显式给 100% 宽度让它们按内容区换行。
 */
.modal-desc {
  display: block;
  width: 100%;
  margin-top: 24rpx;
  color: #5d4037;
  font-size: 27rpx;
  line-height: 1.65;
  text-align: center;
  white-space: pre-line;
}

.reward-list {
  width: 100%;
  margin-top: 28rpx;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16rpx;
}

.reward-img {
  width: 96rpx;
  height: 96rpx;
  border: 2rpx solid rgba(178, 58, 46, 0.32);
  border-radius: 8rpx;
  background: rgba(255, 248, 225, 0.7);
  object-fit: contain;
}

.modal-btn {
  margin-top: 24rpx;
}

/*
 * 宽屏适配：舞台本身已铺满视口，仅约束顶部 HUD 的信息条宽度，
 * 避免 760×120 的提示条底图在 1440px 屏上被横向拉得变形。
 */
@media (min-width: 900px) {
  .game-hud {
    width: 100%;
    max-width: 960px;
    margin: 0 auto;
  }

  .hint-bar {
    max-width: 760px;
    margin: 0 auto;
  }
}

@keyframes puppetPop {
  0% {
    transform: scale(0.9) rotate(-4deg);
  }

  50% {
    transform: scale(1.48) rotate(4deg);
  }

  100% {
    transform: scale(1.35) rotate(0);
  }
}

@keyframes guidePulse {
  0%,
  100% {
    opacity: 0.78;
  }

  50% {
    opacity: 1;
  }
}
</style>

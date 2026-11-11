<!--
  实现功能：应用着陆页「云幕皮影」（Web 版）
  职责：展示非遗数字展馆徽章、品牌标题 + 标语、简介面板与「启幕寻影」入口按钮，
        作为用户进入应用的第一页；纯视觉页，不请求 shim 端点
        （/assets/common 是应用级依赖，已由 App.vue 启动时拉取）。
  接口/函数清单：
    - goToSelectPage()：进入地图选择页（源码 uni.navigateTo → router.replace），带防重复点击保护
  与源工程的差异：
    - uni.navigateTo('/pages/select/select') → router.replace('/select')
    - view/text → div/span（image 由 ArtPageShell 内部处理）
    - 外壳改用 scroll 版（源码无 scroll）：平板竖屏按 1:1 放大会高于屏高，需要滚动兜底
    - 宽屏（≥900px）放大主视觉并纵向居中；600–899px 只压缩纵向间距；手机端保持 1:1 原设计
-->
<template>
  <ArtPageShell
    :bg="artAssets.home.bg"
    scroll
    overlay="linear-gradient(180deg, rgba(25, 12, 8, 0.18), rgba(25, 12, 8, 0.36) 52%, rgba(25, 12, 8, 0.62))"
  >
    <div class="home-page">
      <div class="heritage-badge" :style="{ backgroundImage: `url(${artAssets.home.badge})` }">
        <span>非遗数字展馆</span>
      </div>

      <div class="title-wrap">
        <span class="eyebrow">CHINESE SHADOW PUPPETRY</span>
        <span class="main-title">云幕皮影</span>
        <span class="sub-title">一灯一幕，照见千年影戏</span>
      </div>

      <div class="intro-panel">
        <span class="intro-title">在指尖启幕</span>
        <span class="intro-copy">从地域流派、工艺流程到光影互动，进入一座可探索的皮影数字戏台。</span>
      </div>

      <div class="start-wrap">
        <div class="start-area" @click.stop="goToSelectPage">
          <div class="start-glow"></div>
          <ArtButton text="启幕寻影" size="large" @click="goToSelectPage" @tap="goToSelectPage" />
        </div>
      </div>
    </div>
  </ArtPageShell>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import ArtPageShell from '@/components/art-v2/ArtPageShell.vue';
import ArtButton from '@/components/art-v2/ArtButton.vue';
import { artAssets } from '@/config/artAssets.js';

const router = useRouter();
const isNavigating = ref(false);

/** 源码用 isNavigating 防重复点击：按钮 click 会冒泡到外层容器，两层都会触发本函数 */
const goToSelectPage = () => {
  if (isNavigating.value) return;
  isNavigating.value = true;

  router.replace('/select');

  window.setTimeout(() => {
    isNavigating.value = false;
  }, 300);
};
</script>

<style scoped>
.home-page {
  position: relative;
  z-index: 2;
  /*
   * 100dvh 减掉 ArtPageShell 内层固定的 padding-bottom（40rpx），
   * 这样整页刚好铺满一屏、不产生多余滚动条；视口过矮时由外层滚动容器接管。
   */
  min-height: calc(100vh - calc(40 * var(--rpx)));
  min-height: calc(100dvh - calc(40 * var(--rpx)));
  padding: calc(112 * var(--rpx)) calc(44 * var(--rpx)) 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.heritage-badge {
  width: calc(360 * var(--rpx));
  height: calc(96 * var(--rpx));
  display: flex;
  align-items: center;
  justify-content: center;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  color: #3e2723;
  font-size: calc(28 * var(--rpx));
  font-weight: 700;
  letter-spacing: calc(4 * var(--rpx));
}

.title-wrap {
  margin-top: calc(92 * var(--rpx));
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.eyebrow,
.main-title,
.sub-title {
  display: block;
}

.eyebrow {
  color: rgba(255, 248, 225, 0.72);
  font-size: calc(20 * var(--rpx));
  letter-spacing: calc(3 * var(--rpx));
}

.main-title {
  margin-top: calc(22 * var(--rpx));
  color: #fff8e1;
  font-size: calc(92 * var(--rpx));
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.05;
  text-shadow: 0 calc(8 * var(--rpx)) calc(24 * var(--rpx)) rgba(0, 0, 0, 0.72),
    0 0 calc(28 * var(--rpx)) rgba(255, 179, 0, 0.42);
}

.sub-title {
  margin-top: calc(20 * var(--rpx));
  color: #ffb300;
  font-size: calc(32 * var(--rpx));
  line-height: 1.45;
  text-shadow: 0 calc(4 * var(--rpx)) calc(14 * var(--rpx)) rgba(0, 0, 0, 0.72);
}

.intro-panel {
  width: calc(620 * var(--rpx));
  margin-top: calc(260 * var(--rpx));
  padding: calc(26 * var(--rpx)) calc(32 * var(--rpx));
  box-sizing: border-box;
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.42);
  border-radius: calc(8 * var(--rpx));
  background: rgba(43, 26, 22, 0.58);
  box-shadow: 0 calc(18 * var(--rpx)) calc(40 * var(--rpx)) rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(4px);
}

.intro-title {
  display: block;
  color: #ffb300;
  font-size: calc(32 * var(--rpx));
  font-weight: 700;
  line-height: 1.25;
}

.intro-copy {
  display: block;
  margin-top: calc(12 * var(--rpx));
  color: rgba(255, 248, 225, 0.88);
  font-size: calc(26 * var(--rpx));
  line-height: 1.7;
}

.start-wrap {
  margin-top: calc(46 * var(--rpx));
  display: flex;
  justify-content: center;
  transform-origin: center;
}

.start-area {
  position: relative;
  display: flex;
  justify-content: center;
  transform-origin: center;
  animation: breathButton 2.6s ease-in-out infinite;
}

.start-glow {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(610 * var(--rpx));
  height: calc(190 * var(--rpx));
  border-radius: calc(999 * var(--rpx));
  background: radial-gradient(ellipse at center, rgba(255, 179, 0, 0.5), rgba(255, 179, 0, 0) 68%);
  transform: translate(-50%, -50%);
  filter: blur(calc(2 * var(--rpx)));
  animation: glowPulse 2.8s ease-in-out infinite;
  pointer-events: none;
}

@keyframes glowPulse {
  0%,
  100% {
    opacity: 0.72;
    transform: translate(-50%, -50%) scale(0.96);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.05);
  }
}

@keyframes breathButton {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.035);
  }
}

/*
 * 平板竖屏（600–899px）：仍是单列设计，但 1:1 放大会让纵向超过屏高、
 * 把「启幕寻影」推到折叠线以下，因此只压缩几处大间距，视觉层级不变。
 * 手机（<600px）与桌面（≥900px）不受影响。
 */
@media (min-width: 600px) and (max-width: 899px) {
  .home-page {
    padding-top: clamp(40px, 8vh, 96px);
  }

  .title-wrap {
    margin-top: clamp(24px, 4.6vh, 64px);
  }

  .intro-panel {
    margin-top: clamp(40px, 10vh, 130px);
  }

  .start-wrap {
    margin-top: clamp(24px, 4vh, 46px);
  }
}

/*
 * 宽屏（≥900px）：保持构图居中，主视觉按视口放大铺满。
 * 竖向改为 justify-content:center 让「徽章 → 标题 → 简介 → 按钮」整体居中；
 * 尺寸用 clamp/vw 随视口缩放（不写死 max-width 把页面锁成手机宽度）。
 * 1440×900 下整块高度约 645px，留白充足，无横向溢出。
 */
@media (min-width: 900px) {
  .home-page {
    justify-content: center;
    padding-top: 0;
    padding-inline: calc(60 * var(--rpx));
  }

  .heritage-badge {
    width: clamp(260px, 24vw, 360px);
    height: auto;
    aspect-ratio: 360 / 96;
    font-size: clamp(17px, 1.3vw, 22px);
    letter-spacing: clamp(4px, 0.42vw, 7px);
  }

  .title-wrap {
    margin-top: clamp(26px, 4.4vh, 52px);
  }

  .eyebrow {
    font-size: clamp(13px, 1.05vw, 18px);
    letter-spacing: clamp(4px, 0.42vw, 7px);
  }

  .main-title {
    margin-top: clamp(12px, 1.5vh, 22px);
    font-size: clamp(64px, 7.6vw, 118px);
    text-shadow: 0 clamp(10px, 1vh, 18px) clamp(26px, 3vh, 44px) rgba(0, 0, 0, 0.72),
      0 0 clamp(30px, 3.4vh, 48px) rgba(255, 179, 0, 0.42);
  }

  .sub-title {
    margin-top: clamp(12px, 1.6vh, 22px);
    font-size: clamp(20px, 1.9vw, 30px);
    text-shadow: 0 clamp(4px, 0.6vh, 9px) clamp(14px, 2vh, 24px) rgba(0, 0, 0, 0.72);
  }

  .intro-panel {
    width: clamp(420px, 47vw, 720px);
    margin-top: clamp(30px, 5.4vh, 64px);
    padding: clamp(18px, 2.2vh, 28px) clamp(24px, 2.6vw, 42px);
    border-width: 1px;
  }

  .intro-title {
    font-size: clamp(20px, 1.7vw, 28px);
  }

  .intro-copy {
    margin-top: clamp(8px, 1vh, 14px);
    font-size: clamp(16px, 1.28vw, 22px);
  }

  .start-wrap {
    margin-top: clamp(24px, 4.2vh, 48px);
    /* ArtButton 尺寸由组件内 rpx 决定，桌面用整体缩放把主按钮推到与标题匹配的体量 */
    transform: scale(1.22);
  }
}
</style>

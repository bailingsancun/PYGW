/**
 * 实现功能：页面间「幕布斜扫」微转场（方案 3，试装）
 * 职责：一道柔边斜幕从画面左侧扫到右侧（260ms），扫到一半时完成路由切换，
 *       扫过的地方就是新页面 —— 像有人从台侧拉了一下幕。
 *
 * 适用：从「入口 / 卡片」主动进入子功能的跳转（目前接在 AI 导览的跳转上）。
 *       与方案 1（tab 互切）、方案 2（展示页 ↔ 子页）互斥使用，不会叠加。
 */
import { ref } from 'vue';

/** 幕布是否正在扫 */
export const curtainActive = ref(false);

/** 幕布扫到正中的时刻（ms），与 PageCurtain.vue 动画的 50% 对齐 */
const MID_MS = 130;

/** 整段时长（ms）：260ms 动画 + 20ms 余量 */
const TOTAL_MS = 280;

let midTimer = 0;
let endTimer = 0;

/**
 * 播放一次斜扫并切换页面。
 * @param {() => void} onMid 幕布盖住画面正中时调用，通常是 router.push(...)。
 */
export function playPageCurtain(onMid) {
  if (curtainActive.value) {
    // 作废挂起的旧回调，避免它稍后触发把路由拉回旧目标（连点竞态）
    window.clearTimeout(midTimer);
    midTimer = 0;
    if (typeof onMid === 'function') onMid();
    return;
  }

  curtainActive.value = true;
  window.clearTimeout(midTimer);
  window.clearTimeout(endTimer);

  midTimer = window.setTimeout(() => {
    if (typeof onMid === 'function') onMid();
  }, MID_MS);

  endTimer = window.setTimeout(() => {
    curtainActive.value = false;
  }, TOTAL_MS);
}

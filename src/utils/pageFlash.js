/**
 * 实现功能：底部 tab 互切时的「灯焰呼吸」微转场（方案 1）
 * 职责：暴露一个响应式开关给 <PageFlash>，并在暗场最深处调用回调完成路由切换。
 *
 * 设计口径（与 docs/转场方案 一致）：
 *   出 160ms → 峰值 → 入 240ms，总 400ms；页面在亮度最低的那一帧完成替换，
 *   观众只看到「灯闪了一下」，不会觉得在等一个动画。
 *
 * 作用域：只有底部四个 tab 互切时才调用本模块（ArtBottomNav.handleNav），
 *   首页 → 地图的「云海启幕」、子页跳转、AI 导览都不受影响。
 */
import { ref } from 'vue';

/** 暗场是否正在播放 */
export const flashActive = ref(false);

/** 峰值时刻（ms）：与 PageFlash.vue 里 @keyframes 的 40% 对齐 */
const PEAK_MS = 160;

/** 整段时长（ms）：比 400ms 多留 20ms 余量，避免 class 先于动画结束被移除 */
const TOTAL_MS = 420;

let peakTimer = 0;
let endTimer = 0;

/**
 * 播放一次呼吸并切换页面。
 * @param {() => void} onPeak 暗场最深处调用，通常就是 router.replace(...)。
 */
export function playPageFlash(onPeak) {
  // 上一次还没播完就再点：不重复叠动画，直接完成切换。
  // 必须先作废挂起的旧回调，否则它稍后触发会把路由拉回旧目标（连点竞态）
  if (flashActive.value) {
    window.clearTimeout(peakTimer);
    peakTimer = 0;
    if (typeof onPeak === 'function') onPeak();
    return;
  }

  flashActive.value = true;
  window.clearTimeout(peakTimer);
  window.clearTimeout(endTimer);

  peakTimer = window.setTimeout(() => {
    if (typeof onPeak === 'function') onPeak();
  }, PEAK_MS);

  endTimer = window.setTimeout(() => {
    flashActive.value = false;
  }, TOTAL_MS);
}

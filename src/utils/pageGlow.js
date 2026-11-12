/**
 * 实现功能：页面内「灯晕扩散」转场（方案 4）
 * 职责：从被点击的按钮中心扩散一圈柔和暖光，盖满的瞬间切换视图，
 *       然后光晕淡出露出新视图 —— 像灯从那个位置亮起来。
 *
 * 与其它转场的分工：
 *   - 底部 tab 互切：pageFlash（灯焰呼吸）
 *   - 展示页 ↔ 子页：pageSlide（影人推移）
 *   - AI 导览跳转：pageCurtain（幕布斜扫）
 *   - 本模块：页面内的「入口 → 玩法」切换（目前接在互动页「影幕寻踪」）
 *
 * 坐标取不到时（键盘触发、自动化点击）回落到画面中心偏下，不影响观感。
 */
import { ref } from 'vue';

/** 光晕是否正在扩散 */
export const glowActive = ref(false);

/** 光晕圆心（视口坐标，px） */
export const glowX = ref(0);
export const glowY = ref(0);

/** 光晕盖满画面、可以切换视图的时刻（ms），与 PageGlow.vue 动画的 47% 对齐 */
const COVER_MS = 300;

/** 整段时长（ms）：640ms 动画 + 40ms 余量，留出淡出时间 */
const TOTAL_MS = 680;

let coverTimer = 0;
let endTimer = 0;

/**
 * 播放一次灯晕扩散。
 * @param {number} x 光晕圆心 X（viewport 坐标）
 * @param {number} y 光晕圆心 Y（viewport 坐标）
 * @param {() => void} onCover 光晕盖满时调用，用来切换视图（此时看不见旧画面）
 */
export function playPageGlow(x, y, onCover) {
  // 上一次还没散完就再次触发：不叠动画，直接完成切换
  if (glowActive.value) {
    if (typeof onCover === 'function') onCover();
    return;
  }

  glowX.value = Number.isFinite(x) ? x : window.innerWidth / 2;
  glowY.value = Number.isFinite(y) ? y : window.innerHeight * 0.62;
  glowActive.value = true;

  window.clearTimeout(coverTimer);
  window.clearTimeout(endTimer);

  coverTimer = window.setTimeout(() => {
    if (typeof onCover === 'function') onCover();
  }, COVER_MS);

  endTimer = window.setTimeout(() => {
    glowActive.value = false;
  }, TOTAL_MS);
}

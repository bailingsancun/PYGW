/**
 * 实现功能：QTE 校准失败时的「黑屏闪回」微转场
 * 职责：快速压黑 → 一帧微光（露出「退回前一处」的提示）→ 再压黑 → 淡出，
 *       在第二次压黑的那一刻执行时间轴回退，玩家看不到画面的跳变。
 * 用法：await playFlashBack(() => playback.rollbackTo(node))
 */
import { ref, shallowRef } from 'vue';

export const flashActive = ref(false);
export const flashPhase = ref('dark');
export const flashLabel = shallowRef('');

const PREPARE_MS = 90;
const COVER_MS = 320;
const TOTAL_MS = 620;

let coverTimer = 0;
let endTimer = 0;
let phaseTimers = [];
let settlePending = null;

const clearTimers = () => {
  window.clearTimeout(coverTimer);
  window.clearTimeout(endTimer);
  phaseTimers.forEach((timer) => window.clearTimeout(timer));
  phaseTimers = [];
  // 取消/重播时结算上一次悬挂的 Promise，调用方的 await 不能永不返回
  if (settlePending) {
    const resolve = settlePending;
    settlePending = null;
    resolve();
  }
};

/**
 * 播放一次黑屏闪回。
 * @param {() => void|Promise<void>} onCover 完全压黑时执行（用于回退时间轴）
 * @param {string} label 黑屏中的提示文案
 */
export function playFlashBack(onCover, label = '校准未过 · 退回前一处') {
  clearTimers();
  flashLabel.value = label;
  flashActive.value = true;
  flashPhase.value = 'in';

  return new Promise((resolve) => {
    settlePending = resolve;
    phaseTimers.push(
      window.setTimeout(() => {
        flashPhase.value = 'hold';
      }, PREPARE_MS),
    );
    coverTimer = window.setTimeout(async () => {
      flashPhase.value = 'out';
      try {
        await onCover?.();
      } catch (error) {
        console.warn('[curtain] 回退失败', error);
      }
    }, COVER_MS);
    endTimer = window.setTimeout(() => {
      flashActive.value = false;
      flashPhase.value = 'dark';
      settlePending = null;
      resolve();
    }, TOTAL_MS);
  });
}

export function cancelFlashBack() {
  clearTimers();
  flashActive.value = false;
  flashPhase.value = 'dark';
}

/**
 * 实现功能：「云海启幕」转场（草案 05）的播放控制
 * 职责：把「是否正在播放」暴露为响应式状态，供 App 里的 <TransitionVeil> 显隐；
 *      并提供两段回调——散场开始（切路由）与整段播完（收尾）。
 *
 * 为什么需要这个模块：转场层必须挂在路由之外（App 级别），
 * 否则从首页跳到地图页时组件随页面卸载，动画会被直接掐断。
 */
import { ref } from 'vue';

/** 转场层是否正在播放 */
export const veilPlaying = ref(false);

/** 本次播放的回调：背景开始散场时触发，用于完成路由切换 */
let revealCallback = null;

/**
 * 播放「云海启幕」转场。
 * @param {() => void} [onReveal] 散场开始时调用。此时转场层正用不透明背景盖住画面，
 *   完成路由切换后，散场淡出露出的就是目标页面，而不是旧页面。
 */
export function playVeil(onReveal) {
  revealCallback = typeof onReveal === 'function' ? onReveal : null;
  veilPlaying.value = true;
}

/** 由 TransitionVeil 在散场开始时调用（只触发一次） */
export function emitVeilReveal() {
  const callback = revealCallback;
  revealCallback = null;
  if (callback) callback();
}

/** 由 TransitionVeil 在整段播完后调用 */
export function finishVeil() {
  veilPlaying.value = false;
}

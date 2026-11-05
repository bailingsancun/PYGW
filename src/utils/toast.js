/**
 * 实现功能：全局轻提示（替代 uni.showToast）
 * 职责：极简响应式 toast 状态，任意模块可调用 showToast('文案')。
 */
import { reactive } from 'vue';

export const toastState = reactive({
  message: '',
  visible: false,
});

let timer = null;

export const showToast = (message, duration = 2000) => {
  if (!message) return;
  toastState.message = String(message);
  toastState.visible = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    toastState.visible = false;
    timer = null;
  }, duration);
};

/** 复制链接等场景用 */
export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(String(text));
    showToast('已复制');
    return true;
  } catch {
    showToast('复制失败，请手动复制');
    return false;
  }
};

/**
 * 实现功能：地区参数的持久化与规范化（Web 版）
 * 职责：把小程序 uni.setStorageSync/getStorageSync 换成 localStorage，行为保持一致：
 *       DEFAULT_REGION 保留 '陕西'（无行政后缀）——注意它匹配不到库里的 '陕西省'，
 *       容错由 shim 承担（HANDOFF §5.6 / §7-4），不要在这里改成 '陕西省'。
 * 注意：本文件只负责存储；页面跳转请在各组件内用 vue-router 完成，避免与 router 循环依赖。
 */

export const DEFAULT_REGION = '陕西';

const STORAGE_KEY = 'currentRegion';

/** 兼容 URL 编码、空参数与旧缓存 */
export function normalizeRegion(region) {
  if (!region) return '';
  try {
    return decodeURIComponent(region);
  } catch {
    return region;
  }
}

export function saveRegion(region) {
  const normalizedRegion = normalizeRegion(region);
  if (normalizedRegion) {
    try {
      window.localStorage.setItem(STORAGE_KEY, normalizedRegion);
    } catch {
      // 隐私模式下 localStorage 可能不可写，忽略即可
    }
  }
  return normalizedRegion || getCurrentRegion();
}

export function getCurrentRegion() {
  let stored = '';
  try {
    stored = window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    stored = '';
  }
  return normalizeRegion(stored) || DEFAULT_REGION;
}

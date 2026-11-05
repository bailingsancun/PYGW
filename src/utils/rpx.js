/**
 * 实现功能：rpx 数值工具
 * 职责：给模板里的 inline style（PostCSS 处理不到）提供 rpx 换算，
 *       与构建期的 `Nrpx → calc(N * var(--rpx))` 保持同一基准。
 * 用法：:style="{ height: rpx(220) }" → 'calc(220 * var(--rpx))'
 */
export const rpx = (value, unit = '') => `calc(${Number(value) || 0} * var(--rpx))${unit}`;

/** 给 background-image 用：返回 url(...) 或空串 */
export const bgUrl = (url = '') => (url ? `url("${String(url).replace(/"/g, '\\"')}")` : 'none');

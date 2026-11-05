/**
 * 实现功能：全局图片资源表（对应小程序 store/imageStore.js）
 * 职责：应用启动时拉一次 /assets/common，把 imageKey → URL 存入 globalImages；
 *       artAssets 的每个 getter 都先查这张表，查不到才回落到 art-v2 本地路径（HANDOFF §3.4）。
 * 接口/函数清单：
 *   - globalImages / imageStoreState：响应式状态
 *   - normalizeImageUrl(url)：相对路径补 BASE_URL（单源部署时原样返回）
 *   - getImageByKey(key, fallback)：查表 + 回落
 *   - initImageStore(force)：应用级初始化（8 个页面共同依赖，见 §7.2）
 */
import { reactive } from 'vue';
import request, { BASE_URL } from '@/api/index.js';

export const globalImages = reactive({});

export const imageStoreState = reactive({
  loading: false,
  loaded: false,
  error: null,
});

let pendingRequest = null;

export const normalizeImageUrl = (url = '') => {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }
  if (value.startsWith('/')) return `${BASE_URL}${value}`;
  return `${BASE_URL}/${value.replace(/^\/+/, '')}`;
};

const applyCommonAssets = (data) => {
  if (Array.isArray(data)) {
    data.forEach((item) => {
      if (!item?.imageKey) return;
      globalImages[item.imageKey] = normalizeImageUrl(item.fullUrl || item.relativePath);
    });
    return;
  }
  if (data && typeof data === 'object') {
    Object.keys(data).forEach((key) => {
      globalImages[key] = normalizeImageUrl(data[key]);
    });
  }
};

export const getImageByKey = (key, fallback = '') => normalizeImageUrl(globalImages[key] || fallback);

export const initImageStore = async (force = false) => {
  if (imageStoreState.loaded && !force) return globalImages;
  if (pendingRequest && !force) return pendingRequest;

  imageStoreState.loading = true;
  imageStoreState.error = null;

  pendingRequest = request({ url: '/assets/common' })
    .then((data) => {
      applyCommonAssets(data);
      imageStoreState.loaded = true;
      return globalImages;
    })
    .catch((err) => {
      imageStoreState.error = err;
      return globalImages;
    })
    .finally(() => {
      imageStoreState.loading = false;
      pendingRequest = null;
    });

  return pendingRequest;
};

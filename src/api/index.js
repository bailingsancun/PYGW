/**
 * 实现功能：浏览器端 API 适配器（替代小程序 utils/request.js）
 * 职责：照 HANDOFF §3.3 的语义用 fetch 重写，保持页面代码不用改：
 *       - base 只从 VITE_API_BASE_URL 读取，绝不给默认内网 IP（§2-6）
 *       - 拼 /api/v1 前缀
 *       - GET 把 data 编成 query string，跳过 undefined/null/''
 *       - 解析 {code,data,message}，code===0||200 取 data，否则 throw
 *       - 不发送 X-Api-Base-Url / X-Backend-Origin（§2-6 明确禁止）
 * 接口/函数清单：
 *   - API_BASE_URL / ASSET_BASE_URL / BASE_URL：单源部署时为 '/api/v1' 与 ''
 *   - request(input, data)：主函数，返回解析后的 data 或抛错
 *   - request.get/post/put/delete：便捷方法
 *   - unwrapResponse(payload)：envelope 解包（与源码逐字对齐）
 */

const API_PREFIX = '/api/v1';
const DEFAULT_TIMEOUT = 60000;

const trimTrailingSlash = (value = '') => String(value).replace(/\/+$/, '');
const isAbsoluteUrl = (value = '') => /^https?:\/\//i.test(String(value));
const isRelativeUrl = (value = '') => String(value).startsWith('/');

/** 归一化 base：'/api' → '/api/v1'，'https://x' → 'https://x/api/v1' */
const normalizeApiBaseUrl = (value = '') => {
  const raw = trimTrailingSlash(value || API_PREFIX);
  if (!raw) return API_PREFIX;
  if (isRelativeUrl(raw)) {
    if (raw.endsWith(API_PREFIX)) return raw;
    if (raw.endsWith('/api')) return `${raw}/v1`;
    return raw;
  }
  if (raw.endsWith(API_PREFIX)) return raw;
  if (raw.endsWith('/api')) return `${raw}/v1`;
  return `${raw}${API_PREFIX}`;
};

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL || API_PREFIX);
export const ASSET_BASE_URL = API_BASE_URL.replace(new RegExp(`${API_PREFIX}$`), '');
/** 单源部署（VITE_API_BASE_URL=/api/v1）时 BASE_URL === ''，图片走同源相对路径 */
export const BASE_URL = ASSET_BASE_URL;

const buildUrl = (url = '', data, method = 'GET') => {
  const value = String(url || '');
  const path = isAbsoluteUrl(value) ? value : `${API_BASE_URL}${value.startsWith('/') ? value : `/${value}`}`;

  if (method !== 'GET' || !data || typeof data !== 'object') return path;

  const target = new URL(path, window.location.origin);
  Object.entries(data).forEach(([key, item]) => {
    if (item !== undefined && item !== null && item !== '') {
      target.searchParams.set(key, item);
    }
  });

  return isRelativeUrl(path) ? `${target.pathname}${target.search}${target.hash}` : target.toString();
};

/** 与源码 unwrapResponse 完全一致的 envelope 语义 */
export const unwrapResponse = (payload) => {
  if (
    payload
    && typeof payload === 'object'
    && Object.prototype.hasOwnProperty.call(payload, 'code')
    && (
      Object.prototype.hasOwnProperty.call(payload, 'data')
      || Object.prototype.hasOwnProperty.call(payload, 'message')
      || Object.prototype.hasOwnProperty.call(payload, 'msg')
    )
  ) {
    if (payload.code === 0 || payload.code === 200) {
      return payload.data ?? payload;
    }
    const error = new Error(payload.message || payload.msg || '请求失败');
    error.data = payload;
    throw error;
  }
  return payload;
};

const request = async (input = {}, data, extraOptions = {}) => {
  const options = typeof input === 'string'
    ? { ...extraOptions, url: input, data, method: extraOptions.method || 'GET' }
    : { ...input, data: input.data ?? input.params ?? data, method: input.method || 'GET' };

  const method = String(options.method || 'GET').toUpperCase();
  const url = buildUrl(options.url, options.data, method);
  const controller = new AbortController();
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      // 只发最小必要头；不发送被禁的 X-Api-Base-Url / X-Backend-Origin
      headers: {
        Accept: 'application/json',
        ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || options.header || {}),
      },
      body: method === 'GET' ? undefined : JSON.stringify(options.data || {}),
      signal: options.signal || controller.signal,
    });

    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      error.data = await response.json().catch(() => null);
      throw error;
    }

    const payload = await response.json();
    return unwrapResponse(payload);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

request.get = (url, data, options = {}) => request(url, data, { ...options, method: 'GET' });
request.post = (url, data, options = {}) => request(url, data, { ...options, method: 'POST' });
request.put = (url, data, options = {}) => request(url, data, { ...options, method: 'PUT' });
request.delete = (url, data, options = {}) => request(url, data, { ...options, method: 'DELETE' });

export default request;

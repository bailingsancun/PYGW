/**
 * 实现功能：皮影装配 / 打斗过场 / 视觉校准的素材根路径
 * 职责：把 testdemo 里写死的相对路径（"characters/general/"、"../vendor/..."）
 *       统一改成「基于 Vite BASE_URL 的工程内路径」，静态资源全部落在 public/ 下：
 *         public/piying/characters/{general,warrior,自定义注册角色}
 *         public/piying/scenery/        砌末（城楼/山石/松/云/旗/流矢）
 *         public/piying/audio/          打斗 BGM
 *         public/cv/vendor/             MediaPipe tasks-vision wasm + 姿态模型
 *       BASE_URL 默认 '/'，构建到子路径部署时也无需改源码。
 * 接口/函数清单：
 *   - PIYING_BASE / CV_BASE：素材根（以 / 结尾）
 *   - piyingUrl(path) / cvUrl(path)：拼接绝对可请求 URL
 *   - BATTLE_BGM_URL / SCENERY_INDEX_URL / CHARACTERS_INDEX_URL
 *   - characterBaseUrl(name)：单个角色文件夹 URL
 */

// import.meta.env 只在 Vite 里有；加兜底后本文件也能被 Node 单测直接 import
const ENV = import.meta.env || {};
const BASE = ENV.BASE_URL || '/';

export const PIYING_BASE = `${BASE}piying/`;
export const CV_BASE = `${BASE}cv/`;

/** 拼接素材 URL；已带协议 / 以 / 开头 / data: 的原样返回（导入角色与 AI 生成部件都用得上） */
export const piyingUrl = (path = '') => {
  if (!path) return PIYING_BASE;
  if (/^(data:|blob:|https?:|\/\/)/i.test(path) || path.startsWith('/')) return path;
  return `${PIYING_BASE}${String(path).replace(/^\.?\//, '')}`;
};

export const cvUrl = (path = '') => {
  if (!path) return CV_BASE;
  if (/^(data:|blob:|https?:|\/\/)/i.test(path) || path.startsWith('/')) return path;
  return `${CV_BASE}${String(path).replace(/^\.?\//, '')}`;
};

export const CHARACTERS_INDEX_URL = piyingUrl('characters/index.json');
export const SCENERY_INDEX_URL = piyingUrl('scenery/index.json');
export const BATTLE_BGM_URL = piyingUrl('audio/battle-bgm.mp3');

/** 角色文件夹（manifest.json 的 baseUrl），name 允许带/不带尾部斜杠 */
export const characterBaseUrl = (name = '') =>
  piyingUrl(`characters/${String(name).replace(/^\/+|\/+$/g, '')}/`);

/** 主角默认形象：皮影将官（持剑），也是过场动画里的主角 */
export const DEFAULT_CHARACTER = 'general';
/** 主角固定武器：将官的宝剑（切换形象后仍沿用这把剑） */
export const HERO_WEAPON_NODE = 'sword';

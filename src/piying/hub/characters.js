/**
 * 实现功能：皮影角色库（内置角色 + 本地导入 + AI 生成）
 * 职责：统一管理「身入影幕」里可用的皮影形象：
 *   - 内置角色从 public/piying/characters/index.json 读注册表，再按需加载 manifest；
 *   - 本地导入 / AI 生成的角色注册在内存里（图片是 objectURL 或 dataURL，不落盘、不跨会话）；
 *   - 提供「把主角的剑装到任何形象手上」的工具：切换形象后武器固定为主角的宝剑。
 * 说明：不写 localStorage。自定义角色的图片是浏览器内存 URL，会话结束即失效，
 *       持久化只会留下打不开的 manifest，反而更差。
 */
import { CHARACTERS_INDEX_URL, characterBaseUrl, piyingUrl, HERO_WEAPON_NODE } from '../paths.js';

const WEAPON_PART_KEYS = ['sword', 'guandao', 'blade', 'weapon', 'saber', 'dao', 'gun'];

const isWeaponPart = (part) => {
  const key = String(part || '').toLowerCase();
  return WEAPON_PART_KEYS.some((name) => key === name || key.includes(name));
};

export class CharacterLibrary {
  constructor() {
    this.registry = [];
    this.cache = new Map();
    this.custom = new Map();
    this.heroWeapon = null;
  }

  /** 读内置注册表（失败时回落为空表，不阻塞页面） */
  async loadRegistry() {
    if (this.registry.length) return this.registry;
    try {
      const response = await fetch(CHARACTERS_INDEX_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      this.registry = (data.characters || []).map((item) => ({
        id: item.name,
        title: item.title || item.name,
        path: item.path || `${item.name}/`,
        kind: 'builtin',
      }));
    } catch (error) {
      console.warn('[piying] 角色注册表读取失败', error);
      this.registry = [];
    }
    return this.registry;
  }

  /** 列表：内置 + 自定义 */
  list() {
    return [...this.registry, ...this.custom.values()].map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      notes: item.notes || '',
    }));
  }

  has(id) {
    return this.cache.has(id) || this.custom.has(id) || this.registry.some((item) => item.id === id);
  }

  /** 加载角色（含 manifest 与素材解析器） */
  async get(id) {
    if (!id) return null;
    if (this.custom.has(id)) return this.custom.get(id);
    if (this.cache.has(id)) return this.cache.get(id);
    const entry = this.registry.find((item) => item.id === id) || { id, path: `${id}/`, title: id, kind: 'builtin' };
    const baseUrl = characterBaseUrl(entry.path.replace(/\/$/, ''));
    const response = await fetch(`${baseUrl}manifest.json`);
    if (!response.ok) throw new Error(`角色 ${id} 的 manifest 读取失败（HTTP ${response.status}）`);
    const manifest = await response.json();
    const record = {
      id,
      title: manifest.title || entry.title || id,
      kind: 'builtin',
      manifest,
      baseUrl,
      resolveSrc: undefined, // 交给 rig-engine 用 baseUrl 解析
    };
    this.cache.set(id, record);
    return record;
  }

  /** 注册自定义角色（本地导入 / AI 生成） */
  register(record) {
    if (!record?.id || !record?.manifest) throw new Error('角色数据不完整');
    const entry = { kind: 'local', ...record };
    this.custom.set(entry.id, entry);
    return entry;
  }

  /** 读取主角的宝剑部件（用于把武器固定到其它形象上） */
  async loadHeroWeapon() {
    if (this.heroWeapon) return this.heroWeapon;
    const general = await this.get('general');
    const part = general?.manifest?.parts?.sword;
    if (!part) throw new Error('主角形象里找不到宝剑部件');
    this.heroWeapon = {
      src: `${general.baseUrl}${part.src}`,
      size: [...part.size],
    };
    return this.heroWeapon;
  }
}

/** 角色 id 规范化：只留字母数字、中文、下划线、连字符 */
export const normalizeCharacterId = (value) => {
  const text = String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '');
  return text.slice(0, 40);
};

/**
 * 把主角的宝剑装到目标形象上（武器固定，不随形象变化）。
 * 做法：删掉目标形象自带的武器节点，再在它的手节点上挂一个「主角宝剑」节点；
 *       attach 按手部件尺寸等比缩放，保证剑柄仍落在手心。
 * @param {object} manifest 目标形象 manifest（会被原地修改并返回）
 * @param {{src:string,size:number[]}} weapon 主角宝剑部件
 */
export function applyHeroWeapon(manifest, weapon) {
  if (!manifest?.nodes?.length || !weapon) return manifest;
  const nodes = manifest.nodes;

  // 1) 摘掉原有武器节点
  const weaponNodeIds = new Set(
    nodes.filter((node) => isWeaponPart(node.part) || isWeaponPart(node.id)).map((node) => node.id),
  );
  manifest.nodes = nodes.filter((node) => !weaponNodeIds.has(node.id));
  // 被删节点若还有子节点，把子节点挂回被删节点的父（避免断链）
  const validIds = new Set(manifest.nodes.map((node) => node.id));
  manifest.nodes.forEach((node) => {
    if (node.parent !== null && !validIds.has(node.parent)) {
      const fallback = manifest.nodes.find((item) => item.parent === null);
      node.parent = fallback ? fallback.id : null;
    }
  });
  for (const [key, part] of Object.entries(manifest.parts || {})) {
    if (isWeaponPart(key)) delete manifest.parts[key];
  }

  // 2) 找宿主手节点（优先近侧手）
  const hands = manifest.nodes.filter((node) => String(node.part || '').toLowerCase().includes('hand'));
  const host =
    hands.find((node) => /near|N$/.test(String(node.id))) ||
    hands.find((node) => /far|F$/.test(String(node.id))) ||
    hands[0] ||
    manifest.nodes.find((node) => String(node.part || '').toLowerCase().includes('torso')) ||
    manifest.nodes.find((node) => node.parent === null);

  // 3) 挂上主角宝剑
  manifest.parts = manifest.parts || {};
  manifest.parts.sword = { src: weapon.src, size: [...weapon.size] };
  const handPart = host ? manifest.parts[host.part] : null;
  const handSize = handPart?.size || [42, 79];
  // 主角原图纸：hand 42×79，剑的 pivot[49,60] / attach[21,45] / tip[49,540]
  const attach = [Math.round(handSize[0] * (21 / 42)), Math.round(handSize[1] * (45 / 79))];
  const maxZ = Math.max(0, ...manifest.nodes.map((node) => Number(node.z) || 0));

  // 让剑在「持剑拄地」时朝正下方：抵消父链的累计角度。
  // 不同形象的站立姿态不一样（将官手臂前垂约 54°，武净持刀约 90°），
  // 固定 -54° 会让武净的剑斜着翘起来。
  const nodeById = new Map(manifest.nodes.map((node) => [node.id, node]));
  let chain = 0;
  let parentId = host ? host.id : null;
  const walked = new Set();
  while (parentId && !walked.has(parentId)) {
    walked.add(parentId);
    const parentNode = nodeById.get(parentId);
    if (!parentNode) break;
    chain += Number(parentNode.angle) || 0;
    parentId = parentNode.parent;
  }

  manifest.nodes.push({
    id: HERO_WEAPON_NODE,
    part: 'sword',
    parent: host ? host.id : null,
    pivot: [49, 60],
    attach,
    tip: [49, 540],
    z: maxZ + 1,
    angle: Math.round(-chain),
  });

  // 4) 让宝剑在所有 pose 里都跟着手（不被 rest 回退成别的角度）
  if (manifest.poses) {
    for (const pose of Object.values(manifest.poses)) {
      if (pose && pose.angles) delete pose.angles[HERO_WEAPON_NODE];
    }
  }
  return manifest;
}

/** 深拷贝 manifest（自定义角色要改武器节点，不能污染缓存） */
export const cloneManifest = (manifest) => JSON.parse(JSON.stringify(manifest));

/**
 * 取某个角色某个部件的可请求 URL（做角色选择窗口的缩略图用）。
 * 内置角色拼 baseUrl，本地导入 / AI 生成的走各自的 resolveSrc。
 */
export function partSrc(record, key = 'head') {
  const part = record?.manifest?.parts?.[key];
  if (!part) return '';
  if (typeof record.resolveSrc === 'function') {
    const url = record.resolveSrc(key, part);
    if (url) return url;
  }
  const src = String(part.src || '');
  if (!src) return '';
  if (/^(data:|blob:|https?:|\/\/)/i.test(src) || src.startsWith('/')) return src;
  return `${record.baseUrl || ''}${src}`;
}

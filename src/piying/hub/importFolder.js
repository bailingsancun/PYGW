/**
 * 实现功能：「切换本地皮影」——从用户电脑导入一个皮影人物文件夹
 * 职责：复用 testdemo 皮影调试页的文件夹导入能力（manifest.json + assets/*.png），
 *       并在导入前做严格格式校验：零件图缺失、节点断链、根节点不唯一、尺寸非法……
 *       一律拒绝导入并给出具体原因（页面会弹提示），不把半成品塞进舞台。
 * 两种来源：
 *   1) File System Access API（Chrome / Edge 的 window.showDirectoryPicker）
 *   2) 传统 <input type="file" webkitdirectory>（其它浏览器的兜底）
 */
import { normalizeCharacterId } from './characters.js';

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;

const normalizeRelPath = (value) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/\/{2,}/g, '/')
    .trim();

/** 文件夹句柄 → Map<相对路径, File>（只取 manifest 里需要的部件图） */
async function readFilesFromHandle(handle, requiredPaths) {
  const files = new Map();
  for (const relPath of requiredPaths) {
    const segments = normalizeRelPath(relPath).split('/').filter(Boolean);
    let dir = handle;
    try {
      for (let index = 0; index < segments.length - 1; index += 1) {
        dir = await dir.getDirectoryHandle(segments[index]);
      }
      const fileHandle = await dir.getFileHandle(segments[segments.length - 1]);
      files.set(normalizeRelPath(relPath), await fileHandle.getFile());
    } catch (error) {
      throw new Error(`缺少零件图 ${relPath}（${error?.message || error}）`);
    }
  }
  return files;
}

/** webkitdirectory 的 FileList → Map<相对路径, File>（去掉用户选中的根目录名） */
function readFilesFromInput(fileList) {
  const files = new Map();
  let root = '';
  for (const file of fileList) {
    const relative = normalizeRelPath(file.webkitRelativePath || file.name);
    if (!root && relative.includes('/')) root = relative.split('/')[0];
    files.set(relative, file);
  }
  return { files, root };
}

const stripRoot = (path, root) => {
  if (!root) return path;
  const prefix = `${root}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
};

/**
 * 校验 manifest 结构。返回 { ok, errors }，errors 是给用户看的中文原因。
 */
export function validateManifest(manifest, files = new Map()) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors: ['manifest.json 不是合法的 JSON 对象'] };
  }

  const parts = manifest.parts;
  if (!parts || typeof parts !== 'object' || !Object.keys(parts).length) {
    errors.push('缺少 parts（零件图定义）');
  } else {
    for (const [key, part] of Object.entries(parts)) {
      if (!part || typeof part !== 'object') {
        errors.push(`零件 ${key} 的定义不是对象`);
        continue;
      }
      const src = normalizeRelPath(part.src);
      if (!src || !IMAGE_EXT.test(src)) errors.push(`零件 ${key} 缺少合法的图片路径（src）`);
      const size = part.size;
      const validSize =
        Array.isArray(size) &&
        size.length === 2 &&
        Number(size[0]) > 1 &&
        Number(size[1]) > 1;
      if (!validSize) errors.push(`零件 ${key} 的 size 必须是 [宽, 高] 两个正数`);
      // 只在真的读取过文件时校验缺图（传 null 表示仅做结构校验）
      if (files instanceof Map && src && !files.has(src)) errors.push(`缺少零件图文件 ${part.src}`);
    }
  }

  const nodes = manifest.nodes;
  if (!Array.isArray(nodes) || !nodes.length) {
    errors.push('缺少 nodes（关节树）');
  } else {
    const ids = new Set();
    for (const node of nodes) {
      if (!node || typeof node !== 'object') {
        errors.push('nodes 里存在非法条目');
        continue;
      }
      const id = String(node.id || '');
      if (!id) errors.push('存在没有 id 的关节');
      if (ids.has(id)) errors.push(`关节 id 重复：${id}`);
      ids.add(id);
      if (!parts || !parts[node.part]) errors.push(`关节 ${id || '?'} 引用了不存在的零件 ${node.part}`);
      const okPoint = (value) => Array.isArray(value) && value.length === 2 && value.every((n) => Number.isFinite(Number(n)));
      if (!okPoint(node.pivot)) errors.push(`关节 ${id || '?'} 的 pivot 必须是 [x, y]`);
      if (!okPoint(node.attach)) errors.push(`关节 ${id || '?'} 的 attach 必须是 [x, y]`);
    }
    const roots = nodes.filter((node) => node && node.parent === null);
    if (roots.length !== 1) errors.push(`必须有且只有一个根关节（parent: null），当前 ${roots.length} 个`);
    for (const node of nodes) {
      if (!node || node.parent === null || node.parent === undefined) continue;
      if (!ids.has(node.parent)) errors.push(`关节 ${node.id} 的父关节 ${node.parent} 不存在`);
    }
    if (manifest.poses && typeof manifest.poses === 'object') {
      for (const [key, pose] of Object.entries(manifest.poses)) {
        if (!pose || typeof pose !== 'object') {
          errors.push(`姿势 ${key} 的定义不是对象`);
          continue;
        }
        const angles = pose.angles;
        if (angles && typeof angles === 'object') {
          for (const id of Object.keys(angles)) {
            if (!ids.has(id)) errors.push(`姿势 ${key} 引用了不存在的关节 ${id}`);
          }
        }
      }
    }
  }

  const stage = manifest.stage;
  if (stage && (Number(stage.width) <= 0 || Number(stage.height) <= 0)) {
    errors.push('stage.width / stage.height 必须是正数');
  }

  return { ok: errors.length === 0, errors };
}

/** 给浏览器用的 URL 映射：同源内置图 + 用户导入的 objectURL */
const buildResolveSrc = (manifest, files, objectUrls) => (key, def) => {
  const src = normalizeRelPath(def?.src);
  if (objectUrls.has(src)) return objectUrls.get(src);
  const file = files.get(src);
  if (!file) return '';
  const url = URL.createObjectURL(file);
  objectUrls.set(src, url);
  return url;
};

/**
 * 从文件夹句柄导入。
 * @returns {Promise<{id:string,title:string,manifest:object,resolveSrc:Function,release:Function}>}
 */
export async function importFromDirectoryPicker() {
  if (!window.showDirectoryPicker) {
    throw new Error('当前浏览器不支持文件夹选择，请改用 Chrome / Edge，或使用下方的「选择文件夹」按钮。');
  }
  let handle;
  try {
    handle = await window.showDirectoryPicker({ id: 'piying-character', mode: 'read' });
  } catch (error) {
    if (error?.name === 'AbortError') return null;
    throw new Error(`无法打开文件夹：${error?.message || error}`);
  }

  let manifest;
  try {
    const fileHandle = await handle.getFileHandle('manifest.json');
    const file = await fileHandle.getFile();
    manifest = JSON.parse(await file.text());
  } catch (error) {
    throw new Error(`所选文件夹根目录缺少可读的 manifest.json（${error?.message || error}）`);
  }

  const required = Object.values(manifest?.parts || {})
    .map((part) => normalizeRelPath(part?.src))
    .filter(Boolean);
  let files = new Map();
  try {
    files = await readFilesFromHandle(handle, required);
  } catch (error) {
    // 先把缺文件的原因报出来（校验函数还要用 files 判断其它项）
    throw new Error(error.message);
  }

  return buildCharacter({ folderName: handle.name, manifest, files });
}

/**
 * 从 <input webkitdirectory> 的 FileList 导入（其它浏览器的兜底路径）。
 * @returns {Promise<{id,title,manifest,resolveSrc,release}|null>}
 */
export async function importFromFileList(fileList) {
  if (!fileList || !fileList.length) return null;
  const { files: raw, root } = readFilesFromInput(fileList);
  const files = new Map();
  for (const [path, file] of raw) files.set(stripRoot(path, root), file);

  const manifestFile = files.get('manifest.json');
  if (!manifestFile) {
    throw new Error('所选文件夹的数据不完整：根目录缺少 manifest.json（请选中人物文件夹本身）');
  }
  let manifest;
  try {
    manifest = JSON.parse(await manifestFile.text());
  } catch (error) {
    throw new Error(`manifest.json 不是合法 JSON：${error?.message || error}`);
  }
  return buildCharacter({ folderName: root || '导入人物', manifest, files });
}

/** 由 manifest + 文件表构建可注册角色；校验不通过直接抛错（带全部原因） */
export function buildCharacter({ folderName, manifest, files }) {
  const { ok, errors } = validateManifest(manifest, files);
  if (!ok) {
    const error = new Error(errors.slice(0, 4).join('；') + (errors.length > 4 ? ` 等 ${errors.length} 项问题` : ''));
    error.details = errors;
    error.code = 'INVALID_SAVE_MANIFEST';
    throw error;
  }

  const objectUrls = new Map();
  const title = String(manifest.title || manifest.name || folderName || '导入人物').slice(0, 24);
  const id = `local_${normalizeCharacterId(manifest.name || folderName || 'puppet')}_${Date.now().toString(36)}`;
  const resolveSrc = buildResolveSrc(manifest, files, objectUrls);
  return {
    id,
    title: `${title}（本地）`,
    kind: 'local',
    manifest: JSON.parse(JSON.stringify(manifest)),
    resolveSrc,
    notes: `本地导入 · ${Object.keys(manifest.parts).length} 部件 / ${manifest.nodes.length} 关节`,
    /** 释放 objectURL，切换走之后调用 */
    release: () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    },
  };
}

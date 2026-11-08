/**
 * 实现功能：素材文件解析（只读兼容层）
 * 职责：把数据库里的图片相对路径解析成磁盘真实文件，且**不修改源工程、不修改数据库**。
 *       需要容错的两类历史差异：
 *         1) 空格差异：DB 写 `map/hnpy(1).png`，磁盘是 `map/hnpy (1).png`（河南省 6 张图）；
 *         2) 大小写差异：同组素材 `.PNG` 与 `.png` 混用（HANDOFF §5.0，Linux 部署必踩）。
 *       做法：精确路径不存在时，在父目录里按「去空白 + 忽略大小写」找同名文件，
 *       用磁盘上的真实文件名打开 —— 因此不仅 Windows 可用，在大小写敏感的 Linux 上同样可用。
 * 接口/函数清单：
 *   - resolveAssetFile(assetRoot, relativePath)：返回真实绝对路径或 null
 *   - isInsideRoot(assetRoot, absPath)：目录穿越判定
 */
import fs from 'node:fs';
import path from 'node:path';

const squash = (name = '') => String(name).replace(/\s+/g, '').toLowerCase();

export const isInsideRoot = (assetRoot, absPath) => {
  const root = path.resolve(assetRoot);
  const target = path.resolve(absPath);
  return target === root || target.startsWith(root + path.sep);
};

/**
 * 解析素材根目录 —— 全工程唯一口径，vite / static-server / check-assets 都必须用它，
 * 避免各处各写一套硬编码路径（曾经就是因此漏掉一处、指向了已删除的旧目录）。
 *
 * 优先级：
 *   1) 工程内 assets/images 存在 → 直接用它（自包含，忽略 ASSET_ROOT）
 *   2) 显式配置的 ASSET_ROOT（素材放在工程外时）
 *   3) 回落工程内路径（调用方负责告警）
 *
 * @param {string} projectRoot 工程根目录
 * @param {string} envRoot     .env 里的 ASSET_ROOT
 * @returns {string} 解析后的素材根绝对路径
 */
export const resolveAssetRoot = (projectRoot, envRoot = '') => {
  const inProject = path.resolve(projectRoot, 'assets', 'images');
  try {
    if (fs.existsSync(inProject)) return inProject;
  } catch {
    // 权限等问题时继续走配置分支
  }
  const configured = String(envRoot || '').trim();
  if (configured) return path.resolve(configured);
  return inProject;
};

export const resolveAssetFile = (assetRoot, relativePath = '') => {
  if (!assetRoot || !relativePath) return null;
  const root = path.resolve(assetRoot);
  const direct = path.resolve(path.join(root, relativePath));
  if (!isInsideRoot(root, direct)) return null;

  try {
    const stat = fs.statSync(direct);
    if (stat.isFile()) return direct;
  } catch {
    // 继续走容错分支
  }

  const dir = path.dirname(direct);
  const base = path.basename(direct);
  if (!isInsideRoot(root, dir)) return null;

  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }

  const wanted = squash(base);
  const hit = entries.find((name) => squash(name) === wanted);
  if (!hit) return null;

  const resolved = path.join(dir, hit);
  try {
    const stat = fs.statSync(resolved);
    return stat.isFile() ? resolved : null;
  } catch {
    return null;
  }
};

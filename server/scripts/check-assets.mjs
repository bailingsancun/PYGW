/**
 * 实现功能：素材引用完整性检查
 * 职责：把数据库里所有被引用的图片路径，逐个用运行时同一套解析器（resolveAssetFile）核对，
 *       分成三类报告：
 *         - 严格存在：磁盘文件名与 DB 完全一致
 *         - 容错命中：靠「去空白 + 忽略大小写」才找到（如 DB `hnpy(1).png` vs 磁盘 `hnpy (1).png`）
 *         - 真实缺失：运行时一定 404
 *       另外列出「约定不挂载」的 data/ 与 videos/ 引用（8 个页面不使用）。
 * 用法：node server/scripts/check-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { loadEnv, PROJECT_ROOT } from '../src/env.js';
import { resolveAssetFile } from '../src/assets.js';

const DEFAULT_ASSET_ROOT = 'D:\\聚萤分享\\Cloud-Shadow-组员演示开发包-2026-08-03\\storage\\assets\\legacy-import\\images';

/** 去掉前导斜杠与 /images 前缀，得到素材根下的相对路径 */
const toRelative = (raw = '') => {
  let value = String(raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return '';
  value = value.replace(/^\/+/, '');
  value = value.replace(/^images\//i, '');
  return value;
};

/** 约定不挂载的目录：只剩 data/ 与 videos/，8 个页面均不引用（HANDOFF §2-2） */
const OUT_OF_SCOPE = /^(data|videos)\//i;

const run = async () => {
  const config = loadEnv();
  const ASSET_ROOT = process.env.ASSET_ROOT || DEFAULT_ASSET_ROOT;

  if (!fs.existsSync(ASSET_ROOT)) {
    console.error(`素材根目录不存在：${ASSET_ROOT}`);
    process.exitCode = 1;
    return;
  }

  const pool = await mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    charset: 'utf8mb4_unicode_ci',
  });

  const sources = [
    { name: 'media_assets.url', sql: 'SELECT url AS value FROM media_assets' },
    { name: 'app_common_image.relative_path', sql: 'SELECT relative_path AS value FROM app_common_image' },
    { name: 'shadow_craft_process.image_url', sql: 'SELECT image_url AS value FROM shadow_craft_process WHERE is_active = 1' },
    { name: 'daily_appreciation.image_url', sql: 'SELECT image_url AS value FROM daily_appreciation WHERE is_active = 1' },
    { name: 'interactive_characters.image_url', sql: 'SELECT image_url AS value FROM interactive_characters WHERE is_active = 1' },
    { name: 'shadow_region_info.image_url', sql: 'SELECT image_url AS value FROM shadow_region_info' },
  ];

  const seen = new Map();
  for (const source of sources) {
    const [rows] = await pool.query(source.sql);
    for (const row of rows) {
      const relative = toRelative(row.value);
      if (!relative) continue;
      if (!seen.has(relative)) seen.set(relative, new Set());
      seen.get(relative).add(source.name);
    }
  }
  await pool.end();

  const exact = [];
  const tolerant = [];
  const missing = [];
  const outOfScope = [];

  for (const [relative, owners] of seen) {
    const ownerList = [...owners];
    if (OUT_OF_SCOPE.test(relative)) {
      outOfScope.push({ relative, owners: ownerList });
      continue;
    }
    const resolved = resolveAssetFile(ASSET_ROOT, relative);
    if (!resolved) {
      missing.push({ relative, owners: ownerList });
      continue;
    }
    const onDisk = path.basename(resolved);
    const expected = path.basename(relative);
    if (onDisk === expected) exact.push(relative);
    else tolerant.push({ relative, onDisk, owners: ownerList });
  }

  console.log(`素材根目录：${ASSET_ROOT}`);
  console.log(`引用去重后共 ${seen.size} 条路径`);
  console.log(`  严格存在（文件名一致）：${exact.length}`);
  console.log(`  容错命中（空白/大小写差异，运行时可正常返回）：${tolerant.length}`);
  console.log(`  真实缺失（会 404）：${missing.length}`);
  console.log(`  不挂载（data/ 与 videos/，页面不引用）：${outOfScope.length}`);
  console.log('');

  if (tolerant.length) {
    console.log('=== 容错命中明细（DB 与磁盘文件名不一致，已在解析层兼容）===');
    for (const item of tolerant) {
      console.log(`  DB: ${item.relative}`);
      console.log(`  磁盘: ${item.onDisk}    ← ${item.owners.join(', ')}`);
    }
    console.log('');
  }

  if (missing.length) {
    console.log('=== 真实缺失（需要处理）===');
    for (const item of missing) console.log(`  ${item.relative}    ← ${item.owners.join(', ')}`);
    console.log('');
  }

  if (outOfScope.length) {
    console.log('=== 不挂载的引用（预期行为）===');
    for (const item of outOfScope) console.log(`  ${item.relative}    ← ${item.owners.join(', ')}`);
    console.log('');
  }

  if (missing.length) process.exitCode = 1;

  fs.mkdirSync(path.join(PROJECT_ROOT, '.artifacts'), { recursive: true });
  fs.writeFileSync(
    path.join(PROJECT_ROOT, '.artifacts', 'check-assets.json'),
    JSON.stringify(
      { assetRoot: ASSET_ROOT, total: seen.size, exact: exact.length, tolerant, missing, outOfScope },
      null,
      2,
    ),
    'utf8',
  );
};

run().catch((error) => {
  console.error(`检查失败：${error.message}`);
  process.exitCode = 1;
});

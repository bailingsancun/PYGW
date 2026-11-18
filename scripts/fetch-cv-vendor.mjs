/**
 * 实现功能：从官方 CDN 恢复 public/cv/vendor（MediaPipe 运行时 + 姿态模型，约 44MB）
 * 用法：node scripts/fetch-cv-vendor.mjs
 * 说明：该目录刻意不进 git（体积大）。克隆仓库后跑一次本脚本即可补齐，
 *       /curtain 的摄像头玩法随之可用。每个文件钉住版本并做 sha256 校验，
 *       与工程验收过的本地副本逐字节一致；已存在且校验通过的文件自动跳过。
 *       需要 Node ≥ 18（原生 fetch），无第三方依赖，跨平台。
 *       有 testdemo/ 源目录的机器也可以改用 scripts/copy-piying-assets.ps1。
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3';
const MODELS = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker';

const FILES = [
  {
    to: 'tasks-vision/vision_bundle.mjs',
    url: `${VISION}/vision_bundle.mjs`,
    sha256: 'fb0c02c296f44ce0cc324ba16bd646d8773eb4a7847db4019cc4d0430db7a9b5',
  },
  {
    to: 'tasks-vision/wasm/vision_wasm_internal.js',
    url: `${VISION}/wasm/vision_wasm_internal.js`,
    sha256: '2aa5fd3fdd3d8208cd7587df0bb19fb6925c4ea16a76dd025aedc1f64d6a6309',
  },
  {
    to: 'tasks-vision/wasm/vision_wasm_internal.wasm',
    url: `${VISION}/wasm/vision_wasm_internal.wasm`,
    sha256: '225bc06c0f51a9cf31fea0e9e0b0243e9e01fb5ef332cc1a7fa6656dbdfdaabf',
  },
  {
    to: 'tasks-vision/wasm/vision_wasm_module_internal.js',
    url: `${VISION}/wasm/vision_wasm_module_internal.js`,
    sha256: 'd29996249490361715c769c6a49b43ad47e6ac9a28a8e8bce8d02b238e897851',
  },
  {
    to: 'tasks-vision/wasm/vision_wasm_module_internal.wasm',
    url: `${VISION}/wasm/vision_wasm_module_internal.wasm`,
    sha256: 'a269e84b12aefc93c9d6a4d62b01f41e5434a9fa941533bb8e75b1e3d1669e46',
  },
  {
    to: 'models/pose_landmarker_full.task',
    url: `${MODELS}/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
    sha256: '5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1',
  },
  {
    to: 'models/pose_landmarker_lite.task',
    url: `${MODELS}/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
    sha256: '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a',
  },
];

const digest = (buf) => createHash('sha256').update(buf).digest('hex');

const fetchFile = async ({ to, url, sha256: expected }) => {
  const target = path.join(root, 'public', 'cv', 'vendor', to);
  if (fs.existsSync(target) && digest(fs.readFileSync(target)) === expected) {
    console.log(`SKIP ${to}（已存在且校验一致）`);
    return;
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ← ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const actual = digest(buf);
  if (actual !== expected) throw new Error(`sha256 不一致：期望 ${expected}，实际 ${actual}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.download`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, target);
  console.log(`OK   ${to}（${(buf.length / 1048576).toFixed(1)} MB）`);
};

let failed = 0;
for (const file of FILES) {
  try {
    await fetchFile(file);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${file.to}：${error.message}`);
  }
}
if (failed > 0) {
  console.error(`\n${failed} 个文件恢复失败，请检查网络后重试（脚本可重复运行，成功的不会重下）。`);
  process.exit(1);
}
console.log('\npublic/cv/vendor 已就绪，/curtain 摄像头玩法可用。');
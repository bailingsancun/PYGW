/**
 * 「切换本地皮影」的格式校验单测（纯 Node 运行，不需要浏览器）：
 * 覆盖合法 manifest 与 6 类常见错误，确认导入会被拒绝并给出具体原因。
 * 用法：node scripts/verify-piying-import.mjs
 */
import { validateManifest } from '../src/piying/hub/importFolder.js';

const files = new Map([
  ['assets/head.png', { name: 'head.png' }],
  ['assets/torso.png', { name: 'torso.png' }],
]);

const makeManifest = (overrides = {}) => ({
  schema: 'piying-rig/1',
  name: 'demo',
  title: '演示人物',
  stage: { width: 900, height: 860 },
  parts: {
    head: { src: 'assets/head.png', size: [136, 187] },
    torso: { src: 'assets/torso.png', size: [138, 204] },
  },
  nodes: [
    { id: 'torso', part: 'torso', parent: null, pivot: [69, 201], attach: [450, 560], tip: [78, 8], z: 1, angle: 0 },
    { id: 'head', part: 'head', parent: 'torso', pivot: [93, 182], attach: [78, 20], tip: [66, 6], z: 2, angle: 0 },
  ],
  poses: { rest: { label: '默认', angles: {} } },
  ...overrides,
});

const cases = [];
const push = (name, manifest, expectOk, options = {}) => {
  const result = validateManifest(manifest, options.files ?? files);
  cases.push({ name, expectOk, ok: result.ok, errors: result.errors });
};

push('合法 manifest', makeManifest(), true);
push('没有 parts', makeManifest({ parts: {} }), false);
push('两个根关节', makeManifest({
  nodes: [
    { id: 'a', part: 'torso', parent: null, pivot: [1, 1], attach: [2, 2] },
    { id: 'b', part: 'head', parent: null, pivot: [1, 1], attach: [2, 2] },
  ],
}), false);
push('父关节不存在', makeManifest({
  nodes: [
    { id: 'a', part: 'torso', parent: null, pivot: [1, 1], attach: [2, 2] },
    { id: 'b', part: 'head', parent: 'ghost', pivot: [1, 1], attach: [2, 2] },
  ],
}), false);
push('零件尺寸非法', makeManifest({
  parts: {
    head: { src: 'assets/head.png', size: [0, -3] },
    torso: { src: 'assets/torso.png', size: [138, 204] },
  },
}), false);
push('缺少零件图文件', makeManifest(), false, { files: new Map() });
push('姿势引用不存在的关节', makeManifest({
  poses: { rest: { angles: { ghost: 12 } } },
}), false);
push('零件路径不是图片', makeManifest({
  parts: {
    head: { src: 'assets/head.txt', size: [10, 10] },
    torso: { src: 'assets/torso.png', size: [138, 204] },
  },
}), false);
push('关节树环路（a→b→a）', makeManifest({
  nodes: [
    { id: 'torso', part: 'torso', parent: null, pivot: [1, 1], attach: [2, 2] },
    { id: 'a', part: 'head', parent: 'b', pivot: [1, 1], attach: [2, 2] },
    { id: 'b', part: 'head', parent: 'a', pivot: [1, 1], attach: [2, 2] },
  ],
}), false);
push('自环关节（parent 指向自己）', makeManifest({
  nodes: [
    { id: 'torso', part: 'torso', parent: null, pivot: [1, 1], attach: [2, 2] },
    { id: 'head', part: 'head', parent: 'head', pivot: [1, 1], attach: [2, 2] },
  ],
}), false);
push('乱序但合法（子关节写在父前面）', makeManifest({
  nodes: [
    { id: 'head', part: 'head', parent: 'torso', pivot: [93, 182], attach: [78, 20], tip: [66, 6], z: 2, angle: 0 },
    { id: 'torso', part: 'torso', parent: null, pivot: [69, 201], attach: [450, 560], tip: [78, 8], z: 1, angle: 0 },
  ],
}), true);

const manyParts = {
  head: { src: 'assets/head.png', size: [136, 187] },
  torso: { src: 'assets/torso.png', size: [138, 204] },
};
const manyFiles = new Map(files);
for (let i = 0; i < 65; i += 1) {
  manyParts[`p${i}`] = { src: `assets/p${i}.png`, size: [10, 10] };
  manyFiles.set(`assets/p${i}.png`, { name: `p${i}.png`, size: 1024 });
}
push('零件数量超上限（67 > 64）', makeManifest({ parts: manyParts }), false, { files: manyFiles });

let failed = 0;
for (const item of cases) {
  const pass = item.ok === item.expectOk;
  if (!pass) failed += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${item.name}  → ok=${item.ok}（期望 ${item.expectOk}）`);
  if (item.errors.length) console.log(`      ${item.errors.slice(0, 3).join('；')}`);
}
console.log(failed ? `\n${failed} 个用例未通过` : `\n全部 ${cases.length} 个用例通过`);
process.exit(failed ? 1 : 0);

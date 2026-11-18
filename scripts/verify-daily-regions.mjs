import assert from 'node:assert/strict';
import { dailyRandom } from '../server/src/endpoints.js';
const existing = { id: 49, title: '陕西皮影选粹', description: '赏析', image_url: '/images/interactive/sxpy (1).png', region: '陕西' };
const gallery = {
  profile_media_id: 85, profile_id: 14, media_id: 485,
  caption: '浙江省皮影图1', media_title: '浙江皮影', media_description: null,
  image_url: 'images/map/zjpy (1).png', summary: null, feature_styling: '羊皮彩绘，造型似窗花剪纸',
  feature_coloring: '色彩鲜明', region_name: '浙江省', region_short_name: '浙江',
};
const poolWith = (...responses) => {
  const calls = [];
  return { calls, execute: async (sql, params) => {
    calls.push({ sql, params }); assert(responses.length, 'Unexpected database request');
    return [responses.shift()];
  } };
};
let count = 0;
const check = async (name, fn) => { await fn(); count += 1; console.log('PASS ' + name); };
await check('保留每日一赏优先级', async () => {
  const pool = poolWith([existing]); const item = await dailyRandom(pool, '陕西');
  assert.equal(item.id, 49); assert.equal(item.regionMatched, true); assert.equal(pool.calls.length, 1);
});
await check('行政区后缀与历史地名别名', async () => {
  for (const [name, expected] of [['陕西省', ['陕西省', '陕西']], ['辽宁省', ['辽宁省', '辽宁', '辽东']], ['河北省', ['河北省', '河北', '唐山']], ['广西壮族自治区', ['广西壮族自治区', '广西']]]) {
    const pool = poolWith([existing]); await dailyRandom(pool, name); assert.deepEqual(pool.calls[0].params, expected);
  }
});
await check('每日表无该地区时读取同地区已发布图库', async () => {
  const pool = poolWith([], [gallery]); const item = await dailyRandom(pool, '浙江');
  assert.equal(item.regionMatched, true); assert.equal(item.region, '浙江');
  assert.equal(item.title, '浙江省皮影图1'); assert.equal(item.description, gallery.feature_styling);
  assert.equal(item.imageUrl, '/images/map/zjpy (1).png'); assert.equal(item.image_url, item.imageUrl);
  assert.equal(item.source, 'region-gallery'); assert.equal(item.id, 'profile-media-85');
  assert.equal(item.mediaId, 485); assert.equal(item.profileId, 14);
  assert.deepEqual(pool.calls[1].params, ['浙江', '浙江']);
  for (const condition of ["p.status = 'published'", 'r.status = 1', 'm.status = 1', "m.media_type = 'image'", "pm.usage_type IN ('cover', 'gallery')"]) assert(pool.calls[1].sql.includes(condition));
});
await check('媒体标题、简介和行政全称兜底', async () => {
  const row = { ...gallery, caption: '', summary: '地方档案简介', region_short_name: '', image_url: '/images/map/zjpy (2).png' };
  const item = await dailyRandom(poolWith([], [row]), '浙江省');
  assert.equal(item.title, '浙江皮影'); assert.equal(item.description, '地方档案简介'); assert.equal(item.region, '浙江省');
  assert.equal(item.imageUrl, row.image_url);
});
await check('两个来源都无该地区才跨地区随机', async () => {
  const pool = poolWith([], [], [existing]); const item = await dailyRandom(pool, '不存在地区');
  assert.equal(item.regionMatched, false); assert.equal(pool.calls.length, 3);
});
await check('未选地区沿用全库随机', async () => {
  const pool = poolWith([existing]); assert.equal((await dailyRandom(pool)).regionMatched, true); assert.equal(pool.calls.length, 1);
});
await check('空图库正常返回空对象', async () => {
  assert.deepEqual(await dailyRandom(poolWith([], [], []), '浙江'), {});
});
await check('特殊名称按精确参数匹配，无通配符或原型链误匹配', async () => {
  for (const name of ['constructor', '__proto__', '浙%', '浙_', "浙江' OR 1=1 --"]) {
    const pool = poolWith([], [], [existing]); assert.equal((await dailyRandom(pool, name)).regionMatched, false);
    assert(pool.calls[0].params.includes(name)); assert(pool.calls[1].params.includes(name));
    assert(!pool.calls[1].sql.includes(name)); assert(!pool.calls[1].sql.includes(' LIKE '));
  }
});
console.log('Daily region regression: '+count+'/'+count);

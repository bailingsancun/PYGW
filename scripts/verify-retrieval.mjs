/**
 * 实现功能：RAG 检索质量评估（Hit@1 / Hit@4 / MRR）
 * 用法：node scripts/verify-retrieval.mjs
 * 说明：
 *   - 从真实语料（MySQL → corpus.js）加载 chunk，构造带期望标注的查询集；
 *   - 同时跑「基线（单路关键词）」与「混合（同义词扩展 + RRF 融合 + 启发式重排）」两组，
 *     给出可量化的提升；
 *   - 期望标注只依据 chunk 的 topic / region / title 做客观匹配，不针对实现过拟合。
 */
import { loadEnv } from '../server/src/env.js';
import { createDb } from '../server/src/db.js';
import { loadCorpus } from '../server/src/ai/corpus.js';
import { prepareChunks, retrieve } from '../server/src/ai/retrieval.js';

/** 用例：query + 期望命中的判据（topic / region / title 任一匹配即算命中） */
const CASES = [
  { q: '皮影怎么做', topic: '工艺' },
  { q: '选皮是什么意思', topic: '工艺' },
  { q: '镂刻的刀法有哪几种', topic: '工艺' },
  { q: '敷彩用什么颜料', topic: '工艺' },
  { q: '缀结怎么装关节', topic: '工艺' },
  { q: '皮影有多少年历史', topic: '历史' },
  { q: '宋代皮影发展', topic: '历史' },
  { q: '明清时期的皮影', topic: '历史' },
  { q: '民国皮影戏班', topic: '历史' },
  { q: '陕西皮影有什么特点', region: '陕西' },
  { q: '唐山皮影的唱腔', region: '河北' },
  { q: '四川皮影造型', region: '四川' },
  { q: '山东皮影代表剧目', region: '山东' },
  { q: '山西皮影的影人', region: '山西' },
  { q: '辽东皮影', region: '辽宁' },
  { q: '甘肃皮影的雕刻', region: '甘肃' },
  // 同义词：用户不会说"皮影"，而说"灯影 / 影子戏 / 乐亭影"
  { q: '灯影戏是什么', topics: ['工艺', '历史'] },
  { q: '影子戏怎么演', topic: '历史' },
  { q: '乐亭影', region: '河北' },
  { q: '陇东皮影', region: '甘肃' },
  { q: '驴皮影用什么皮', topic: '工艺' },
  { q: '秦腔皮影', region: '陕西' },
];

/** 判断某条命中是否满足用例期望（topic / topics / region / title 任一成立即算命中） */
const matches = (item, c) => {
  const chunk = item.chunk;
  if (c.topic && chunk.topic !== c.topic) return false;
  if (c.topics && !c.topics.includes(chunk.topic)) return false;
  if (c.region && chunk.region !== c.region) return false;
  if (c.title && !String(chunk.title || '').includes(c.title)) return false;
  return true;
};

const run = (chunks, rrf) => {
  let hit1 = 0;
  let hit4 = 0;
  let mrr = 0;
  const misses = [];
  for (const c of CASES) {
    const results = retrieve(chunks, { query: c.q, region: c.region || '', k: 4, rrf });
    const rank = results.findIndex((item) => matches(item, c)) + 1;
    if (rank === 1) hit1 += 1;
    if (rank >= 1 && rank <= 4) hit4 += 1;
    if (rank >= 1) mrr += 1 / rank;
    else misses.push(c.q);
  }
  const n = CASES.length;
  return {
    hit1: hit1 / n,
    hit4: hit4 / n,
    mrr: mrr / n,
    misses,
  };
};

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const f3 = (v) => v.toFixed(3);

const config = loadEnv();
const pool = createDb(config);
const chunks = prepareChunks(await loadCorpus(pool));

console.log(`语料: ${chunks.length} 块 | 用例: ${CASES.length} 条`);
console.log('');

const base = run(chunks, false);
const mixed = run(chunks, true);

const row = (name, r) => `  ${name.padEnd(26)} Hit@1 ${pct(r.hit1)}  Hit@4 ${pct(r.hit4)}  MRR ${f3(r.mrr)}`;
console.log('=== 检索质量 ===');
console.log(row('基线（单路关键词）', base));
console.log(row('混合（同义词+RRF+重排）', mixed));
console.log('');
const delta = (a, b) => {
  const d = b - a;
  return d >= 0 ? `+${(d * 100).toFixed(1)}pt` : `${(d * 100).toFixed(1)}pt`;
};
console.log('=== 提升 ===');
console.log(`  Hit@1 ${delta(base.hit1, mixed.hit1)}   Hit@4 ${delta(base.hit4, mixed.hit4)}   MRR ${delta(base.mrr, mixed.mrr)}`);
if (mixed.misses.length) console.log('  混合模式未命中:', mixed.misses.join(' / '));
if (base.misses.length) console.log('  基线未命中  :', base.misses.join(' / '));

await pool.end();

// 评估口径：Hit@4 达到 85% 视为通过，否则退出码 1（供 CI 使用）
const ok = mixed.hit4 >= 0.85;
console.log('');
console.log(ok ? `PASS  混合检索 Hit@4 = ${pct(mixed.hit4)}（阈值 85%）` : `FAIL  混合检索 Hit@4 = ${pct(mixed.hit4)}（阈值 85%）`);
process.exit(ok ? 0 : 1);

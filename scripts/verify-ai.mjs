/**
 * 实现功能：AI 讲解员 / RAG 离线自检（无需 DB、无需外网、无需密钥）
 * 职责：
 *   1) 纯逻辑单测：检索（tokenize/cosine/retrieve 关键词+向量+地区加权+阈值）、
 *      provider（三协议 buildRequest 与 SSE 解析）、prompt（grounded 组装/兜底）、env 校验。
 *   2) 环回 HTTP 集成：用假 pool + fixture 语料起 createAiServer，
 *      未配置走静态兜底；配置指向本地 mock LLM 走流式，断言真实 SSE 线格式与上游请求。
 * 用法：node scripts/verify-ai.mjs（npm run verify:ai）
 */
import http from 'node:http';
import { tokenize, prepareChunks, cosine, retrieve } from '../server/src/ai/retrieval.js';
import { FORMATS, buildRequest, createStreamParser } from '../server/src/ai/provider.js';
import { buildMessages, narrateQuestion, fallbackAnswer } from '../server/src/ai/prompt.js';
import { loadEnv } from '../server/src/env.js';
import { createAiServer } from '../server/src/ai-server.js';

const results = [];
const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};
const check = (name, fn) => {
  try {
    results.push({ name, ok: true, detail: fn() || '' });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
};
const checkAsync = async (name, fn) => {
  try {
    results.push({ name, ok: true, detail: (await fn()) || '' });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

const fixtureChunks = () => prepareChunks([
  { id: 'craft-1', topic: '工艺', region: '', title: '选皮与制皮', text: '皮影制作先选上等牛皮，经浸泡、刮制、绷平、阴干，制成半透明的影窗材料。', route: { path: '/process', query: {} } },
  { id: 'history-1', topic: '历史', region: '', title: '汉代·起源', text: '皮影戏相传起源于汉代，兴盛于唐宋，以兽皮或纸板做成影人，在光源照射下隔亮布演出。', route: { path: '/history', query: {} } },
  { id: 'region-1', topic: '地域', region: '陕西省', title: '秦晋影系 - 陕西省', text: '陕西皮影东路华县高28厘米推皮走刀精美细腻，碗碗腔细腻幽雅，代表剧目《金碗钗》《春秋配》。', route: { path: '/display', query: { region: '陕西省' } } },
  { id: 'region-2', topic: '地域', region: '河北省', title: '滦州影系 - 河北省', text: '河北滦州影驴皮雕镂通天鼻梁，乐亭方言掐嗓唱法，代表剧目《五锋会》《二度梅》。', route: { path: '/display', query: { region: '河北省' } } },
]);

const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = (server) => new Promise((resolve) => {
  server.closeAllConnections?.();
  server.close(() => resolve());
});

/** 按前端 src/api/ai.js 的同款逻辑解析 AI 服务的 SSE 线格式 */
const consumeSse = async (url, payload) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload),
  });
  assert(res.status === 200, `HTTP 状态应为 200，实际 ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  assert(ct.includes('text/event-stream'), `Content-Type 应为 SSE，实际 ${ct}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = '';
  const events = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) {
        const raw = line.slice(5).trim();
        if (!raw) continue;
        let data;
        try { data = JSON.parse(raw); } catch { continue; }
        events.push({ event, data });
      }
    }
  }
  return events;
};

const unitTests = () => {
  // --- 检索 ---
  check('tokenize 中文切 bigram', () => {
    const g = tokenize('陕西皮影');
    assert(g.has('陕西') && g.has('西皮') && g.has('皮影'), `bigram 缺失：${[...g]}`);
    return [...g].join(',');
  });
  check('tokenize ascii 整词 + 小写归一', () => {
    const g = tokenize('ABC 123');
    assert(g.has('abc') && g.has('123'), `ascii token 缺失：${[...g]}`);
    return 'abc,123';
  });
  check('cosine 同向=1 正交=0 维度不符=0', () => {
    assert(near(cosine([1, 0], [1, 0]), 1), '同向应为 1');
    assert(near(cosine([1, 0], [0, 1]), 0), '正交应为 0');
    assert(cosine([1, 0], [1, 0, 0]) === 0, '维度不符应为 0');
    return '1 / 0 / 0';
  });
  check('retrieve 关键词命中排序（陕西问题→陕西 chunk）', () => {
    const r = retrieve(fixtureChunks(), { query: '陕西皮影特色', region: '陕西省', k: 4 });
    assert(r.length > 0, '应有命中');
    assert(r[0].chunk.id === 'region-1', `应排首位 region-1，实际 ${r[0].chunk.id}`);
    assert(r.every((x) => x.base >= 0.06), '存在低于阈值的结果');
    return r.map((x) => x.chunk.id).join('>');
  });
  check('retrieve 地区加权 +0.3', () => {
    const withRegion = retrieve(fixtureChunks(), { query: '皮影', region: '陕西省', k: 4 });
    const withoutRegion = retrieve(fixtureChunks(), { query: '皮影', region: '', k: 4 });
    const a = withRegion.find((x) => x.chunk.id === 'region-1');
    const b = withoutRegion.find((x) => x.chunk.id === 'region-1');
    assert(a && b, '陕西 chunk 应在两次检索中都命中');
    assert(near(a.score - b.score, 0.3), `地区命中应 +0.3，实际 ${a.score - b.score}`);
    return `Δscore=${(a.score - b.score).toFixed(2)}`;
  });
  check('retrieve 无关问题低于阈值返回空', () => {
    const r = retrieve(fixtureChunks(), { query: '量子力学区块链', k: 4 });
    assert(r.length === 0, `无关问题应返回 []，实际 ${r.length} 项`);
    return '[]';
  });
  check('retrieve 向量模式用 cosine 且阈值 0.2', () => {
    const v = prepareChunks([
      { id: 'a', title: 'A', text: 'alpha', region: '', vector: [1, 0, 0] },
      { id: 'b', title: 'B', text: 'beta', region: '', vector: [0, 1, 0] },
    ]);
    const r = retrieve(v, { query: 'x', queryVector: [1, 0, 0], k: 2 });
    assert(r.length === 1 && r[0].chunk.id === 'a', `向量检索应只命中 a，实际 ${JSON.stringify(r.map((x) => x.chunk.id))}`);
    return 'a';
  });

  // --- provider ---
  check('FORMATS 三协议', () => {
    assert(JSON.stringify(FORMATS) === JSON.stringify(['chat', 'message', 'response']), `实际 ${FORMATS}`);
    return FORMATS.join('/');
  });
  const messages = [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }];
  check('buildRequest chat：URL/Bearer/body', () => {
    const { url, headers, body } = buildRequest({ AI_FORMAT: 'chat', AI_BASE_URL: 'https://api.x.com/v1/', AI_API_KEY: 'sk-test', AI_MODEL: 'm' }, { messages });
    assert(url === 'https://api.x.com/v1/chat/completions', `URL 错：${url}`);
    assert(headers.Authorization === 'Bearer sk-test', 'Authorization 错');
    assert(headers.Accept === 'text/event-stream', '缺 SSE Accept');
    assert(body.model === 'm' && body.stream === true && body.messages.length === 2 && body.temperature === 0.4, `body 错：${JSON.stringify(body)}`);
    return url;
  });
  check('buildRequest message：x-api-key/system 拆分/max_tokens', () => {
    const { url, headers, body } = buildRequest({ AI_FORMAT: 'message', AI_BASE_URL: 'https://api.anthropic.com/v1', AI_API_KEY: 'sk-ant', AI_MODEL: 'claude' }, { messages });
    assert(url === 'https://api.anthropic.com/v1/messages', `URL 错：${url}`);
    assert(headers['x-api-key'] === 'sk-ant' && headers['anthropic-version'] === '2023-06-01', 'Anthropic 头错');
    assert(!headers.Authorization, 'message 不应带 Bearer');
    assert(body.system === 'S' && body.messages.length === 1 && body.messages[0].role === 'user' && body.max_tokens === 1024, `body 错：${JSON.stringify(body)}`);
    return url;
  });
  check('buildRequest response：instructions/input', () => {
    const { url, headers, body } = buildRequest({ AI_FORMAT: 'response', AI_BASE_URL: 'https://api.openai.com/v1', AI_API_KEY: 'sk-oai', AI_MODEL: 'gpt' }, { messages });
    assert(url === 'https://api.openai.com/v1/responses', `URL 错：${url}`);
    assert(headers.Authorization === 'Bearer sk-oai', 'Authorization 错');
    assert(body.instructions === 'S' && body.input.length === 1 && body.input[0].role === 'user', `body 错：${JSON.stringify(body)}`);
    return url;
  });
  check('SSE 解析 chat：delta/[DONE]/error', () => {
    const p = createStreamParser('chat');
    assert(p.push('data: {"choices":[{"delta":{"content":"你好"}}]}').text === '你好', 'delta 解析错');
    assert(p.push('data: [DONE]').done === true, '[DONE] 未识别');
    assert(p.push('data: {"error":{"message":"boom"}}').error === 'boom', 'error 未识别');
    assert(Object.keys(p.push('event: foo')).length === 0, 'event 行应返回空');
    return '你好 / done / boom';
  });
  check('SSE 解析 message：content_block_delta/message_stop', () => {
    const p = createStreamParser('message');
    p.push('event: content_block_delta');
    assert(p.push('data: {"type":"content_block_delta","delta":{"text":"皮影"}}').text === '皮影', 'delta 解析错');
    assert(p.push('data: {"type":"message_stop"}').done === true, 'message_stop 未识别');
    return '皮影 / done';
  });
  check('SSE 解析 response：output_text.delta/completed', () => {
    const p = createStreamParser('response');
    assert(p.push('data: {"type":"response.output_text.delta","delta":"影"}').text === '影', 'delta 解析错');
    assert(p.push('data: {"type":"response.completed"}').done === true, 'completed 未识别');
    return '影 / done';
  });

  // --- prompt ---
  check('buildMessages grounded 组装（系统纪律+编号材料+上下文）', () => {
    const chunks = fixtureChunks();
    const m = buildMessages({ question: '陕西皮影特色', region: '陕西省', page: '/display', sources: [{ chunk: chunks[2] }] });
    assert(m.length === 2 && m[0].role === 'system' && m[1].role === 'user', 'messages 结构错');
    assert(m[0].content.includes('只依据') && m[0].content.includes('[1][2]'), '系统纪律缺失');
    assert(m[1].content.includes('【参观者问题】陕西皮影特色'), '问题缺失');
    assert(m[1].content.includes('当前地区：陕西省') && m[1].content.includes('当前页面：皮影展示'), '上下文缺失');
    assert(m[1].content.includes('[1] 《秦晋影系 - 陕西省》'), '编号材料缺失');
    return 'system+user grounded';
  });
  check('narrateQuestion 地区/页面/通用三分支', () => {
    assert(narrateQuestion({ region: '陕西省' }).includes('陕西省'), '地区分支错');
    assert(narrateQuestion({ page: '/process' }).includes('工序'), '工艺分支错');
    assert(narrateQuestion({}).includes('皮影戏'), '通用分支错');
    return 'region/page/general';
  });
  check('fallbackAnswer 空态与 curated 兜底', () => {
    assert(fallbackAnswer([]).includes('现有资料未涵盖'), '空态兜底错');
    const chunks = fixtureChunks();
    const f = fallbackAnswer([{ chunk: chunks[2] }]);
    assert(f.includes('AI 暂不可用') && f.includes('秦晋影系 - 陕西省'), 'curated 兜底错');
    return '空态 / curated';
  });

  // --- env 校验（进程 env 覆盖，不写文件）---
  check('loadEnv 拒绝非法 AI_FORMAT', () => {
    process.env.AI_FORMAT = 'bogus';
    let threw = false;
    try { loadEnv({ requireDb: false }); } catch (e) { threw = /AI_FORMAT 非法/.test(e.message); }
    delete process.env.AI_FORMAT;
    assert(threw, '非法格式应抛错');
    return 'throws';
  });
  check('loadEnv requireDb=false 归一化合法 AI_FORMAT', () => {
    process.env.AI_FORMAT = 'MESSAGE';
    const c = loadEnv({ requireDb: false });
    delete process.env.AI_FORMAT;
    assert(c.AI_FORMAT === 'message', `应小写归一为 message，实际 ${c.AI_FORMAT}`);
    assert(c.AI_PORT === 8788, `AI_PORT 默认应为 8788，实际 ${c.AI_PORT}`);
    return 'message / 8788';
  });
};

const integrationTests = async () => {
  // E1：未配置 LLM → 静态兜底（无 DB、无外网）
  const chunks = fixtureChunks();
  const server0 = createAiServer({}, { AI_FORMAT: 'chat', AI_MODEL: '', AI_BASE_URL: '', AI_API_KEY: '' }, { chunks, mode: 'keyword' });
  const port0 = await listen(server0);
  const base0 = `http://127.0.0.1:${port0}`;
  try {
    await checkAsync('HTTP /health 未配置态', async () => {
      const j = await fetch(`${base0}/api/ai/health`).then((r) => r.json());
      assert(j.code === 200 && j.data.configured === false, `health 错：${JSON.stringify(j)}`);
      assert(j.data.retrieval === 'keyword' && j.data.chunks === chunks.length, `索引态错：${JSON.stringify(j.data)}`);
      return `configured=false chunks=${chunks.length}`;
    });
    await checkAsync('HTTP /ask SSE：sources→delta(兜底)→done', async () => {
      const ev = await consumeSse(`${base0}/api/ai/ask`, { question: '陕西皮影特色', region: '陕西省', page: '/display' });
      assert(ev[0].event === 'sources' && Array.isArray(ev[0].data), '首事件应为 sources 数组');
      assert(ev[0].data.some((s) => s.title === '秦晋影系 - 陕西省'), 'sources 应含陕西 chunk');
      assert(ev[0].data[0].route && ev[0].data[0].route.path === '/display', 'source 应带可跳转 route');
      const delta = ev.filter((e) => e.event === 'delta').map((e) => e.data.text).join('');
      assert(delta.includes('AI 暂不可用'), '未配置应走 curated 兜底');
      const done = ev.find((e) => e.event === 'done');
      assert(done && done.data.fallback === true && done.data.retrieval === 'keyword', `done 错：${JSON.stringify(done)}`);
      return ev.map((e) => e.event).join('→');
    });
    await checkAsync('HTTP /ask 空问题返回 code 400', async () => {
      const j = await fetch(`${base0}/api/ai/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: '' }) }).then((r) => r.json());
      assert(j.code === 400, `应 400，实际 ${j.code}`);
      return 'code=400';
    });
    await checkAsync('HTTP 未知端点 code 404', async () => {
      const j = await fetch(`${base0}/api/ai/nope`).then((r) => r.json());
      assert(j.code === 404, `应 404，实际 ${j.code}`);
      return 'code=404';
    });
  } finally {
    await close(server0);
  }

  // E2：配置指向本地 mock LLM → 真实流式（仅环回，无外网）
  let captured = null;
  const mock = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      captured = { url: req.url, auth: req.headers.authorization, ct: req.headers['content-type'], body: JSON.parse(body) };
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
      res.write('data: {"choices":[{"delta":{"content":"陕西皮影"}}]}\n\n');
      res.write('data: {"choices":[{"delta":{"content":"以碗碗腔著称[1]。"}}]}\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
    });
  });
  const mockPort = await listen(mock);
  const config1 = { AI_FORMAT: 'chat', AI_MODEL: 'mock-model', AI_BASE_URL: `http://127.0.0.1:${mockPort}/v1`, AI_API_KEY: 'sk-mock' };
  const server1 = createAiServer({}, config1, { chunks: fixtureChunks(), mode: 'keyword' });
  const port1 = await listen(server1);
  const base1 = `http://127.0.0.1:${port1}`;
  try {
    await checkAsync('HTTP /health 已配置态', async () => {
      const j = await fetch(`${base1}/api/ai/health`).then((r) => r.json());
      assert(j.code === 200 && j.data.configured === true && j.data.model === 'mock-model', `health 错：${JSON.stringify(j)}`);
      return 'configured=true';
    });
    await checkAsync('HTTP /ask 流式：sources→delta*→done(fallback=false)', async () => {
      const ev = await consumeSse(`${base1}/api/ai/ask`, { question: '陕西皮影特色', region: '陕西省' });
      assert(ev[0].event === 'sources', '首事件应为 sources');
      const text = ev.filter((e) => e.event === 'delta').map((e) => e.data.text).join('');
      assert(text === '陕西皮影以碗碗腔著称[1]。', `流式累计文本错：${text}`);
      const done = ev.find((e) => e.event === 'done');
      assert(done && done.data.fallback === false, `done 应 fallback=false：${JSON.stringify(done)}`);
      return `${ev.filter((e) => e.event === 'delta').length} 段 delta`;
    });
    await checkAsync('上游请求契约：URL/Bearer/model/stream/grounded messages', async () => {
      assert(captured, 'mock 未收到请求');
      assert(captured.url === '/v1/chat/completions', `上游 URL 错：${captured.url}`);
      assert(captured.auth === 'Bearer sk-mock', `上游鉴权错：${captured.auth}`);
      assert(captured.ct.includes('application/json'), '上游 Content-Type 错');
      assert(captured.body.model === 'mock-model' && captured.body.stream === true, `上游 body 错：${JSON.stringify(captured.body)}`);
      assert(captured.body.messages[0].role === 'system', '首条应为 system');
      assert(captured.body.messages[1].content.includes('陕西皮影特色') && captured.body.messages[1].content.includes('[1]'), 'grounded 材料未注入上游');
      return captured.url;
    });
    await checkAsync('HTTP /narrate 地区讲解流式', async () => {
      const ev = await consumeSse(`${base1}/api/ai/narrate`, { region: '陕西省', page: '/display' });
      const done = ev.find((e) => e.event === 'done');
      assert(done && done.data.fallback === false, 'narrate 应流式成功');
      assert(captured.body.messages[1].content.includes('讲解陕西省皮影'), `narrate 问题错：${captured.body.messages[1].content}`);
      return 'narrate ok';
    });
  } finally {
    await close(server1);
    await close(mock);
  }
};

const main = async () => {
  unitTests();
  await integrationTests();
  const failed = results.filter((r) => !r.ok);
  const width = Math.max(...results.map((r) => r.name.length));
  console.log('');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  ${r.ok ? r.detail : '← ' + r.detail}`);
  }
  console.log('');
  console.log(`合计 ${results.length} 项：通过 ${results.length - failed.length}，失败 ${failed.length}`);
  if (failed.length) process.exitCode = 1;
};

main().catch((error) => {
  console.error(`自检脚本异常：${error.stack || error.message}`);
  process.exitCode = 1;
});
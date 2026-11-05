/**
 * 实现功能：shim 契约验收脚本（对应 HANDOFF §9.1）
 * 职责：逐条请求 7 个端点 + 健康检查 + 负例，断言 envelope 形状、字段名（camel/snake 规则）、
 *       数量、类型与容错行为。字段名断言是重点：只看 200 会漏掉「整页暂无数据」的坑。
 * 用法：node scripts/verify-shim.mjs [baseUrl]
 *       默认 http://127.0.0.1:8787/api/v1
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8787/api/v1').replace(/\/+$/, '');

const results = [];

const check = (name, fn) => {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail });
  } catch (error) {
    results.push({ name, ok: false, detail: error.message });
  }
};

const assert = (cond, message) => {
  if (!cond) throw new Error(message);
};

const get = async (path, params) => {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params || {})) url.searchParams.set(key, value);
  const res = await fetch(url);
  const text = await res.text();
  assert(res.status === 200, `HTTP 状态应为 200，实际 ${res.status}`);
  const contentType = res.headers.get('content-type') || '';
  assert(contentType.includes('application/json'), `Content-Type 应为 JSON，实际 ${contentType}`);
  assert(contentType.includes('charset=utf-8'), `缺少 charset=utf-8，实际 ${contentType}`);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`响应不是合法 JSON：${text.slice(0, 120)}`);
  }
  assert(json && typeof json === 'object', 'envelope 不是对象');
  assert(json.code === 200, `envelope.code 应为 200，实际 ${json.code}（message=${json.message}）`);
  assert('data' in json, 'envelope 缺少 data 字段');
  return json.data;
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const main = async () => {
  // 0) 健康检查
  const health = await fetch(`${BASE}/healthz`).then((res) => res.json());
  check('GET /healthz', () => {
    assert(health.code === 200 && health.data && health.data.status === 'ok', `健康检查失败：${JSON.stringify(health)}`);
    return `db=${health.data.db}`;
  });

  // 1) /assets/common —— 87 项，imageKey + relativePath 必须是 camel
  const common = await get('/assets/common');
  check('GET /assets/common 是 87 项数组且字段为 camel', () => {
    assert(Array.isArray(common), 'data 应为数组');
    assert(common.length === 87, `应为 87 项，实际 ${common.length}`);
    const first = common[0];
    assert(isNonEmptyString(first.imageKey), `缺少 imageKey（snake 会整页失效）：${JSON.stringify(first)}`);
    assert(isNonEmptyString(first.relativePath), `缺少 relativePath：${JSON.stringify(first)}`);
    assert(!('image_key' in first), '不应残留 snake 键 image_key');
    return `首项 ${first.imageKey} → ${first.relativePath}`;
  });

  // 2) /daily-appreciations/random —— 对象
  const daily = await get('/daily-appreciations/random');
  check('GET /daily-appreciations/random 是对象且含 title/description/imageUrl', () => {
    assert(daily && !Array.isArray(daily) && typeof daily === 'object', 'data 应为对象');
    assert(isNonEmptyString(daily.title), `title 为空：${JSON.stringify(daily)}`);
    assert(isNonEmptyString(daily.description), 'description 为空');
    assert(isNonEmptyString(daily.imageUrl || daily.image_url), 'imageUrl / image_url 均为空');
    return `${daily.title} | ${(daily.imageUrl || daily.image_url).slice(0, 48)}`;
  });

  // 3) /quiz/questions/random —— 数组，camel 字段
  const quiz = await get('/quiz/questions/random');
  check('GET /quiz/questions/random 是 5 项数组且选项字段为 camel', () => {
    assert(Array.isArray(quiz), 'data 应为数组');
    assert(quiz.length === 5, `默认应为 5 题，实际 ${quiz.length}`);
    for (const item of quiz) {
      assert(isNonEmptyString(item.questionText), `questionText 缺失：${JSON.stringify(item)}`);
      for (const key of ['optionA', 'optionB', 'optionC', 'optionD']) {
        assert(isNonEmptyString(item[key]), `${key} 缺失（snake 会导致选项全消失）`);
      }
      assert(['A', 'B', 'C', 'D'].includes(item.correctAnswer), `correctAnswer 必须是单字符 A-D，实际 ${item.correctAnswer}`);
      assert('type' in item, '缺少 type（来自 category）');
      assert(!('question_text' in item), '不应残留 snake 键 question_text');
    }
    return `5 题，首题 answers=${quiz.map((q) => q.correctAnswer).join('')}`;
  });

  // 3b) limit 覆盖
  const quiz3 = await get('/quiz/questions/random', { limit: '3' });
  check('GET /quiz/questions/random?limit=3 生效', () => {
    assert(Array.isArray(quiz3) && quiz3.length === 3, `应为 3 题，实际 ${Array.isArray(quiz3) ? quiz3.length : typeof quiz3}`);
    return 'limit=3';
  });

  // 4) /craft-process/steps —— 8 项，stepSort/detailsContent 必须 camel
  const steps = await get('/craft-process/steps');
  check('GET /craft-process/steps 是 8 项数组且 stepSort/detailsContent 为 camel', () => {
    assert(Array.isArray(steps), 'data 应为数组');
    assert(steps.length === 8, `应为 8 项，实际 ${steps.length}`);
    let prev = 0;
    for (const step of steps) {
      assert(typeof step.stepSort === 'number' && step.stepSort > 0, `stepSort 必须是数字：${JSON.stringify(step)}`);
      assert(step.stepSort > prev, `stepSort 未升序：${prev} → ${step.stepSort}`);
      prev = step.stepSort;
      assert(isNonEmptyString(step.title), 'title 为空');
      assert('detailsContent' in step, '缺少 detailsContent（snake detail_content 会让详情消失）');
      assert(!('details_content' in step), '不应残留 snake 键 details_content');
    }
    return `8 步：${steps.map((s) => s.title).join('→')}`;
  });

  // 5) /history/timeline —— 保留 snake
  const timeline = await get('/history/timeline');
  check('GET /history/timeline 是 8 项数组且保留 snake 字段', () => {
    assert(Array.isArray(timeline), 'data 应为数组');
    assert(timeline.length === 8, `应为 8 项，实际 ${timeline.length}`);
    for (const era of timeline) {
      assert(isNonEmptyString(era.era_name), 'era_name 为空');
      assert(isNonEmptyString(era.era_title), 'era_title 为空');
      assert('detail_content' in era, '缺少 detail_content');
      assert('time_range' in era, '缺少 time_range');
      assert('sort_order' in era, '缺少 sort_order');
    }
    const sorted = timeline.every((era, idx) => idx === 0 || timeline[idx - 1].sort_order <= era.sort_order);
    assert(sorted, 'sort_order 未升序');
    return `${timeline.map((e) => e.era_name).join(' / ')}`;
  });

  // 6) /regions/by-name —— 后缀容错是关键回归点
  const regionCases = [
    { name: '陕西', expectPrefix: '陕西省' },
    { name: '陕西省', expectPrefix: '陕西省' },
    { name: '内蒙古', expectPrefix: '内蒙古自治区' },
    { name: '广西', expectPrefix: '广西壮族自治区' },
    { name: '上海', expectPrefix: '上海市' },
  ];
  for (const item of regionCases) {
    const region = await get('/regions/by-name', { name: item.name });
    check(`GET /regions/by-name?name=${item.name} 命中 ${item.expectPrefix}`, () => {
      assert(region && !Array.isArray(region) && typeof region === 'object', 'data 应为对象');
      assert(isNonEmptyString(region.provinceName), `provinceName 为空：${JSON.stringify(region)}`);
      assert(
        region.provinceName.startsWith(item.expectPrefix) || region.provinceName === item.expectPrefix,
        `期望 ${item.expectPrefix}，实际 ${region.provinceName}`,
      );
      for (const key of ['popularAreas', 'featureStyling', 'featureColoring', 'featureSinging', 'representativePlays']) {
        assert(key in region, `缺少 camel 字段 ${key}（别名错会整页暂无数据）`);
      }
      assert(!('province_name' in region), '不应残留 snake 键 province_name');
      assert(isNonEmptyString(region.featureStyling), 'featureStyling 为空');
      return region.provinceName;
    });
  }

  // 7) 0 行必须返回合理空态
  const missing = await get('/regions/by-name', { name: '不存在的省份' });
  check('GET /regions/by-name?name=不存在的省份 返回空态对象而非 null', () => {
    assert(missing && typeof missing === 'object' && !Array.isArray(missing), 'data 应为对象');
    assert(missing.provinceName === '不存在的省份', `provinceName 应回显入参，实际 ${JSON.stringify(missing)}`);
    return 'provinceName 回显入参';
  });

  // 8) 预编译生效：注入样本不报 SQL 错、不乱码
  for (const evil of ["陕西'; DROP TABLE quiz_questions; --", "100%_test"]) {
    const region = await get('/regions/by-name', { name: evil });
    check(`预编译防注入：name=${JSON.stringify(evil)}`, () => {
      assert(region && typeof region === 'object', '应返回对象');
      assert('provinceName' in region, '应含 provinceName');
      return '未抛 SQL 错误';
    });
  }

  // 9) /interactive-materials/random —— 6 项，不含 x/y/size
  const puppets = await get('/interactive-materials/random');
  check('GET /interactive-materials/random 是 6 项数组且不含 x/y/size', () => {
    assert(Array.isArray(puppets), 'data 应为数组');
    assert(puppets.length === 6, `默认应为 6 个，实际 ${puppets.length}`);
    for (const puppet of puppets) {
      assert(isNonEmptyString(puppet.name), `name 为空：${JSON.stringify(puppet)}`);
      assert(isNonEmptyString(puppet.imageUrl || puppet.image_url), 'imageUrl / image_url 均为空');
      for (const forbidden of ['x', 'y', 'size', 'found', 'justFound']) {
        assert(!(forbidden in puppet), `shim 不应返回布点字段 ${forbidden}`);
      }
    }
    return puppets.map((p) => p.name).join('、');
  });

  // 10) 未知路径与非法方法
  const unknown = await fetch(`${BASE}/no-such-endpoint`).then((res) => res.json());
  check('未知端点返回 code 404 且 HTTP 200', () => {
    assert(unknown.code === 404, `code 应为 404，实际 ${unknown.code}`);
    return 'code=404';
  });

  const badMethod = await fetch(`${BASE}/assets/common`, { method: 'POST' }).then((res) => res.json());
  check('POST 被拒绝（code 405）', () => {
    assert(badMethod.code === 405, `code 应为 405，实际 ${badMethod.code}`);
    return 'code=405';
  });

  // 11) 中文不乱码
  check('中文编码正常（UTF-8 往返）', () => {
    const sample = timeline[0].era_name;
    assert(isNonEmptyString(sample), 'era_name 为空');
    assert(!sample.includes('\uFFFD'), '出现替换字符，编码损坏');
    return sample;
  });

  const failed = results.filter((item) => !item.ok);
  const width = Math.max(...results.map((item) => item.name.length));
  console.log('');
  for (const item of results) {
    console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name.padEnd(width)}  ${item.ok ? item.detail : '← ' + item.detail}`);
  }
  console.log('');
  console.log(`合计 ${results.length} 项：通过 ${results.length - failed.length}，失败 ${failed.length}`);
  if (failed.length) process.exitCode = 1;
};

main().catch((error) => {
  console.error(`验收脚本异常：${error.message}`);
  process.exitCode = 1;
});

/**
 * 实现功能：7 个 v1 只读端点的取数与字段映射
 * 职责：严格对齐 HANDOFF §5/§6 的契约。camelCase 改名规则是本文件最敏感的部分：
 *       /assets/common、/quiz/questions/random、/regions/by-name 只认 camel；
 *       /craft-process/steps 的 stepSort/detailsContent 必须是 camel；
 *       /history/timeline 保留 DB 原始 snake（页面双回落齐全，无需改名）。
 * 接口/函数清单：
 *   - assetsCommon / dailyRandom / quizRandom / craftSteps / historyTimeline / regionByName / interactiveRandom
 *   - DEFAULT_QUIZ_LIMIT / DEFAULT_PUPPET_LIMIT / MAX_LIMIT
 */
import { select } from './db.js';
import { rowToCamel } from './envelope.js';

/** §10-Q4 已由用户确认：quiz 每轮 5 题、interactive 每局 6 个影偶 */
export const DEFAULT_QUIZ_LIMIT = 5;
export const DEFAULT_PUPPET_LIMIT = 6;
export const MAX_LIMIT = 50;

/** 把外部 limit 参数归一化为 [1, MAX_LIMIT] 内的整数 */
export const normalizeLimit = (raw, fallback) => {
  const value = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(MAX_LIMIT, Math.max(1, value));
};

/** LIKE 前缀匹配前转义通配符，避免用户输入的 % / _ 被当作模式 */
const escapeLike = (value = '') => String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);

// 1) GET /assets/common —— 只认 imageKey / relativePath（HANDOFF §5.1）
export const assetsCommon = async (pool) => {
  const rows = await select(
    pool,
    'SELECT image_key, relative_path FROM app_common_image ORDER BY id',
  );
  return rows.map((row) => ({
    imageKey: row.image_key,
    relativePath: row.relative_path,
  }));
};

/*
 * 每日一赏的地区别名：地图/地区条用的是行政区名，而 daily_appreciation.region 里
 * 存的是历史称谓或下辖地名。如「辽宁」->「辽东」（辽东皮影选粹·一~六）、
 * 「河北」->「唐山」（唐山皮影即冀东皮影，库里以「唐山」入库）。
 * 只映射确定的对应关系，不要为了"看起来有数据"乱加。
 */
const DAILY_REGION_ALIASES = {
  辽宁: ['辽宁', '辽东'],
  河北: ['河北', '唐山'],
};

const dailyRegionNames = (region) => {
  const shortName = region.replace(/(壮族自治区|回族自治区|维吾尔自治区|特别行政区|自治区|省|市)$/, '');
  const aliases = Object.hasOwn(DAILY_REGION_ALIASES, shortName)
    ? DAILY_REGION_ALIASES[shortName] : [shortName];
  return [...new Set([region, ...aliases])].filter(Boolean);
};

/**
 * 2) GET /daily-appreciations/random?region=辽宁 —— 对象
 *
 * 行为（相对小程序源码的增强，源码是全库随机、不区分地区）：
 *   1. 传了 region 且该地区有藏品 -> 只在该地区内随机，regionMatched = true
 *   2. 每日一赏未收录该地区 -> 读取已发布地域档案的启用封面/图库图片
 *   3. 两个来源都没有该地区图片 -> 全库随机，regionMatched = false
 *   4. 未传 region -> 全库随机，regionMatched = true（不触发提示）
 */
export const dailyRandom = async (pool, region = '') => {
  const wanted = String(region || '').trim().slice(0, 20);
  const columns = 'id, title, description, image_url, region, tag, category';

  const shape = (row, matched) => {
    const camel = rowToCamel(row);
    // 页面回落链含 image_url，双写一次做保险
    return { ...camel, image_url: row.image_url ?? null, regionMatched: matched };
  };

  if (wanted) {
    const names = dailyRegionNames(wanted);
    const placeholders = names.map(() => '?').join(', ');
    const hit = await select(
      pool,
      `SELECT ${columns}
         FROM daily_appreciation
        WHERE is_active = 1 AND region IN (${placeholders})
        ORDER BY RAND()
        LIMIT 1`,
      names,
    );
    if (hit.length) return shape(hit[0], true);

    // 地域图不只存于 daily_appreciation；档案图库也有完整的省份与媒体关联。
    const gallery = await select(
      pool,
      `SELECT pm.id AS profile_media_id, p.id AS profile_id, m.id AS media_id,
              pm.caption, m.title AS media_title, m.description AS media_description,
              m.url AS image_url, p.summary, p.feature_styling, p.feature_coloring,
              r.name AS region_name, r.short_name AS region_short_name
         FROM regions r
         JOIN shadow_region_profiles p ON p.region_id = r.id
         JOIN profile_media pm ON pm.profile_id = p.id
         JOIN media_assets m ON m.id = pm.media_id
        WHERE r.status = 1 AND p.status = 'published'
          AND m.status = 1 AND m.media_type = 'image'
          AND pm.usage_type IN ('cover', 'gallery')
          AND TRIM(m.url) <> ''
          AND (r.name IN (${placeholders}) OR r.short_name IN (${placeholders}))
        ORDER BY RAND()
        LIMIT 1`,
      [...names, ...names],
    );
    if (gallery.length) {
      const row = gallery[0];
      const regionName = row.region_short_name || row.region_name;
      const rawUrl = String(row.image_url || '').trim();
      const imageUrl = /^https?:\/\//i.test(rawUrl) || rawUrl.startsWith('/')
        ? rawUrl : `/${rawUrl}`;
      return shape({
        id: `profile-media-${row.profile_media_id}`,
        title: row.caption || row.media_title || `${regionName}皮影`,
        description: row.media_description || row.summary || row.feature_styling || row.feature_coloring || `${regionName}皮影地域档案`,
        image_url: imageUrl,
        region: regionName,
        tag: '地域皮影',
        category: 'region_shadow',
        source: 'region-gallery',
        profile_id: row.profile_id,
        media_id: row.media_id,
      }, true);
    }
  }

  const any = await select(
    pool,
    `SELECT ${columns}
       FROM daily_appreciation
      WHERE is_active = 1
      ORDER BY RAND()
      LIMIT 1`,
  );
  if (!any.length) return {};
  return shape(any[0], !wanted);
};

// 3) GET /quiz/questions/random —— 数组，字段必须逐个 camel（HANDOFF §5.3）
export const quizRandom = async (pool, limit = DEFAULT_QUIZ_LIMIT) => {
  const rows = await select(
    pool,
    `SELECT id, question_text, option_a, option_b, option_c, option_d,
            correct_answer, explanation, category
       FROM quiz_questions
      WHERE is_active = 1
      ORDER BY RAND()
      LIMIT ?`,
    [limit],
  );
  return rows.map((row) => {
    const camel = rowToCamel(row);
    return {
      id: camel.id,
      type: camel.category ?? '',
      questionText: camel.questionText ?? '',
      optionA: camel.optionA ?? '',
      optionB: camel.optionB ?? '',
      optionC: camel.optionC ?? '',
      optionD: camel.optionD ?? '',
      correctAnswer: String(camel.correctAnswer ?? 'A').trim().charAt(0).toUpperCase() || 'A',
      explanation: camel.explanation ?? '',
    };
  });
};

// 4) GET /craft-process/steps —— 数组，stepSort/detailsContent 必须 camel（HANDOFF §5.4）
export const craftSteps = async (pool) => {
  const rows = await select(
    pool,
    `SELECT id, step_sort, title, subtitle, summary, details_content, image_url
       FROM shadow_craft_process
      WHERE is_active = 1
      ORDER BY step_sort ASC`,
  );
  return rows.map((row) => {
    const camel = rowToCamel(row);
    return {
      id: camel.id,
      stepSort: Number(camel.stepSort ?? 0) || 0,
      title: camel.title ?? '',
      subtitle: camel.subtitle ?? '',
      summary: camel.summary ?? '',
      detailsContent: camel.detailsContent ?? '',
      imageUrl: camel.imageUrl ?? null,
    };
  });
};

// 5) GET /history/timeline —— 数组，保留 snake 原样（HANDOFF §5.5）
export const historyTimeline = async (pool) => {
  const rows = await select(
    pool,
    `SELECT id, era_name, era_title, detail_content, time_range, sort_order
       FROM shadow_history_timeline
      WHERE is_active = 1
      ORDER BY sort_order ASC`,
  );
  return rows.map((row) => ({
    id: row.id,
    era_name: row.era_name,
    era_title: row.era_title,
    detail_content: row.detail_content,
    time_range: row.time_range,
    sort_order: row.sort_order,
  }));
};

// 6) GET /regions/by-name?name= —— 对象，两级匹配（HANDOFF §5.6）
export const regionByName = async (pool, rawName) => {
  const name = String(rawName ?? '').trim().slice(0, 50);
  if (!name) return { provinceName: '' };

  const columns = `id, province_name, popular_areas, feature_styling, feature_coloring,
                   feature_singing, representative_plays, image_url`;

  // 第 1 级：精确匹配（入参已带行政后缀时直接命中）
  let rows = await select(
    pool,
    `SELECT ${columns} FROM shadow_region_info WHERE province_name = ? LIMIT 1`,
    [name],
  );

  // 第 2 级：前缀匹配，兼容 '陕西' → '陕西省'、'内蒙古' → '内蒙古自治区'
  if (!rows.length) {
    rows = await select(
      pool,
      `SELECT ${columns} FROM shadow_region_info
        WHERE province_name LIKE CONCAT(?, '%') ESCAPE '\\\\'
        ORDER BY province_name
        LIMIT 1`,
      [escapeLike(name)],
    );
  }

  if (!rows.length) {
    // 必须返回合理的空态对象，不能是 null / 404（HANDOFF §5.6）
    return { provinceName: name };
  }

  const camel = rowToCamel(rows[0]);
  return { ...camel, provinceName: camel.provinceName ?? name };
};

// 7) GET /interactive-materials/random —— 数组，不含 x/y/size（HANDOFF §5.7）
export const interactiveRandom = async (pool, limit = DEFAULT_PUPPET_LIMIT) => {
  const rows = await select(
    pool,
    `SELECT id, name, image_url, category, description
       FROM interactive_characters
      WHERE is_active = 1
      ORDER BY RAND()
      LIMIT ?`,
    [limit],
  );
  return rows.map((row) => {
    const camel = rowToCamel(row);
    return {
      id: camel.id,
      name: camel.name ?? '',
      imageUrl: camel.imageUrl ?? null,
      image_url: camel.imageUrl ?? null,
      category: camel.category ?? '',
      description: camel.description ?? '',
    };
  });
};

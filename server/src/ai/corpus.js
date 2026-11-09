/**
 * 实现功能：RAG 语料抽取（只读）
 * 职责：从 legacy 库抽取非遗结构化文本，切成带 metadata 的 chunk，供检索与 grounded 生成。
 *       只走 db.js 的 select（SELECT 纪律），不做任何写操作。
 * 接口/函数清单：
 *   - loadCorpus(pool)：返回 chunk 数组 {id, topic, region, title, text, route}
 */
import { select } from '../db.js';

const join = (...parts) => parts.filter((p) => p && String(p).trim()).join('\n');

export const loadCorpus = async (pool) => {
  const chunks = [];

  const craft = await select(
    pool,
    'SELECT id, step_sort, title, subtitle, summary, details_content FROM shadow_craft_process WHERE is_active = 1 ORDER BY step_sort',
  );
  for (const row of craft) {
    chunks.push({
      id: `craft-${row.id}`,
      topic: '工艺',
      region: '',
      title: row.title,
      text: join(row.title, row.subtitle, row.summary, row.details_content),
      route: { path: '/process', query: {} },
    });
  }

  const history = await select(
    pool,
    'SELECT id, era_name, era_title, time_range, detail_content FROM shadow_history_timeline WHERE is_active = 1 ORDER BY sort_order',
  );
  for (const row of history) {
    chunks.push({
      id: `history-${row.id}`,
      topic: '历史',
      region: '',
      title: `${row.era_name}·${row.era_title}`,
      text: join(row.era_name, row.time_range, row.era_title, row.detail_content),
      route: { path: '/history', query: {} },
    });
  }

  const profiles = await select(
    pool,
    `SELECT p.id, p.title, p.popular_areas, p.feature_styling, p.feature_coloring,
            p.feature_singing, p.representative_plays, p.summary, p.detail_content,
            p.heritage_level, r.short_name AS region, s.name AS school
     FROM shadow_region_profiles p
     JOIN regions r ON r.id = p.region_id
     JOIN shadow_schools s ON s.id = p.school_id
     WHERE p.status = 'published'
     ORDER BY p.sort_order`,
  );
  for (const row of profiles) {
    chunks.push({
      id: `region-${row.id}`,
      topic: '地域',
      region: row.region || '',
      title: row.title || `${row.region}皮影`,
      text: join(
        row.title,
        `流行地区：${row.popular_areas}`,
        `造型：${row.feature_styling}`,
        `色彩：${row.feature_coloring}`,
        `唱腔：${row.feature_singing}`,
        `代表剧目：${row.representative_plays}`,
        row.heritage_level ? `非遗级别：${row.heritage_level}` : '',
        row.summary,
        row.detail_content,
      ),
      route: { path: '/display', query: { region: row.region } },
    });
  }

  return chunks.filter((c) => c.text && c.text.trim().length > 0);
};
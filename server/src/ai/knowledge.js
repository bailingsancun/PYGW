/**
 * 实现功能：Agent 的结构化知识快照（只读）
 * 职责：一次性从 legacy 库抽取「地区流派 / 制作工序 / 历史时间线」的结构化字段，
 *       作为 Agent 工具（get_region_profile/get_craft_process/get_history_timeline/list_regions）
 *       的权威事实来源；与 RAG 语料同源，保证工具观测与检索材料一致。
 *       只走 db.js 的 select（SELECT 纪律），不做任何写操作。
 * 接口/函数清单：
 *   - loadKnowledge(pool)：返回 {regions, craft, history}
 */
import { select } from '../db.js';

export const loadKnowledge = async (pool) => {
  const craftRows = await select(
    pool,
    'SELECT id, step_sort, title, subtitle, summary, details_content FROM shadow_craft_process WHERE is_active = 1 ORDER BY step_sort',
  );
  const historyRows = await select(
    pool,
    'SELECT id, era_name, era_title, time_range, detail_content FROM shadow_history_timeline WHERE is_active = 1 ORDER BY sort_order',
  );
  const profileRows = await select(
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

  const craft = craftRows.map((row) => ({
    id: row.id,
    stepSort: Number(row.step_sort) || 0,
    title: row.title || '',
    subtitle: row.subtitle || '',
    summary: row.summary || '',
    details: row.details_content || '',
  }));

  const history = historyRows.map((row) => ({
    id: row.id,
    eraName: row.era_name || '',
    eraTitle: row.era_title || '',
    timeRange: row.time_range || '',
    detail: row.detail_content || '',
  }));

  const regions = profileRows.map((row) => ({
    id: row.id,
    region: row.region || '',
    school: row.school || '',
    title: row.title || `${row.region || ''}皮影`,
    popularAreas: row.popular_areas || '',
    styling: row.feature_styling || '',
    coloring: row.feature_coloring || '',
    singing: row.feature_singing || '',
    plays: row.representative_plays || '',
    heritageLevel: row.heritage_level || '',
    summary: row.summary || '',
    detail: row.detail_content || '',
  }));

  return { regions, craft, history };
};

/** Agent 工具在 knowledge 缺失时的安全默认值（离线自检 / 建库失败不阻断服务） */
export const EMPTY_KNOWLEDGE = { regions: [], craft: [], history: [] };

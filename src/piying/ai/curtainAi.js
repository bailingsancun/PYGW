/**
 * 实现功能：AI 图片转皮影的浏览器端流程编排
 * 职责：1) 预处理用户照片（缩放 + 主色采样）；
 *       2) 调 /api/ai/piying 让服务端按 piying-pipeline 的提示词约束做人物门禁与图像生成；
 *       3) 拿到「洋红底零件图」后在前端做抠图分割，并把零件贴到标准骨架槽位上；
 *       4) 没有图像生成模型 / 生成失败 / 分割不出足够部件时，回落到本地皮影合成器（procedural.js）；
 *       5) 最终产出与内置角色同构的 record：{ id, title, kind, manifest, notes }，可直接注册进角色库。
 * 两种模式：fast = 单张零件图 + 直接装配；refined = 多一张定妆图、甲纹更细、部件匹配更严格。
 */
import { unwrapResponse } from '@/api/index.js';
import { prepareImagePayload } from './palette.js';
import { segmentPartsSheet, fitPartToSlot } from './chroma.js';
import { buildProceduralCharacter } from './procedural.js';
import { normalizeCharacterId } from '../hub/characters.js';

const AI_ENDPOINT = '/api/ai/piying';
/** 服务端 refined 模式最长约 300s（门禁 + 两次 120s 生成），客户端留 30s 余量 */
const REQUEST_TIMEOUT_MS = 330000;

/** 标准骨架的槽位：按宽高比把 AI 零件图对号入座 */
const SLOTS = [
  { key: 'torso', aspect: 0.7 },
  { key: 'skirt', aspect: 1.45 },
  { key: 'head', aspect: 0.75 },
  { key: 'cape', aspect: 0.7 },
  { key: 'thigh', aspect: 0.52 },
  { key: 'lowerleg', aspect: 0.66 },
  { key: 'upperarm', aspect: 0.32 },
  { key: 'forearm', aspect: 0.32 },
  { key: 'hand', aspect: 0.55 },
];

/** 宽高比相差 2.4 倍以内才认为「像同一类部件」 */
const ASPECT_GATE = Math.log(2.4);

const assignSlots = (parts = []) => {
  if (parts.some((part) => part.key)) {
    return Object.fromEntries(parts.filter((part) => SLOTS.some((slot) => slot.key === part.key)).map((part) => [part.key, part]));
  }
  const sorted = [...parts].sort((a, b) => b.area - a.area);
  const used = new Set();
  const assigned = {};
  for (const slot of SLOTS) {
    let best = null;
    let bestScore = Infinity;
    for (const part of sorted) {
      if (used.has(part)) continue;
      const aspect = part.aspect || part.width / part.height || 1;
      const score = Math.abs(Math.log(Math.max(0.05, aspect) / slot.aspect));
      if (score < bestScore) {
        bestScore = score;
        best = part;
      }
    }
    if (best && bestScore <= ASPECT_GATE) {
      used.add(best);
      assigned[slot.key] = best;
    }
  }
  return assigned;
};

const requestServer = async ({ image, mode, features, signal }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ image, mode, features }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn(`[piying] AI 服务错误 HTTP ${response.status}: ${text.slice(0, 300)}`);
      throw new Error(`AI 服务返回 HTTP ${response.status}`);
    }
    return unwrapResponse(await response.json());
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(signal?.aborted ? '生成已取消' : 'AI 服务响应超时，请稍后再试');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
};

/**
 * 生成一个 AI 皮影角色。
 * @param {{file:File, mode:'fast'|'refined', title?:string, onProgress?:(stage:string, text:string)=>void, signal?:AbortSignal}} options
 */
export async function generateAiCharacter({ file, mode = 'fast', title, onProgress = () => {}, signal }) {
  onProgress('preprocess', '正在读取照片并提取配色…');
  const payload = await prepareImagePayload(file);
  const refined = mode === 'refined';
  const characterTitle = String(title || '').trim().slice(0, 16) || 'AI 皮影';

  const features = {
    palette: payload.palette,
    headwear: '',
    facialHair: '',
    costume: '',
    motifs: '',
    weapon: 'a long straight sword',
  };

  let server = null;
  let serverError = '';
  onProgress('request', refined ? '正在请求精致模式生成（定妆图 + 零件图）…' : '正在请求快速模式生成（零件图）…');
  try {
    server = await requestServer({ image: payload.dataUrl, mode, features, signal });
  } catch (error) {
    serverError = error?.message || String(error);
    console.warn('[piying] AI 服务不可用，改用本地合成器', serverError);
  }

  if (server?.refusal) {
    const error = new Error(server.reason || '图片里没有可辨认的完整人物，无法制作皮影形象。');
    error.code = 'PIYING_REFUSED';
    throw error;
  }

  if (server?.features?.palette?.length) features.palette = server.features.palette;
  for (const key of ['headwear', 'facialHair', 'costume', 'motifs']) {
    if (server?.features?.[key]) features[key] = server.features[key];
  }

  // 先用本地合成器把「骨架 + 兜底部件」准备好，AI 部件再逐个覆盖上去
  const base = buildProceduralCharacter({ title: characterTitle, palette: features.palette, features, mode });
  const meta = {
    provider: server?.provider || 'procedural',
    mode,
    prompt: server?.prompt || null,
    gate: server?.gate || null,
    message: server?.message || serverError || '未配置图像生成模型，本次由本地皮影合成器生成',
    partsSheet: null,
    generatedParts: [],
    localParts: SLOTS.map((slot) => slot.key),
    puppet: null,
  };

  const partsImage = server?.images?.find((item) => item.kind === 'parts');
  const puppetImage = server?.images?.find((item) => item.kind === 'puppet');
  if (puppetImage) meta.puppet = puppetImage.dataUrl;

  if (partsImage?.dataUrl) {
    onProgress('segment', '正在把零件图拆成透明部件…');
    try {
      const sheet = await segmentPartsSheet(partsImage.dataUrl, {
        layout: server?.partsLayout,
        maxParts: refined ? 18 : 14,
        minAreaRatio: refined ? 0.001 : 0.0016,
      });
      meta.partsSheet = { width: sheet.width, height: sheet.height, count: sheet.parts.length };
      const assigned = assignSlots(sheet.parts);
      const keys = Object.keys(assigned);
      // 少量漏画不应丢掉所有已生成部件；主体缺失时仍整体回退。
      const gridLayout = server?.partsLayout === 'grid-3x3-v1';
      const required = gridLayout ? 6 : 3;
      const hasBody = !gridLayout || (assigned.head && assigned.torso && assigned.skirt);
      if (keys.length >= required && hasBody) {
        onProgress('assemble', `已识别 ${keys.length} 个部件，正在装配到关节骨架…`);
        for (const key of keys) {
          const target = base.parts[key];
          if (!target) continue;
          const [width, height] = target.size;
          base.manifest.parts[key].src = await fitPartToSlot(assigned[key].dataUrl, width, height, { fill: server?.partsLayout === 'grid-3x3-v1' });
        }
        meta.generatedParts = keys;
        meta.localParts = SLOTS.map((slot) => slot.key).filter((key) => !keys.includes(key));
        meta.message = keys.length === SLOTS.length
          ? `已使用图像生成结果，${keys.length} 个部件全部装配完成`
          : `已采用 ${keys.length} 个 AI 部件，${meta.localParts.length} 个部件由本地合成器补齐`;
      } else {
        meta.provider = 'procedural';
        meta.message = `零件图缺少主体或可用部件不足 ${required} 个，已整体改用本地皮影合成器`;
      }
    } catch (error) {
      console.warn('[piying] 零件图分割失败，回落本地合成', error);
      meta.provider = 'procedural';
      meta.message = `零件图分割失败（${error?.message || error}），已改用本地皮影合成器`;
    }
  }

  onProgress('done', '皮影形象已生成');

  const id = `ai_${normalizeCharacterId(characterTitle)}_${Date.now().toString(36)}`;
  // 用户起名里已经带「AI」时不再叠加后缀，避免出现「AI 皮影（AI）」
  const suffix = /AI|ai|人工智能/.test(characterTitle) ? '' : '（AI）';
  const displayTitle = `${characterTitle}${suffix}`;
  base.manifest.name = id;
  base.manifest.title = displayTitle;
  base.manifest.description = `${refined ? '精致' : '快速'}模式生成 · ${meta.provider === 'image' ? '图像生成模型' : '本地皮影合成器'}`;

  return {
    id,
    title: displayTitle,
    kind: 'ai',
    manifest: base.manifest,
    notes: `${base.notes} · 模式 ${refined ? '精致' : '快速'} · ${meta.message}`,
    meta,
  };
}

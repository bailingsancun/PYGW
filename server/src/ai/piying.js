/**
 * 实现功能：AI 图片转皮影（身入影幕 · 幕后「AI图片转皮影」入口的服务端）
 * 职责：按 .qoder/skills/piying-pipeline 里的提示词约束，把用户上传的人物图转成皮影角色：
 *   1) 输入门禁：若能调用多模态模型，先判断「是不是完整人物（头 + 躯干 + ≥2 肢）」，
 *      不合格直接拒绝并给出缺失部位（对应 SKILL.md 的 refusal policy）；
 *   2) 特征提取：同一次视觉调用顺带提取头饰 / 髯口 / 服饰 / 纹样 / 主色，供后续生成或本地合成；
 *   3) 图像生成：配置了图像生成模型时，fast 模式只出「洋红底零件图」一张，
 *      refined 模式先出完整皮影定妆图、再出零件图（对应 SKILL 的 fast / refined）；
 *   4) 未配置图像生成模型时返回 provider=procedural，由前端用本地「皮影合成器」产出可装配的皮影文件。
 * 提示词模板来自 .qoder/skills/piying-pipeline/references/prompts.md（保持一字不改的约束），
 * 变量由服务端白名单字段填充，不接受任意用户文本进入提示词。
 */
import { streamCompletion } from './provider.js';
import { checkInput } from './moderation.js';
import dns from 'node:dns/promises';
import net from 'node:net';

export const PIYING_MODES = ['fast', 'refined'];

const MAX_FEATURE = 32;
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 30000;

/** 私网 / 保留地址判定（IPv4 与 IPv6，含 v4-mapped），用于拦截生成图 URL 的 SSRF */
const isPrivateAddress = (ip) => {
  if (net.isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (/^f[cd]/.test(lower) || /^fe[89ab]/.test(lower)) return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  return false;
};

/** 按文件头判定图片类型，不信任上游 content-type */
const imageResponseMime = (buffer) => {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return 'image/png';
};

/**
 * 下载上游返回的生成图 URL。上游响应不可信：
 * 仅允许 https、解析后拒绝私网/保留地址、禁止跳转（防重定向绕过）、限时限量。
 */
const downloadGeneratedImage = async (rawUrl, outerSignal) => {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    throw new Error('生成图 URL 非法');
  }
  if (url.protocol !== 'https:') throw new Error('生成图 URL 仅允许 https');
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
    throw new Error('生成图 URL 指向内网或保留地址，已拒绝');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  outerSignal?.addEventListener('abort', onOuterAbort, { once: true });
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new Error(`下载生成图失败 HTTP ${response.status}`);
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_DOWNLOAD_BYTES) {
        await reader.cancel();
        throw new Error('生成图体积超过 20MB 上限');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('下载生成图超时（30s）');
    throw error;
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener('abort', onOuterAbort);
  }
};

/** 提示词里允许注入的特征字段（全部截断；不接受自由文本） */
export const normalizeFeatures = (input = {}) => {
  const clean = (value) => {
    const text = String(value || '').trim().slice(0, MAX_FEATURE);
    if (!text) return '';
    return checkInput(text).ok ? text : '';
  };
  const palette = Array.isArray(input.palette)
    ? input.palette
        .map((color) => String(color || '').trim())
        .filter((color) => /^#[0-9a-f]{3,8}$/i.test(color))
        .slice(0, 6)
    : [];
  return {
    headwear: clean(input.headwear) || 'traditional headdress matching the reference',
    facialHair: clean(input.facialHair) || 'long stylized beard matching the reference',
    costume: clean(input.costume) || 'official robe with openwork armor plates',
    motifs: clean(input.motifs) || 'cloud and dragon openwork patterns',
    weapon: clean(input.weapon) || 'a long straight sword',
    palette,
    notes: clean(input.notes),
  };
};

const paletteHint = (features) =>
  features.palette.length ? `Use this palette: ${features.palette.join(', ')}.` : '';

/** SKILL.md #puppet 模板（一字不改的约束，只替换 <...> 变量） */
export const buildPuppetPrompt = (features) => `Traditional Chinese shadow puppet (皮影戏) figure of the person in the reference photo,
full body in strict side profile facing left, standing pose.
Preserve the reference's identifying features: ${features.headwear}, ${features.facialHair}, ${features.costume}, ${features.motifs}.
Render as carved translucent dyed leather: openwork (镂空) cut-out patterns, fine incised line work,
flat saturated mineral colors (vermilion, indigo, malachite, gold), thin dark outline, slight leather translucency.
Design the missing lower body as boots/leggings/skirt decorated to match the same motifs and palette.
Plain solid light background, no shadow, no props except ${features.weapon}. Single centered figure, whole body visible.
${paletteHint(features)}`;

/** SKILL.md #parts 模板 */
export const buildPartsPrompt = (features) => `The exact same shadow-puppet character as the reference image, same colors, same openwork carving style,
but DECOMPOSED into separate disconnected body parts laid out on a PURE MAGENTA (#FF00FF) background.
Parts, each isolated with wide empty magenta gaps between them, all in the same side-profile orientation and scale:
head; torso; skirt/lower robe; cape; upper arm; forearm; hand; thigh; lower leg + boot; ${features.weapon}.
Limbs drawn as straight vertical segments (joint ends flat) so they can be re-articulated.
Do not overlap parts. Do not add labels, borders, or shadows. Background must be uniform #FF00FF everywhere else.
${paletteHint(features)}`;

/** 图像生成是否可用（独立于文本模型的配置） */
export const imageReady = (config) =>
  Boolean(config.PIYING_IMAGE_BASE_URL && config.PIYING_IMAGE_API_KEY && config.PIYING_IMAGE_MODEL);

/** 文本 / 视觉模型是否可用 */
export const visionReady = (config) =>
  Boolean(config.AI_BASE_URL && config.AI_API_KEY && config.AI_MODEL && config.AI_FORMAT === 'chat');

const FIGURE_CHECK_SYSTEM = `你是皮影戏的人物图审核员。只输出一行 JSON，不要解释。
格式：{"figure":true|false,"reason":"中文原因","headwear":"","facialHair":"","costume":"","motifs":"","palette":["#RRGGBB"]}
判定标准：画面中必须有可辨认的人物（照片 / 插画 / 成品皮影均可），且能看出 头部 + 躯干 + 至少两个肢体。
若是纯物体、风景、文字、抽象图形，或只有头部、严重遮挡、轮廓不可辨认，则 figure=false，并在 reason 里指出缺哪些部位。
feature 字段用中文短语各不超过 16 字，描述该人物的头饰、髯口、服饰、纹样；palette 给 3-5 个主色。`;

const parseJsonLoose = (text) => {
  const raw = String(text || '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
};

/**
 * 输入门禁 + 特征提取（同一次多模态调用）。
 * 未配置视觉模型时返回 { checked:false }，由前端提示「无法自动校验人物」。
 */
export const checkFigure = async (config, { image }) => {
  if (!visionReady(config)) return { checked: false, pass: true, reason: '', features: null };
  try {
    const messages = [
      { role: 'system', content: FIGURE_CHECK_SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请审核这张图片能否做成皮影人物，并按格式输出 JSON。' },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ];
    const text = await streamCompletion(config, messages, () => {}, { maxTokens: 400, timeoutMs: 30000 });
    const data = parseJsonLoose(text);
    if (!data) return { checked: false, pass: true, reason: '模型未返回可解析的审核结果', features: null };
    const pass = data.figure !== false;
    return {
      checked: true,
      pass,
      reason: String(data.reason || '').slice(0, 120),
      features: pass
        ? normalizeFeatures({
            headwear: data.headwear,
            facialHair: data.facialHair,
            costume: data.costume,
            motifs: data.motifs,
            palette: data.palette,
          })
        : null,
    };
  } catch (error) {
    console.warn(`[piying] 视觉门禁失败，放行并交给本地合成：${error.message}`);
    return { checked: false, pass: true, reason: `视觉审核不可用：${error.message}`, features: null };
  }
};

/**
 * 调用 OpenAI 兼容的图像生成接口（/images/generations）。
 * 返回 dataURL；不支持 b64 时回落下载 url 再转 dataURL。
 */
export const generateImage = async (config, prompt, { size } = {}) => {
  const base = String(config.PIYING_IMAGE_BASE_URL || '').replace(/\/+$/, '');
  const url = `${base}/images/generations`;
  const body = {
    model: config.PIYING_IMAGE_MODEL,
    prompt,
    n: 1,
    size: size || config.PIYING_IMAGE_SIZE || '1024x1024',
    response_format: 'b64_json',
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.PIYING_IMAGE_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const snippet = (await response.text().catch(() => '')).slice(0, 300);
      throw new Error(`图像生成 HTTP ${response.status}: ${snippet}`);
    }
    const data = await response.json();
    const item = data?.data?.[0];
    if (!item) throw new Error('图像生成未返回图片');
    if (item.b64_json) {
      return `data:image/png;base64,${item.b64_json}`;
    }
    if (item.url) {
      const buffer = await downloadGeneratedImage(item.url, controller.signal);
      const mime = imageResponseMime(buffer);
      return `data:${mime};base64,${buffer.toString('base64')}`;
    }
    throw new Error('图像生成返回既无 b64_json 也无 url');
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('图像生成超时（120s）');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * 主流程。
 * @param {object} config
 * @param {{image:string, mode?:'fast'|'refined', features?:object}} input
 */
export const generatePiying = async (config, input = {}) => {
  const mode = PIYING_MODES.includes(input.mode) ? input.mode : 'fast';
  const features = normalizeFeatures(input.features || {});
  const prompt = {
    puppet: buildPuppetPrompt(features),
    parts: buildPartsPrompt(features),
  };

  const gate = await checkFigure(config, { image: input.image });
  const mergedFeatures = normalizeFeatures({ ...(gate.features || {}), ...(input.features || {}) });

  if (gate.checked && !gate.pass) {
    return {
      ok: false,
      refusal: true,
      reason: gate.reason || '图片里没有可辨认的完整人物，无法制作皮影形象。',
      mode,
      prompt,
      features: mergedFeatures,
      gate,
    };
  }

  const result = {
    ok: true,
    mode,
    prompt: {
      puppet: buildPuppetPrompt(mergedFeatures),
      parts: buildPartsPrompt(mergedFeatures),
    },
    features: mergedFeatures,
    gate,
    provider: 'procedural',
    images: [],
    message: '',
  };

  if (!imageReady(config)) {
    result.message =
      '未配置图像生成模型（PIYING_IMAGE_BASE_URL / PIYING_IMAGE_API_KEY / PIYING_IMAGE_MODEL），本次由本地皮影合成器生成。';
    return result;
  }

  try {
    if (mode === 'refined') {
      // 精致模式：先出定妆图，再出零件图（两次生成，对应 SKILL 的两步）
      const puppet = await generateImage(config, result.prompt.puppet, { size: config.PIYING_IMAGE_SIZE || '1024x1024' });
      result.images.push({ kind: 'puppet', dataUrl: puppet });
    }
    const parts = await generateImage(config, result.prompt.parts, {
      size: mode === 'refined' ? '1536x1536' : config.PIYING_IMAGE_SIZE || '1024x1024',
    });
    result.images.push({ kind: 'parts', dataUrl: parts });
    result.provider = 'image';
    result.message = `已调用图像生成模型（${config.PIYING_IMAGE_MODEL}）生成零件图，${mode === 'refined' ? '含定妆图' : '快速模式单张'}。`;
    return result;
  } catch (error) {
    console.error(`[piying] 图像生成失败，回落本地合成：${error.message}`);
    result.images = [];
    result.provider = 'procedural';
    result.message = `图像生成失败（${error.message}），已改用本地皮影合成器。`;
    return result;
  }
};

/**
 * 实现功能：shim 的环境变量加载
 * 职责：优先读进程环境变量，其次读 <DST>/.env.local 与 <DST>/.env；
 *       口令只存在于这三个位置，绝不写入源码、日志或前端构建产物。
 * 接口/函数清单：
 *   - loadEnv()：返回归一化后的配置对象，缺关键变量时抛出可读错误
 *   - describeMissing(names)：生成明确的缺变量提示
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
// server/src -> server -> <DST>
export const PROJECT_ROOT = path.resolve(here, '..', '..');

/** 解析 KEY=VALUE 形式的 env 文件，忽略注释、空行与首尾引号 */
const parseEnvFile = (text) => {
  const out = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const index = line.indexOf('=');
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
};

const readEnvFiles = () => {
  const merged = {};
  // .env 先读，.env.local 覆盖它（与常见约定一致）
  for (const name of ['.env', '.env.local']) {
    const file = path.join(PROJECT_ROOT, name);
    try {
      if (!fs.existsSync(file)) continue;
      Object.assign(merged, parseEnvFile(fs.readFileSync(file, 'utf8')));
    } catch (error) {
      throw new Error(`读取 ${name} 失败：${error.message}`);
    }
  }
  return merged;
};

const describeMissing = (names) =>
  [
    `缺少数据库配置：${names.join(', ')}`,
    `请在 ${path.join(PROJECT_ROOT, '.env.local')} 中填写（可从 .env.example 复制），`,
    '或通过进程环境变量注入。参考：',
    '  DB_HOST=127.0.0.1',
    '  DB_PORT=3306',
    '  DB_USER=deepseek',
    '  DB_PASSWORD=<你的口令>',
    '  DB_NAME=deepseek',
  ].join('\n');

/**
 * 读取配置。
 * @param {{ requireDb?: boolean }} options
 *   requireDb=false 时不校验 DB_*（静态服务器只需要 SHIM_PORT / ASSET_ROOT）。
 */
export const loadEnv = ({ requireDb = true } = {}) => {
  const fileEnv = readEnvFiles();
  const pick = (key, fallback = '') => {
    const fromProcess = process.env[key];
    if (fromProcess !== undefined && String(fromProcess).trim() !== '') return String(fromProcess).trim();
    const fromFile = fileEnv[key];
    if (fromFile !== undefined && String(fromFile).trim() !== '') return String(fromFile).trim();
    return fallback;
  };

  const config = {
    DB_HOST: pick('DB_HOST'),
    DB_PORT: pick('DB_PORT', '3306'),
    DB_USER: pick('DB_USER'),
    DB_PASSWORD: pick('DB_PASSWORD'),
    DB_NAME: pick('DB_NAME'),
    SHIM_HOST: pick('SHIM_HOST', '127.0.0.1'),
    SHIM_PORT: pick('SHIM_PORT', '8787'),
    SHIM_CORS: pick('SHIM_CORS', '0'),
    // 素材根（可选）：留空时由 resolveAssetRoot 回落到工程内 assets/images
    ASSET_ROOT: pick('ASSET_ROOT'),
    // --- AI 讲解员 / RAG（provider 无关，可选；缺失时 AI 服务走静态兜底）---
    AI_BASE_URL: pick('AI_BASE_URL'),
    AI_API_KEY: pick('AI_API_KEY'),
    AI_FORMAT: pick('AI_FORMAT', 'chat'),
    AI_MODEL: pick('AI_MODEL'),
    AI_HOST: pick('AI_HOST', '127.0.0.1'),
    AI_PORT: pick('AI_PORT', '8788'),
    // Agent 工具规划最大轮数（仅 chat 协议走模型 Function Calling，其余走规则规划）
    AI_AGENT_MAX_STEPS: pick('AI_AGENT_MAX_STEPS', '3'),
    // 限流：每分钟每 IP 的 LLM 请求上限（0=关闭；默认 20），作用于 /ask /narrate /agent /vision /quiz
    AI_RATE_LIMIT: pick('AI_RATE_LIMIT', '20'),
    // 全局每日 LLM 请求总额度（0=关闭；默认 1000），跨所有 IP 的熔断，防止分布式刷量耗尽配额
    AI_GLOBAL_DAILY_LIMIT: pick('AI_GLOBAL_DAILY_LIMIT', '1000'),
    // 限流来源 IP：0=用 socket IP（默认，防 X-Forwarded-For 伪造）；
    // 仅部署在可信反代后（如本工程 static-server，会把 XFF 覆写为真实 socket IP）才设 1
    AI_TRUST_PROXY: pick('AI_TRUST_PROXY', '0'),
    // 跨源白名单（逗号分隔；同源部署/Vite 代理无需配置，默认不放行跨源）
    AI_ALLOWED_ORIGINS: pick('AI_ALLOWED_ORIGINS'),
    // 可选 embedding（不填则检索退化为关键词+metadata）
    AI_EMBEDDING_BASE_URL: pick('AI_EMBEDDING_BASE_URL'),
    AI_EMBEDDING_API_KEY: pick('AI_EMBEDDING_API_KEY'),
    AI_EMBEDDING_MODEL: pick('AI_EMBEDDING_MODEL'),
  };

  const allowedFormats = ['chat', 'message', 'response'];
  config.AI_FORMAT = String(config.AI_FORMAT || 'chat').trim().toLowerCase();
  if (!allowedFormats.includes(config.AI_FORMAT)) {
    throw new Error(`AI_FORMAT 非法：${config.AI_FORMAT}（可选 ${allowedFormats.join('/')}）`);
  }

  const missing = requireDb
    ? ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter((key) => !config[key])
    : [];
  if (missing.length) throw new Error(describeMissing(missing));

  const port = Number(config.DB_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`DB_PORT 非法：${config.DB_PORT}`);
  }
  config.DB_PORT = port;

  const shimPort = Number(config.SHIM_PORT);
  if (!Number.isInteger(shimPort) || shimPort <= 0 || shimPort > 65535) {
    throw new Error(`SHIM_PORT 非法：${config.SHIM_PORT}`);
  }
  config.SHIM_PORT = shimPort;

  const aiPort = Number(config.AI_PORT);
  if (!Number.isInteger(aiPort) || aiPort <= 0 || aiPort > 65535) {
    throw new Error(`AI_PORT 非法：${config.AI_PORT}`);
  }
  config.AI_PORT = aiPort;

  const agentSteps = Number(config.AI_AGENT_MAX_STEPS);
  if (!Number.isInteger(agentSteps) || agentSteps < 1 || agentSteps > 8) {
    throw new Error(`AI_AGENT_MAX_STEPS 非法：${config.AI_AGENT_MAX_STEPS}（1-8 的整数）`);
  }
  config.AI_AGENT_MAX_STEPS = agentSteps;

  const rateLimit = Number(config.AI_RATE_LIMIT);
  if (!Number.isInteger(rateLimit) || rateLimit < 0) {
    throw new Error(`AI_RATE_LIMIT 非法：${config.AI_RATE_LIMIT}（0 或正整数）`);
  }
  config.AI_RATE_LIMIT = rateLimit;

  const dailyLimit = Number(config.AI_GLOBAL_DAILY_LIMIT);
  if (!Number.isInteger(dailyLimit) || dailyLimit < 0) {
    throw new Error(`AI_GLOBAL_DAILY_LIMIT 非法：${config.AI_GLOBAL_DAILY_LIMIT}（0 或正整数）`);
  }
  config.AI_GLOBAL_DAILY_LIMIT = dailyLimit;

  if (!['0', '1'].includes(config.AI_TRUST_PROXY)) {
    throw new Error(`AI_TRUST_PROXY 非法：${config.AI_TRUST_PROXY}（0 或 1）`);
  }

  return config;
};

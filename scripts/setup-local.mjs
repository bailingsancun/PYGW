/**
 * 实现功能：首次启动交互式配置（由 启动本地演示.bat / npm run setup 调用）
 * 职责：先收集 DB_PASSWORD，再收集 AI base_url/api_key/格式/可选模型/可选 embedding；
 *       只询问缺失项（已有配置直接复用），结果写回 .env.local（gitignored），密钥不进仓库。
 *       --reconfig 强制重新询问全部项。
 * 接口/函数清单：
 *   - main()：交互 → 校验探针 → 写 .env.local
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { listModels, probe, FORMATS } from '../server/src/ai/provider.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_LOCAL = path.join(root, '.env.local');
const ENV_EXAMPLE = path.join(root, '.env.example');

const parseEnv = (text) => {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
};

const setKey = (text, key, value) => {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) return text.replace(re, line);
  return `${text.replace(/\s*$/, '')}\n${line}\n`;
};

const main = async () => {
  const reconfig = process.argv.includes('--reconfig');
  const hasLocal = fs.existsSync(ENV_LOCAL);
  const baseText = hasLocal ? fs.readFileSync(ENV_LOCAL, 'utf8') : fs.readFileSync(ENV_EXAMPLE, 'utf8');
  const current = parseEnv(baseText);
  const need = (key) => (reconfig ? '' : (current[key] || ''));

  // 行队列：从创建起就缓存所有 'line'，避免管道/粘贴输入一次性到达时丢行；
  // EOF 时拒绝挂起的询问，让 main 优雅退出而非静默挂起。
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const queue = [];
  const waiters = [];
  let closed = false;
  rl.on('line', (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(line);
    else queue.push(line);
  });
  rl.on('close', () => {
    closed = true;
    for (const waiter of waiters.splice(0)) waiter.reject(new Error('输入已结束（EOF）'));
  });
  const ask = (q) => new Promise((resolve, reject) => {
    rl.setPrompt(q);
    rl.prompt();
    if (queue.length) return resolve(queue.shift());
    if (closed) return reject(new Error('输入已结束（EOF）'));
    waiters.push({ resolve, reject });
  });
  // 可选项：EOF/无输入视为留空跳过，而非致命错误（必填项仍用 ask）。
  const askOptional = async (q) => {
    try {
      return await ask(q);
    } catch {
      return '';
    }
  };
  const changes = {};

  console.log('=== Cloud-Shadow 本地配置（缺失项才会询问，已有配置自动复用）===');

  // 1) DB_PASSWORD 优先
  let dbPassword = need('DB_PASSWORD');
  if (!dbPassword) {
    while (!dbPassword) {
      dbPassword = (await ask('MySQL DB_PASSWORD（必填）: ')).trim();
    }
    changes.DB_PASSWORD = dbPassword;
  }

  // 2) AI 配置（base_url 留空则跳过 AI）
  let baseUrl = need('AI_BASE_URL');
  if (!baseUrl) {
    baseUrl = (await askOptional('AI base_url（含版本前缀，如 https://api.deepseek.com/v1；留空跳过 AI）: ')).trim();
    if (baseUrl) changes.AI_BASE_URL = baseUrl;
  }
  if (baseUrl) {
    let apiKey = need('AI_API_KEY');
    if (!apiKey) {
      while (!apiKey) apiKey = (await ask('AI api_key（必填）: ')).trim();
      changes.AI_API_KEY = apiKey;
    }
    let format = need('AI_FORMAT');
    if (!format) {
      const raw = (await askOptional(`AI 协议格式 ${FORMATS.join('/')}（回车默认 chat）: `)).trim().toLowerCase();
      format = FORMATS.includes(raw) ? raw : 'chat';
      changes.AI_FORMAT = format;
    }
    let model = need('AI_MODEL');
    if (!model) {
      const cfg = { AI_BASE_URL: baseUrl, AI_API_KEY: apiKey, AI_FORMAT: format };
      const models = await listModels(cfg);
      if (models.length) {
        console.log('可用模型：');
        models.slice(0, 20).forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
        const pickRaw = (await askOptional('选择序号或输入模型名（回车=第 1 个）: ')).trim();
        const idx = Number(pickRaw);
        model = Number.isInteger(idx) && idx >= 1 && idx <= models.length ? models[idx - 1] : (pickRaw || models[0]);
      } else {
        model = (await askOptional('模型名（如 deepseek-chat；留空则 AI 暂不启用）: ')).trim();
      }
      if (model) changes.AI_MODEL = model;
    }

    // 3) 可选 embedding
    let embBase = need('AI_EMBEDDING_BASE_URL');
    if (!embBase) {
      embBase = (await askOptional('embedding base_url（留空跳过=关键词检索）: ')).trim();
      if (embBase) changes.AI_EMBEDDING_BASE_URL = embBase;
    }
    if (embBase) {
      let embModel = need('AI_EMBEDDING_MODEL');
      if (!embModel) {
        embModel = (await askOptional('embedding 模型名（必填）: ')).trim();
        if (embModel) changes.AI_EMBEDDING_MODEL = embModel;
      }
      let embKey = need('AI_EMBEDDING_API_KEY');
      if (!embKey) {
        embKey = (await askOptional('embedding api_key（留空=无鉴权）: ')).trim();
        if (embKey) changes.AI_EMBEDDING_API_KEY = embKey;
      }
    }

    // 4) 探针校验（仅当本次新填了 AI 配置时；失败仍保存，便于稍后重配）
    const finalModel = changes.AI_MODEL || model;
    const aiChanged = Boolean(changes.AI_BASE_URL || changes.AI_API_KEY || changes.AI_FORMAT || changes.AI_MODEL);
    if (aiChanged && baseUrl && apiKey && finalModel) {
      const result = await probe({ AI_BASE_URL: baseUrl, AI_API_KEY: apiKey, AI_FORMAT: format, AI_MODEL: finalModel });
      console.log(result.ok ? '[校验] LLM 连通正常。' : `[校验] 未通过：${result.error}（仍保存，可稍后 --reconfig 重配）`);
    }
  }

  rl.close();

  if (!Object.keys(changes).length) {
    console.log('[复用] .env.local 配置齐全，无需修改。');
    return;
  }
  let next = baseText;
  for (const [key, value] of Object.entries(changes)) next = setKey(next, key, value);
  fs.writeFileSync(ENV_LOCAL, next);
  console.log(`[保存] 已写入 ${ENV_LOCAL}（gitignored，不会进仓库）。`);
};

main().catch((error) => {
  console.error(`[setup] 失败：${error.message}`);
  process.exitCode = 1;
});
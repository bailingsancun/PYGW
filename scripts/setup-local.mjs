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
import { EventEmitter } from 'node:events';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';
import { listModels, probe, FORMATS } from '../server/src/ai/provider.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_LOCAL = path.join(root, '.env.local');
const ENV_EXAMPLE = path.join(root, '.env.example');

// 已输入/复用的密钥：用于终端掩码与错误信息脱敏，防止明文回显或随报错泄露
const secrets = [];
const redact = (text) => {
  let out = String(text ?? '');
  for (const secret of secrets) {
    if (secret && secret.length >= 6) out = out.split(secret).join('***');
  }
  return out.length > 160 ? `${out.slice(0, 160)}…` : out;
};

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
  for (const key of ['DB_PASSWORD', 'AI_API_KEY', 'AI_EMBEDDING_API_KEY']) {
    if (current[key]) secrets.push(current[key]);
  }
  const need = (key) => (reconfig ? '' : (current[key] || ''));

  // 行队列：从创建起就缓存所有 'line'，避免管道/粘贴输入一次性到达时丢行；
  // EOF 时拒绝挂起的询问，让 main 优雅退出而非静默挂起。
  // 密钥掩码：readline 的刷新/清屏会直接写 output（绕过一切实例方法覆写，且新版 Node
  // 把 _writeToOutput 改成了 Symbol 私有键），故代理 output 流统一过滤：
  // 掩码期间把回显中的口令原文替换为等宽星号，提示符由 readline 自己渲染以免被刷新擦除。
  let masking = false;
  const maskOf = (text) => [...text].map((ch) => (ch.codePointAt(0) > 0x7f ? '**' : '*')).join('');
  const out = new EventEmitter();
  out.write = (chunk) => {
    let text = String(chunk);
    // 含 ESC 的是光标/清屏控制序列，原样放行，避免口令字符碰巧替换坏转义参数。
    // 刷新可能整行重绘也可能只写增量后缀，故按三种形态分别处理，其余回显一律掩码。
    if (masking && !text.includes('\x1b') && text !== '\r\n') {
      const prompt = rl.getPrompt();
      if (text === prompt + rl.line) text = prompt + maskOf(rl.line);
      else if (text !== prompt) {
        // 多行粘贴时首行重绘带提示符前缀，保留提示符只掩码内容
        text = rl.line.includes('\n') && text.startsWith(prompt)
          ? prompt + maskOf(text.slice(prompt.length))
          : maskOf(text);
      }
    }
    stdout.write(text);
    return true;
  };
  for (const prop of ['columns', 'rows', 'isTTY']) {
    Object.defineProperty(out, prop, { get: () => stdout[prop] });
  }
  stdout.on('resize', () => out.emit('resize'));
  const rl = readline.createInterface({ input: stdin, output: out });
  // TTY 下 clearLine() 已经 output 补了换行；管道模式没有回显刷新，需手动补一个
  const unmask = () => {
    if (!masking) return;
    masking = false;
    if (!rl.terminal) stdout.write('\n');
  };
  const queue = [];
  const waiters = [];
  let closed = false;
  rl.on('line', (line) => {
    unmask();
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(line);
    else queue.push(line);
  });
  rl.on('close', () => {
    unmask();
    closed = true;
    for (const waiter of waiters.splice(0)) waiter.reject(new Error('输入已结束（EOF）'));
  });
  const ask = (q, secret = false) => new Promise((resolve, reject) => {
    // 先消费队列/判 EOF 再动提示符：rl 关闭后 prompt() 会抛 ERR_USE_AFTER_CLOSE，
    // 若先调用，异常会被 askOptional 吞掉，导致已入队的输入被整段静默跳过
    if (queue.length) {
      unmask();
      return resolve(queue.shift());
    }
    if (closed) {
      unmask();
      return reject(new Error('输入已结束（EOF）'));
    }
    if (secret) {
      masking = true;
      rl.setPrompt(q);
    } else {
      unmask();
      rl.setPrompt(q);
    }
    rl.prompt();
    waiters.push({ resolve, reject });
  });
  // 可选项：EOF/无输入视为留空跳过，而非致命错误（必填项仍用 ask）。
  const askOptional = async (q, secret = false) => {
    try {
      return await ask(q, secret);
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
      dbPassword = (await ask('MySQL DB_PASSWORD（必填）: ', true)).trim();
    }
    secrets.push(dbPassword);
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
      while (!apiKey) apiKey = (await ask('AI api_key（必填）: ', true)).trim();
      secrets.push(apiKey);
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
        embKey = (await askOptional('embedding api_key（留空=无鉴权）: ', true)).trim();
        if (embKey) {
          secrets.push(embKey);
          changes.AI_EMBEDDING_API_KEY = embKey;
        }
      }
    }

    // 4) 探针校验（仅当本次新填了 AI 配置时；失败仍保存，便于稍后重配）
    const finalModel = changes.AI_MODEL || model;
    const aiChanged = Boolean(changes.AI_BASE_URL || changes.AI_API_KEY || changes.AI_FORMAT || changes.AI_MODEL);
    if (aiChanged && baseUrl && apiKey && finalModel) {
      const result = await probe({ AI_BASE_URL: baseUrl, AI_API_KEY: apiKey, AI_FORMAT: format, AI_MODEL: finalModel });
      console.log(result.ok ? '[校验] LLM 连通正常。' : `[校验] 未通过：${redact(result.error)}（仍保存，可稍后 --reconfig 重配）`);
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
  console.error(`[setup] 失败：${redact(error.message)}`);
  process.exitCode = 1;
});
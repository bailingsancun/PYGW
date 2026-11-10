/**
 * 实现功能：provider 无关的 LLM 协议适配器
 * 职责：把 OpenAI 兼容 chat/completions、Anthropic messages、OpenAI responses 三种
 *       协议归一成统一接口：buildRequest / streamCompletion / listModels / probe。
 *       base_url 约定含版本前缀（如 https://api.deepseek.com/v1），本层只追加端点后缀。
 * 接口/函数清单：
 *   - FORMATS：可选协议 ['chat','message','response']
 *   - buildRequest(config, opts)：{url, headers, body}
 *   - streamCompletion(config, messages, onDelta, opts)：流式调用，返回累计文本
 *   - listModels(config)：模型 id 数组（失败返回 []）
 *   - probe(config)：{ok, error?} 连通性校验
 */

export const FORMATS = ['chat', 'message', 'response'];

const ANTHROPIC_VERSION = '2023-06-01';

const trimSlash = (value = '') => String(value || '').trim().replace(/\/+$/, '');

const endpointOf = (format, baseUrl) => {
  const base = trimSlash(baseUrl);
  if (format === 'message') return `${base}/messages`;
  if (format === 'response') return `${base}/responses`;
  return `${base}/chat/completions`;
};

const authHeaders = (config, stream) => {
  const headers = { 'Content-Type': 'application/json' };
  if (stream) headers.Accept = 'text/event-stream';
  if (config.AI_FORMAT === 'message') {
    headers['x-api-key'] = config.AI_API_KEY;
    headers['anthropic-version'] = ANTHROPIC_VERSION;
  } else {
    headers.Authorization = `Bearer ${config.AI_API_KEY}`;
  }
  return headers;
};

/** 把统一 messages（含 system）转成各协议的请求体 */
export const buildRequest = (config, { messages, stream = true, temperature = 0.4, maxTokens = 1024 } = {}) => {
  const format = config.AI_FORMAT;
  const model = config.AI_MODEL;
  const url = endpointOf(format, config.AI_BASE_URL);
  const headers = authHeaders(config, stream);

  let body;
  if (format === 'message') {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const rest = messages.filter((m) => m.role !== 'system');
    body = { model, max_tokens: maxTokens, stream, messages: rest };
    if (system) body.system = system;
  } else if (format === 'response') {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const rest = messages.filter((m) => m.role !== 'system');
    body = { model, stream, input: rest };
    if (system) body.instructions = system;
  } else {
    body = { model, messages, stream, temperature };
  }
  return { url, headers, body };
};

/** 逐行喂 SSE，返回 {text, done, error}；跟踪 event: 行以区分 Anthropic/Responses 事件 */
export const createStreamParser = (format) => {
  let event = '';
  return {
    push(rawLine) {
      const line = String(rawLine || '').replace(/\r$/, '');
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
        return {};
      }
      if (!line.startsWith('data:')) return {};
      const payload = line.slice(5).trim();
      if (!payload) return {};
      if (payload === '[DONE]') return { done: true };
      let obj;
      try {
        obj = JSON.parse(payload);
      } catch {
        return {};
      }
      if (obj.error) return { error: obj.error.message || JSON.stringify(obj.error) };

      if (format === 'message') {
        if (obj.type === 'message_stop' || event === 'message_stop') return { done: true };
        if (obj.type === 'content_block_delta') return { text: obj.delta?.text || '' };
        return {};
      }
      if (format === 'response') {
        if (obj.type === 'response.completed' || obj.type === 'response.done') return { done: true };
        if (obj.type === 'response.output_text.delta') return { text: obj.delta || '' };
        if (typeof obj.delta === 'string') return { text: obj.delta };
        return {};
      }
      // chat
      const choice = obj.choices?.[0];
      return { text: choice?.delta?.content ?? choice?.message?.content ?? '' };
    },
  };
};

/** 非流式回落：从整包 JSON 提取全文 */
const extractFullText = (format, obj) => {
  if (format === 'message') {
    return (obj.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  if (format === 'response') {
    if (typeof obj.output_text === 'string') return obj.output_text;
    return (obj.output || [])
      .flatMap((o) => o.content || [])
      .filter((b) => b.type === 'output_text' || b.type === 'text')
      .map((b) => b.text)
      .join('');
  }
  return obj.choices?.[0]?.message?.content ?? '';
};

/**
 * 流式调用 LLM；onDelta 逐段回调；返回累计文本。失败抛可读错误。
 * timeoutMs 为「空闲超时」：连续该时长收不到新数据就中止（每次读到数据会重置），
 * 这样上游挂起时能尽快回落，又不会误伤正常的长回答。
 */
export const streamCompletion = async (config, messages, onDelta = () => {}, opts = {}) => {
  const { timeoutMs = 30000, ...requestOpts } = opts;
  const { url, headers, body } = buildRequest(config, { messages, stream: true, ...requestOpts });

  const controller = new AbortController();
  let idleTimer = null;
  const armIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (timeoutMs > 0) idleTimer = setTimeout(() => controller.abort(), timeoutMs);
  };
  armIdleTimer();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const snippet = (await response.text().catch(() => '')).slice(0, 300);
      throw new Error(`LLM HTTP ${response.status}: ${snippet}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      const obj = await response.json();
      const text = extractFullText(config.AI_FORMAT, obj);
      if (text) onDelta(text);
      return text;
    }

    const parser = createStreamParser(config.AI_FORMAT);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      armIdleTimer();
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        const { text, done: finished, error } = parser.push(line);
        if (error) throw new Error(`LLM 流错误: ${error}`);
        if (text) {
          full += text;
          onDelta(text);
        }
        if (finished) {
          await reader.cancel().catch(() => {});
          return full;
        }
      }
    }
    return full;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`LLM 响应超时（${Math.round(timeoutMs / 1000)}s 内无新数据）`);
    }
    throw error;
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
  }
};

/**
 * 非流式 chat 补全（Agent 工具规划阶段用：需完整解析 tool_calls）
 * 仅 OpenAI 兼容 chat 协议支持 Function Calling；返回 {content, toolCalls}。
 */
export const completeChat = async (config, messages, { tools = [], temperature = 0.2, maxTokens = 400, timeoutMs = 20000 } = {}) => {
  if (config.AI_FORMAT !== 'chat') throw new Error('completeChat 仅支持 chat 协议');
  const { url, headers, body } = buildRequest(config, { messages, stream: false, temperature, maxTokens });
  body.stream = false;
  body.max_tokens = maxTokens;
  if (tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    if (!response.ok) {
      const snippet = (await response.text().catch(() => '')).slice(0, 300);
      throw new Error(`LLM HTTP ${response.status}: ${snippet}`);
    }
    const obj = await response.json();
    const message = obj.choices?.[0]?.message || {};
    const toolCalls = (message.tool_calls || [])
      .map((call, index) => ({
        id: call.id || `call_${index}`,
        name: call.function?.name || '',
        arguments: call.function?.arguments || '{}',
      }))
      .filter((call) => call.name);
    return { content: message.content || '', toolCalls };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('LLM 工具规划超时');
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

/** 拉模型列表（OpenAI 兼容 /models）；失败返回 [] 供手动输入回落 */
export const listModels = async (config) => {
  try {
    const url = `${trimSlash(config.AI_BASE_URL)}/models`;
    const response = await fetch(url, { headers: authHeaders(config, false) });
    if (!response.ok) return [];
    const obj = await response.json();
    const list = obj.data || obj.models || [];
    return list.map((m) => m.id || m.name).filter(Boolean);
  } catch {
    return [];
  }
};

/** 连通性探针：发一次极小请求验证 base/key/format/model */
export const probe = async (config) => {
  try {
    await streamCompletion(config, [{ role: 'user', content: '回复" ok"两个字符即可' }], () => {}, { maxTokens: 8 });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};
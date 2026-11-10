/**
 * 实现功能：AI 讲解员 / 导览 Agent 浏览器客户端（SSE）
 * 职责：调用独立 AI 服务 /api/ai/*：
 *       - ask/narrate 走 RAG 问答（流式回答 + 来源）
 *       - agent 走工具调用工作流（思考/工具轨迹 + 流式回答 + 可跳转路线）
 *       统一用 fetch + ReadableStream 解析 SSE，逐事件回调；返回可 abort 的句柄。
 * 接口/函数清单：
 *   - getHealth()：{configured, format, model, retrieval, chunks, agent, tools}
 *   - streamGuide(payload, handlers)：RAG 问答/讲解
 *   - streamAgent(payload, handlers)：Agent 工具调用
 */
import { unwrapResponse } from './index.js';

const AI_BASE = '/api/ai';

export const getHealth = async () => {
  const response = await fetch(`${AI_BASE}/health`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return unwrapResponse(await response.json());
};

/** 逐行解析 SSE，把 (event, data) 交给 dispatch */
const readSse = async (response, dispatch) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, '');
      buffer = buffer.slice(idx + 1);
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
        continue;
      }
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        continue;
      }
      dispatch(event, data);
    }
  }
};

/** 把 HTTP 状态码转成给用户看的中文错误；429 单独提示 */
const httpError = (status) => new Error(
  status === 429 ? 'AI 请求过于频繁，请稍后再试' : `AI 服务 HTTP ${status}`,
);

/**
 * @param {{mode:'ask'|'narrate', question?:string, region?:string, page?:string}} payload
 * @param {{onSources?:Function,onDelta?:Function,onDone?:Function,onError?:Function,onAbort?:Function}} handlers
 */
export const streamGuide = (payload, handlers = {}) => {
  const controller = new AbortController();
  const {
    onSources = () => {}, onDelta = () => {}, onDone = () => {}, onError = () => {}, onAbort = () => {},
    onSafety = () => {},
  } = handlers;
  const mode = payload.mode === 'narrate' ? 'narrate' : 'ask';

  (async () => {
    let finished = false;
    try {
      const response = await fetch(`${AI_BASE}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ question: payload.question, region: payload.region, page: payload.page }),
        signal: controller.signal,
      });
      if (!response.ok) throw httpError(response.status);
      if (!response.body) throw new Error('AI 服务未返回数据流');
      await readSse(response, (event, data) => {
        if (event === 'sources') onSources(data);
        else if (event === 'safety') onSafety(data);
        else if (event === 'delta') onDelta(data.text || '');
        else if (event === 'done') {
          finished = true;
          onDone(data);
        } else if (event === 'error') onError(data.message || 'AI 服务错误');
      });
      if (!finished) onDone({});
    } catch (error) {
      if (error?.name === 'AbortError') {
        onAbort();
        return;
      }
      onError(error?.message || '网络错误');
    }
  })();

  return { abort: () => controller.abort() };
};

/**
 * Agent 事件：step / tool_call / tool_result / sources / navigate / delta / done / error
 * @param {{question?:string, mode?:'narrate'|'ask', region?:string, page?:string}} payload
 * @param {object} handlers onStep/onToolCall/onToolResult/onSources/onNavigate/onDelta/onDone/onError/onAbort
 */
export const streamAgent = (payload, handlers = {}) => {
  const controller = new AbortController();
  const {
    onStep = () => {},
    onToolCall = () => {},
    onToolResult = () => {},
    onSources = () => {},
    onNavigate = () => {},
    onDelta = () => {},
    onDone = () => {},
    onError = () => {},
    onAbort = () => {},
    onSafety = () => {},
  } = handlers;

  (async () => {
    let finished = false;
    try {
      const response = await fetch(`${AI_BASE}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          question: payload.question,
          region: payload.region,
          page: payload.page,
          mode: payload.mode,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw httpError(response.status);
      if (!response.body) throw new Error('AI 服务未返回数据流');
      await readSse(response, (event, data) => {
        if (event === 'step') onStep(data);
        else if (event === 'tool_call') onToolCall(data);
        else if (event === 'tool_result') onToolResult(data);
        else if (event === 'sources') onSources(data);
        else if (event === 'navigate') onNavigate(data);
        else if (event === 'safety') onSafety(data);
        else if (event === 'delta') onDelta(data.text || '');
        else if (event === 'done') {
          finished = true;
          onDone(data);
        } else if (event === 'error') onError(data.message || 'AI 服务错误');
      });
      if (!finished) onDone({});
    } catch (error) {
      if (error?.name === 'AbortError') {
        onAbort();
        return;
      }
      onError(error?.message || '网络错误');
    }
  })();

  return { abort: () => controller.abort() };
};

/**
 * 多模态识图：图片（DataURL）+ 可选问题 → SSE 讲解
 * 事件：sources / safety / delta / done / error；未配置视觉模型时服务端回落「赏析四看」。
 * @param {{image:string, question?:string, region?:string, page?:string}} payload
 * @param {object} handlers onSources/onSafety/onDelta/onDone/onError/onAbort
 */
export const streamVision = (payload, handlers = {}) => {
  const controller = new AbortController();
  const {
    onSources = () => {}, onSafety = () => {}, onDelta = () => {},
    onDone = () => {}, onError = () => {}, onAbort = () => {},
  } = handlers;

  (async () => {
    let finished = false;
    try {
      const response = await fetch(`${AI_BASE}/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({
          image: payload.image,
          question: payload.question,
          region: payload.region,
          page: payload.page,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw httpError(response.status);
      if (!response.body) throw new Error('AI 服务未返回数据流');
      await readSse(response, (event, data) => {
        if (event === 'sources') onSources(data);
        else if (event === 'safety') onSafety(data);
        else if (event === 'delta') onDelta(data.text || '');
        else if (event === 'done') {
          finished = true;
          onDone(data);
        } else if (event === 'error') onError(data.message || 'AI 服务错误');
      });
      if (!finished) onDone({});
    } catch (error) {
      if (error?.name === 'AbortError') {
        onAbort();
        return;
      }
      onError(error?.message || '网络错误');
    }
  })();

  return { abort: () => controller.abort() };
};

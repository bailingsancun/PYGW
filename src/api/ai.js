/**
 * 实现功能：AI 讲解员浏览器客户端（SSE）
 * 职责：调用独立 AI 服务 /api/ai/*；ask/narrate 走 fetch + ReadableStream 解析 SSE，
 *       逐段回调 onDelta 供流式渲染；返回可 abort 的句柄。health 走普通 JSON。
 * 接口/函数清单：
 *   - getHealth()：{configured, format, model, retrieval, chunks}
 *   - streamGuide(payload, handlers)：{abort()}
 */
import { unwrapResponse } from './index.js';

const AI_BASE = '/api/ai';

export const getHealth = async () => {
  const response = await fetch(`${AI_BASE}/health`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return unwrapResponse(await response.json());
};

/**
 * @param {{mode:'ask'|'narrate', question?:string, region?:string, page?:string}} payload
 * @param {{onSources?:Function,onDelta?:Function,onDone?:Function,onError?:Function}} handlers
 */
export const streamGuide = (payload, handlers = {}) => {
  const controller = new AbortController();
  const { onSources = () => {}, onDelta = () => {}, onDone = () => {}, onError = () => {} } = handlers;
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
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }
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
          } else if (line.startsWith('data:')) {
            const raw = line.slice(5).trim();
            if (!raw) continue;
            let data;
            try {
              data = JSON.parse(raw);
            } catch {
              continue;
            }
            if (event === 'sources') onSources(data);
            else if (event === 'delta') onDelta(data.text || '');
            else if (event === 'done') {
              finished = true;
              onDone(data);
            } else if (event === 'error') onError(data.message || 'AI 服务错误');
          }
        }
      }
      if (!finished) onDone({});
    } catch (error) {
      if (error?.name === 'AbortError') return;
      onError(error?.message || '网络错误');
    }
  })();

  return { abort: () => controller.abort() };
};
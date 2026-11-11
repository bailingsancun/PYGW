/**
 * 实现功能：非遗导览 Agent（Function Calling 工作流）
 * 职责：
 *   1) 模型驱动工具规划：OpenAI 兼容 chat 协议下，用 tools + tool_choice=auto 让模型决定
 *      调用哪些工具，最多 AI_AGENT_MAX_STEPS 轮，逐次执行并把观测结果回灌；
 *   2) 规则兜底：无 LLM / 非 chat 协议 / 模型未调用工具时，用 planOffline 保证至少完成
 *      一次 grounded 检索与必要的结构化取数，工具链路始终可运行；
 *   3) 流式作答：把工具观测结果注入最终 prompt，走真实 SSE token 流；失败时回落资料整理。
 *   SSE 事件：step / tool_call / tool_result / sources / navigate / delta / done / error。
 * 接口/函数清单：
 *   - runAgent(config, opts)：opts = {question,region,page,chunks,knowledge,onEvent,shouldStop}
 */
import { completeChat, streamCompletion } from './provider.js';
import { TOOL_DEFS, executeTool, planOffline, toolLabel } from './tools.js';
import { buildAgentPlanMessages, buildAgentFinalMessages, offlineAgentAnswer } from './prompt.js';
import { screenOutput, createStreamScreen, SAFETY } from './moderation.js';

const MAX_CALLS_PER_STEP = 3;

const safeParse = (raw) => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const runAgent = async (config, {
  question,
  region = '',
  page = '',
  chunks = [],
  knowledge,
  onEvent = () => {},
  shouldStop = () => false,
} = {}) => {
  const configured = Boolean(config.AI_BASE_URL && config.AI_API_KEY && config.AI_MODEL);
  const ctx = { chunks, knowledge };
  const observations = [];
  const emit = (event, data) => {
    if (!shouldStop()) onEvent(event, data);
  };
  const stop = () => shouldStop();

  const runTool = (name, args) => {
    const observation = executeTool(name, args, ctx);
    observations.push(observation);
    emit('tool_call', { name, args: observation.args, label: toolLabel(name, observation.args) });
    emit('tool_result', { name, ok: observation.ok, summary: observation.summary });
    if (observation.sources?.length) emit('sources', observation.sources);
    if (observation.navigate) emit('navigate', observation.navigate);
    return observation;
  };
  const hasTool = (name) => observations.some((o) => o.name === name);
  const hasStructured = () => observations.some((o) =>
    ['get_region_profile', 'get_craft_process', 'get_history_timeline', 'list_regions', 'navigate_to'].includes(o.name));

  let steps = 0;
  const maxSteps = Math.min(6, Math.max(1, Number(config.AI_AGENT_MAX_STEPS) || 3));

  // 1) 模型驱动的工具规划（仅 OpenAI 兼容 chat 协议具备 Function Calling）
  if (configured && config.AI_FORMAT === 'chat' && !stop()) {
    const messages = buildAgentPlanMessages({ question, region, page });
    while (steps < maxSteps && !stop()) {
      steps += 1;
      emit('step', { phase: 'plan', step: steps, text: steps === 1 ? '思考需要哪些资料' : '继续补充资料' });
      let response;
      try {
        response = await completeChat(config, messages, { tools: TOOL_DEFS, temperature: 0.2, maxTokens: 400 });
      } catch (error) {
        // 上游错误细节只留日志，前端轨迹只看到通用说明
        console.error(`[ai] agent 工具规划失败：${error.message}`);
        emit('step', { phase: 'plan', note: '工具规划不可用，改用规则规划' });
        break;
      }
      const calls = (response.toolCalls || []).slice(0, MAX_CALLS_PER_STEP);
      if (!calls.length) break;
      messages.push({
        role: 'assistant',
        content: response.content || '',
        tool_calls: calls.map((call) => ({
          id: call.id,
          type: 'function',
          function: { name: call.name, arguments: call.arguments },
        })),
      });
      for (const call of calls) {
        const observation = runTool(call.name, safeParse(call.arguments));
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(observation.result).slice(0, 1600),
        });
      }
    }
  }

  // 2) 保证至少完成一次检索（为回答提供可跳转来源）
  if (!hasTool('search_knowledge') && !stop()) {
    runTool('search_knowledge', { query: question || '皮影', region });
  }

  // 3) 结构化资料不足时，用规则规划补齐（离线 / 非 chat / 模型未调工具）
  if (!hasStructured() && !stop()) {
    for (const item of planOffline({ question, region, page, knowledge }).slice(0, 4)) {
      if (stop()) break;
      const noArg = Object.keys(item.args || {}).length === 0;
      if (noArg && hasTool(item.name)) continue;
      runTool(item.name, item.args || {});
    }
  }

  // 4) 生成最终回答（真实流式；失败或未配置时回落资料整理）
  let fallback = false;
  emit('step', { phase: 'answer', text: '组织讲解' });
  if (configured && !stop()) {
    const finalMessages = buildAgentFinalMessages({ question, region, page, observations });
    try {
      // 增量复核：红线组合在拼成前被回留拦截，命中后不再下发也不回落（避免污染已拦截内容）
      const gate = createStreamScreen((text) => emit('delta', { text }));
      const full = await streamCompletion(
        config,
        finalMessages,
        (text) => gate.push(text),
        { temperature: 0.5, maxTokens: 900 },
      );
      if (!full || !full.trim()) throw new Error('模型未返回内容');
      if (gate.blocked || !screenOutput(full).ok) {
        emit('safety', { stage: 'output', message: SAFETY.output });
      } else {
        gate.flush();
      }
    } catch (error) {
      fallback = true;
      console.error(`[ai] agent 作答失败，回落资料整理：${error.message}`);
      emit('step', { phase: 'answer', note: '生成失败，回落资料整理' });
      emit('delta', { text: offlineAgentAnswer(observations) });
    }
  } else {
    fallback = true;
    emit('delta', { text: offlineAgentAnswer(observations) });
  }

  emit('done', {
    fallback,
    steps,
    configured,
    tools: [...new Set(observations.map((o) => o.name))],
  });
};

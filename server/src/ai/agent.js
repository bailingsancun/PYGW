/**
 * 实现功能：非遗导览的多 Agent 编排（策展人 → 讲解员 → 审校）
 * 职责：
 *   0) 策展人（规则）：判断这次提问要不要带路，需要则产出可跳转路线；
 *   1) 讲解员（模型驱动）：OpenAI 兼容 chat 协议下，用 tools + tool_choice=auto 决定调用哪些工具，
 *      最多 AI_AGENT_MAX_STEPS 轮，逐次执行并把观测结果回灌；无 LLM 时按意图规则补齐资料；
 *   2) 审校（规则）：对最终回答做引用覆盖与无据推断检查，必要时补一句来源说明。
 *   三个角色的工具边界见 agents.js 的 ROLE_TOOLS；事件里带 agent 字段，前端可展示"谁在做什么"。
 *   SSE 事件：step / tool_call / tool_result / sources / navigate / delta / done / error。
 * 接口/函数清单：
 *   - runAgent(config, opts)：opts = {question,region,page,chunks,knowledge,onEvent,shouldStop}
 */
import { completeChat, streamCompletion } from './provider.js';
import { TOOL_DEFS, executeTool, planOffline, toolLabel } from './tools.js';
import { buildAgentPlanMessages, buildAgentFinalMessages, offlineAgentAnswer } from './prompt.js';
import { screenOutput, createStreamScreen, SAFETY } from './moderation.js';
import { ROLE, curate, review } from './agents.js';

const MAX_CALLS_PER_STEP = 3;
/** 属于策展人职责的工具：事件里标成策展人，其余标讲解员 */
const CURATOR_TOOLS = new Set(['list_regions', 'get_region_profile', 'navigate_to']);

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
    const agent = CURATOR_TOOLS.has(name) ? ROLE.CURATOR : ROLE.NARRATOR;
    emit('tool_call', { name, args: observation.args, label: toolLabel(name, observation.args), agent });
    emit('tool_result', { name, ok: observation.ok, summary: observation.summary, agent });
    if (observation.sources?.length) emit('sources', observation.sources);
    if (observation.navigate) emit('navigate', observation.navigate);
    return observation;
  };
  const hasTool = (name) => observations.some((o) => o.name === name);
  const hasStructured = () => observations.some((o) =>
    ['get_region_profile', 'get_craft_process', 'get_history_timeline', 'list_regions', 'navigate_to'].includes(o.name));

  let steps = 0;
  const maxSteps = Math.min(6, Math.max(1, Number(config.AI_AGENT_MAX_STEPS) || 3));

  /*
   * 0) 策展人：只在「要带路」的提问里上场（规则判定，不额外调模型）。
   *    它只碰 list_regions / get_region_profile，做前置资料准备；
   *    其观测**不写入 observations**——否则会让 hasStructured() 提前为真，
   *    把后面本该执行的规则规划（含 navigate_to）整段跳过。
   */
  if (!stop()) {
    const curatedCallTool = (name, args) => {
      const observation = executeTool(name, args, ctx);
      emit('tool_call', { name, args: observation.args, label: toolLabel(name, observation.args), agent: ROLE.CURATOR });
      emit('tool_result', { name, ok: observation.ok, summary: observation.summary, agent: ROLE.CURATOR });
      if (observation.sources?.length) emit('sources', observation.sources);
      return observation;
    };
    curate({ question, region, page, knowledge, callTool: curatedCallTool, emit });
  }

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

  // 4) 讲解员生成最终回答（真实流式；失败或未配置时回落资料整理）
  let fallback = false;
  /** 流式下发的完整文本：审校阶段要基于它做引用覆盖检查 */
  let fullText = '';
  emit('step', { agent: ROLE.NARRATOR, phase: 'answer', text: '组织讲解' });
  if (configured && !stop()) {
    const finalMessages = buildAgentFinalMessages({ question, region, page, observations });
    try {
      // 增量复核：红线组合在拼成前被回留拦截，命中后不再下发也不回落（避免污染已拦截内容）
      const gate = createStreamScreen((text) => {
        fullText += text;
        emit('delta', { text });
      });
      const full = await streamCompletion(
        config,
        finalMessages,
        (text) => gate.push(text),
        { temperature: 0.5, maxTokens: 900 },
      );
      if (!full || !full.trim()) throw new Error('模型未返回内容');
      if (gate.blocked || !screenOutput(full).ok) {
        emit('safety', { stage: 'output', message: SAFETY.output });
        fullText = '';
      } else {
        gate.flush();
      }
    } catch (error) {
      fallback = true;
      console.error(`[ai] agent 作答失败，回落资料整理：${error.message}`);
      emit('step', { agent: ROLE.NARRATOR, phase: 'answer', note: '生成失败，回落资料整理' });
      fullText = offlineAgentAnswer(observations);
      emit('delta', { text: fullText });
    }
  } else {
    fallback = true;
    fullText = offlineAgentAnswer(observations);
    emit('delta', { text: fullText });
  }

  // 5) 审校：引用覆盖与无据推断检查（只做轻量修补，不重写讲解内容）
  const sources = observations.flatMap((o) => (Array.isArray(o?.sources) ? o.sources : []));
  const reviewed = review({ answer: fullText, sources, observations });
  if (!reviewed.passed && fullText.trim()) {
    emit('step', { agent: ROLE.REVIEWER, phase: 'done', text: `审校：${reviewed.issues.join(' / ')}` });
    if (reviewed.issues.includes('no-source')) {
      emit('delta', { text: '\n（以上内容基于展馆资料整理，仅供参考）' });
    }
  }

  emit('done', {
    fallback,
    steps,
    configured,
    tools: [...new Set(observations.map((o) => o.name))],
    agents: [...new Set([ROLE.CURATOR, ROLE.NARRATOR, ...(reviewed.passed ? [] : [ROLE.REVIEWER])])],
    review: reviewed.issues,
  });
};

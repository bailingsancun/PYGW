<!--
  实现功能：AI 讲解员（RAG 非遗问答）浮动入口 + 对话面板
  职责：全局挂载；浮动印章按钮唤起面板；流式渲染 AI 回答、思考态、来源 chips 可跳转；
        支持快捷提问与"讲解当前页/当前地区"；视觉沿用 art-v2 调色板/楷体/rpx/毛玻璃。
  用法：<AiGuide />（App.vue 全局）
-->
<template>
  <div class="ai-guide">
    <button
      v-show="!open"
      class="ai-fab"
      :class="{ 'above-nav': hasNav }"
      type="button"
      aria-label="打开 AI 讲解员"
      @click="openGuide"
    >
      <span class="fab-char">影</span>
    </button>

    <transition name="sheet">
      <div v-if="open" class="ai-panel" role="dialog" aria-label="AI 讲解员">
        <div class="ai-head">
          <div class="ai-head-title">
            <span class="seal">AI</span>
            <div class="head-text">
              <span class="t">AI 讲解员</span>
              <span class="s">非遗知识 · 有据回答</span>
            </div>
          </div>
          <button class="close" type="button" aria-label="关闭" @click="close">×</button>
        </div>

        <div class="ai-context">
          <span class="chip">{{ region || '全馆' }}</span>
          <span class="chip ghost">{{ pageLabel }}</span>
          <button
            class="chip agent"
            :class="{ on: agentMode }"
            type="button"
            :aria-pressed="agentMode"
            @click="toggleAgent"
          >{{ agentMode ? 'Agent 漫游' : '问答模式' }}</button>
          <span v-if="health" class="chip mode">{{ health.configured ? health.model : '离线资料' }}</span>
        </div>

        <div ref="msgsRef" class="ai-msgs">
          <div v-if="!messages.length" class="ai-empty">
            <span class="empty-title">点亮一盏灯，听影戏千年</span>
            <span class="empty-copy">Agent 模式会调用展馆工具：查流派档案、读制作工序与历史，甚至直接规划到某个展项的路线；回答均基于展馆资料。</span>
          </div>

          <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
            <div class="bubble">
              <span v-if="m.pending" class="thinking"><i></i><i></i><i></i></span>
              <template v-else>
                <span class="text">{{ m.text }}</span>
                <span v-if="streaming && m.role === 'ai' && i === messages.length - 1" class="caret"></span>
              </template>
              <span v-if="m.error" class="err">{{ m.error }}</span>
            </div>
            <div v-if="m.trace && m.trace.length" class="trace">
              <div v-for="(t, ti) in m.trace" :key="ti" class="trace-row" :class="t.kind">
                <span class="trace-dot"></span>
                <span class="trace-text">{{ t.text }}</span>
              </div>
            </div>
            <button v-if="m.route" class="route-chip" type="button" @click="goRoute(m.route)">
              前往「{{ pageName(m.route.path) }}」<span v-if="m.route.query && m.route.query.region"> · {{ m.route.query.region }}</span>
            </button>
            <div v-if="m.sources && m.sources.length" class="sources">
              <button
                v-for="(s, si) in m.sources"
                :key="si"
                class="source-chip"
                type="button"
                @click="goSource(s.route)"
              >[{{ si + 1 }}] {{ s.title }}</button>
            </div>
            <div v-if="m.fallback" class="fallback-note">AI 暂不可用 · 已展示展馆资料</div>
          </div>
        </div>

        <div class="ai-quick">
          <button class="quick narrate" type="button" :disabled="streaming" @click="narrate">讲解当前页</button>
          <button
            v-for="q in quickPrompts"
            :key="q"
            class="quick"
            type="button"
            :disabled="streaming"
            @click="quick(q)"
          >{{ q }}</button>
        </div>

        <form class="ai-input" @submit.prevent="send">
          <input
            v-model="input"
            :disabled="streaming"
            maxlength="200"
            placeholder="问点什么，如「陕西皮影有什么特色」"
            aria-label="向 AI 讲解员提问"
          />
          <button class="send" type="submit" :disabled="streaming || !input.trim()">发送</button>
        </form>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCurrentRegion } from '@/utils/navigation.js';
import { streamGuide, streamAgent, getHealth } from '@/api/ai.js';

const route = useRoute();
const router = useRouter();

const open = ref(false);
const input = ref('');
const messages = ref([]);
const streaming = ref(false);
const health = ref(null);
const agentMode = ref(true);
const msgsRef = ref(null);
let handle = null;

const quickPrompts = ['皮影怎么做', '皮影的起源', '陕西皮影特色', '规划导览路线'];
const NAV_PAGES = ['/select', '/display', '/process', '/interactive', '/school'];
const PAGE_LABEL = {
  '/': '着陆页', '/select': '地图寻影', '/display': '皮影展示', '/process': '工艺流程',
  '/interactive': '光影互动', '/history': '光影溯源', '/school': '地域流派', '/quiz': '知识挑战',
};

const hasNav = computed(() => NAV_PAGES.includes(route.path));
const pageLabel = computed(() => PAGE_LABEL[route.path] || '展馆');
const region = computed(() => String(route.query.region || getCurrentRegion() || ''));

const pageName = (path) => PAGE_LABEL[path] || path;
const toggleAgent = () => { agentMode.value = !agentMode.value; };
const stepText = (step) => step.note || step.text || (step.phase === 'answer' ? '组织讲解' : '思考中');
const goRoute = (r) => {
  if (r && r.path) router.push({ path: r.path, query: r.query || {} });
};

const scrollBottom = () => nextTick(() => {
  if (msgsRef.value) msgsRef.value.scrollTop = msgsRef.value.scrollHeight;
});

const openGuide = async () => {
  open.value = true;
  if (!health.value) {
    health.value = await getHealth().catch(() => ({ configured: false }));
  }
  scrollBottom();
};

const close = () => {
  open.value = false;
  if (handle) handle.abort();
  streaming.value = false;
};

const run = (mode, question, userLabel) => {
  if (streaming.value) return;
  if (handle) handle.abort();
  messages.value.push({ role: 'user', text: userLabel });
  const ai = reactive({ role: 'ai', text: '', sources: [], trace: [], route: null, pending: true, fallback: false, error: '' });
  messages.value.push(ai);
  streaming.value = true;
  scrollBottom();

  const onSources = (s) => { ai.sources = s; scrollBottom(); };
  const onDelta = (t) => { ai.pending = false; ai.text += t; scrollBottom(); };
  const onDone = (d) => {
    ai.pending = false;
    ai.fallback = Boolean(d.fallback);
    streaming.value = false;
    scrollBottom();
    if (ai.route && !ai.navigated) {
      ai.navigated = true;
      window.setTimeout(() => goRoute(ai.route), 700);
    }
  };
  const onError = (m) => { ai.pending = false; ai.error = m; streaming.value = false; scrollBottom(); };

  if (agentMode.value) {
    handle = streamAgent(
      { question, region: region.value, page: route.path, mode },
      {
        onStep: (s) => { ai.trace.push({ kind: 'step', text: stepText(s) }); scrollBottom(); },
        onToolCall: (t) => { ai.trace.push({ kind: 'tool', text: t.label || t.name }); scrollBottom(); },
        onToolResult: (t) => { ai.trace.push({ kind: 'result', ok: t.ok, text: t.summary }); scrollBottom(); },
        onNavigate: (r) => { ai.route = r; },
        onSources,
        onDelta,
        onDone,
        onError,
      },
    );
  } else {
    handle = streamGuide(
      { mode, question, region: region.value, page: route.path },
      { onSources, onDelta, onDone, onError },
    );
  }
};

const send = () => {
  const q = input.value.trim();
  if (!q || streaming.value) return;
  input.value = '';
  run('ask', q, q);
};

const quick = (q) => run('ask', q, q);
const narrate = () => run('narrate', undefined, region.value ? `讲解${region.value}皮影` : '讲解当前展项');

const goSource = (r) => {
  if (r && r.path) router.push({ path: r.path, query: r.query || {} });
};

onBeforeUnmount(() => {
  if (handle) handle.abort();
});
</script>

<style scoped>
.ai-fab {
  position: fixed;
  right: calc(28 * var(--rpx));
  bottom: calc(32 * var(--rpx) + env(safe-area-inset-bottom));
  z-index: 95;
  width: calc(96 * var(--rpx));
  height: calc(96 * var(--rpx));
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: calc(2 * var(--rpx)) solid rgba(212, 175, 55, 0.7);
  border-radius: 50%;
  background: radial-gradient(circle at 32% 28%, #ffd54f, #ffb300 58%, #b2801f);
  box-shadow: 0 calc(8 * var(--rpx)) calc(24 * var(--rpx)) rgba(0, 0, 0, 0.45),
    0 0 calc(20 * var(--rpx)) rgba(255, 179, 0, 0.35);
  cursor: pointer;
}

.ai-fab.above-nav {
  bottom: calc(176 * var(--rpx) + env(safe-area-inset-bottom));
}

.fab-char {
  color: #3e2723;
  font-family: var(--art-font-title);
  font-size: calc(44 * var(--rpx));
  font-weight: 800;
  line-height: 1;
}

.ai-panel {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  max-height: 80dvh;
  display: flex;
  flex-direction: column;
  border-top: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.5);
  border-radius: calc(24 * var(--rpx)) calc(24 * var(--rpx)) 0 0;
  background: rgba(43, 26, 22, 0.94);
  backdrop-filter: blur(12px);
  box-shadow: 0 calc(-12 * var(--rpx)) calc(40 * var(--rpx)) rgba(0, 0, 0, 0.5);
  color: #fff8e1;
  font-family: var(--art-font-body);
}

.ai-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(24 * var(--rpx)) calc(28 * var(--rpx)) calc(12 * var(--rpx));
}

.ai-head-title {
  display: flex;
  align-items: center;
  gap: calc(16 * var(--rpx));
}

.seal {
  width: calc(64 * var(--rpx));
  height: calc(64 * var(--rpx));
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: calc(12 * var(--rpx));
  background: #b23a2e;
  color: #fff8e1;
  font-size: calc(26 * var(--rpx));
  font-weight: 700;
  letter-spacing: calc(1 * var(--rpx));
}

.head-text {
  display: flex;
  flex-direction: column;
}

.head-text .t {
  color: #ffb300;
  font-family: var(--art-font-title);
  font-size: calc(34 * var(--rpx));
  font-weight: 700;
  line-height: 1.2;
}

.head-text .s {
  color: rgba(255, 248, 225, 0.6);
  font-size: calc(22 * var(--rpx));
}

.close {
  width: calc(56 * var(--rpx));
  height: calc(56 * var(--rpx));
  padding: 0;
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.4);
  border-radius: 50%;
  background: transparent;
  color: #fff8e1;
  font-size: calc(32 * var(--rpx));
  line-height: 1;
  cursor: pointer;
}

.ai-context {
  display: flex;
  flex-wrap: wrap;
  gap: calc(10 * var(--rpx));
  padding: 0 calc(28 * var(--rpx)) calc(12 * var(--rpx));
}

.chip {
  padding: calc(6 * var(--rpx)) calc(16 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.45);
  border-radius: calc(999 * var(--rpx));
  background: rgba(255, 179, 0, 0.12);
  color: #ffb300;
  font-size: calc(22 * var(--rpx));
}

.chip.ghost {
  background: transparent;
  color: rgba(255, 248, 225, 0.7);
}

.chip.mode {
  background: transparent;
  border-style: dashed;
  color: rgba(255, 248, 225, 0.55);
}

.chip.agent {
  cursor: pointer;
  font-family: inherit;
  background: transparent;
  color: rgba(255, 248, 225, 0.6);
}

.chip.agent.on {
  border-color: #ffb300;
  background: rgba(255, 179, 0, 0.2);
  color: #ffb300;
  font-weight: 700;
}

.ai-msgs {
  flex: 1;
  min-height: calc(200 * var(--rpx));
  overflow-y: auto;
  padding: calc(8 * var(--rpx)) calc(28 * var(--rpx));
  scrollbar-width: none;
}

.ai-msgs::-webkit-scrollbar {
  width: 0;
}

.ai-empty {
  display: flex;
  flex-direction: column;
  gap: calc(12 * var(--rpx));
  padding: calc(40 * var(--rpx)) calc(8 * var(--rpx));
  text-align: center;
}

.empty-title {
  color: #ffb300;
  font-family: var(--art-font-title);
  font-size: calc(32 * var(--rpx));
  font-weight: 700;
}

.empty-copy {
  color: rgba(255, 248, 225, 0.65);
  font-size: calc(24 * var(--rpx));
  line-height: 1.7;
}

.msg {
  display: flex;
  flex-direction: column;
  margin-bottom: calc(20 * var(--rpx));
}

.msg.user {
  align-items: flex-end;
}

.msg.ai {
  align-items: stretch;
}

.bubble {
  max-width: 86%;
  padding: calc(16 * var(--rpx)) calc(20 * var(--rpx));
  border-radius: calc(16 * var(--rpx));
  font-size: calc(26 * var(--rpx));
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
}

.msg.user .bubble {
  background: rgba(255, 179, 0, 0.18);
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.4);
  color: #fff8e1;
}

.msg.ai .bubble {
  max-width: 100%;
  background: rgba(255, 248, 225, 0.06);
  border-left: calc(4 * var(--rpx)) solid #d4af37;
  color: rgba(255, 248, 225, 0.92);
}

.thinking {
  display: inline-flex;
  gap: calc(8 * var(--rpx));
  padding: calc(6 * var(--rpx)) 0;
}

.thinking i {
  width: calc(10 * var(--rpx));
  height: calc(10 * var(--rpx));
  border-radius: 50%;
  background: #d4af37;
  animation: dot 1.2s ease-in-out infinite;
}

.thinking i:nth-child(2) { animation-delay: 0.2s; }
.thinking i:nth-child(3) { animation-delay: 0.4s; }

@keyframes dot {
  0%, 100% { opacity: 0.3; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(calc(-6 * var(--rpx))); }
}

.caret {
  display: inline-block;
  width: calc(4 * var(--rpx));
  height: calc(26 * var(--rpx));
  margin-left: calc(4 * var(--rpx));
  vertical-align: middle;
  background: #ffb300;
  animation: blink 1s steps(2) infinite;
}

@keyframes blink {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

.err {
  display: block;
  color: #ff8a80;
  font-size: calc(24 * var(--rpx));
}

.trace {
  display: flex;
  flex-direction: column;
  gap: calc(6 * var(--rpx));
  margin-top: calc(10 * var(--rpx));
  padding-left: calc(4 * var(--rpx));
}

.trace-row {
  display: flex;
  align-items: baseline;
  gap: calc(8 * var(--rpx));
  color: rgba(255, 248, 225, 0.55);
  font-size: calc(21 * var(--rpx));
  line-height: 1.5;
}

.trace-dot {
  flex: none;
  width: calc(8 * var(--rpx));
  height: calc(8 * var(--rpx));
  border-radius: 50%;
  background: rgba(212, 175, 55, 0.6);
}

.trace-row.tool .trace-text {
  color: #d4af37;
}

.trace-row.result .trace-dot {
  background: #7bc47f;
}

.trace-row.result .trace-text {
  color: rgba(255, 248, 225, 0.72);
}

.route-chip {
  align-self: flex-start;
  margin-top: calc(10 * var(--rpx));
  padding: calc(8 * var(--rpx)) calc(18 * var(--rpx));
  border: calc(1 * var(--rpx)) solid #ffb300;
  border-radius: calc(999 * var(--rpx));
  background: rgba(255, 179, 0, 0.16);
  color: #ffb300;
  font-family: inherit;
  font-size: calc(23 * var(--rpx));
  font-weight: 700;
  cursor: pointer;
}

.route-chip:hover {
  background: rgba(255, 179, 0, 0.3);
}

.sources {
  display: flex;
  flex-wrap: wrap;
  gap: calc(8 * var(--rpx));
  margin-top: calc(10 * var(--rpx));
}

.source-chip {
  padding: calc(6 * var(--rpx)) calc(14 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.4);
  border-radius: calc(999 * var(--rpx));
  background: rgba(212, 175, 55, 0.1);
  color: #d4af37;
  font-size: calc(21 * var(--rpx));
  cursor: pointer;
}

.source-chip:hover {
  border-color: #ffb300;
  color: #ffb300;
}

.fallback-note {
  margin-top: calc(8 * var(--rpx));
  color: rgba(255, 248, 225, 0.45);
  font-size: calc(21 * var(--rpx));
}

.ai-quick {
  display: flex;
  flex-wrap: wrap;
  gap: calc(10 * var(--rpx));
  padding: calc(12 * var(--rpx)) calc(28 * var(--rpx));
  border-top: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.2);
}

.quick {
  padding: calc(8 * var(--rpx)) calc(18 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.4);
  border-radius: calc(999 * var(--rpx));
  background: transparent;
  color: rgba(255, 248, 225, 0.85);
  font-size: calc(23 * var(--rpx));
  cursor: pointer;
}

.quick.narrate {
  background: rgba(255, 179, 0, 0.16);
  color: #ffb300;
  font-weight: 700;
}

.quick:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ai-input {
  display: flex;
  gap: calc(12 * var(--rpx));
  padding: calc(12 * var(--rpx)) calc(28 * var(--rpx)) calc(20 * var(--rpx) + env(safe-area-inset-bottom));
}

.ai-input input {
  flex: 1;
  min-width: 0;
  padding: calc(16 * var(--rpx)) calc(20 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.35);
  border-radius: calc(12 * var(--rpx));
  background: rgba(0, 0, 0, 0.28);
  color: #fff8e1;
  font-family: inherit;
  font-size: calc(26 * var(--rpx));
  outline: none;
}

.ai-input input::placeholder {
  color: rgba(255, 248, 225, 0.4);
}

.ai-input input:focus {
  border-color: #ffb300;
}

.send {
  padding: 0 calc(28 * var(--rpx));
  border: none;
  border-radius: calc(12 * var(--rpx));
  background: linear-gradient(180deg, #ffd54f, #ffb300);
  color: #3e2723;
  font-family: inherit;
  font-size: calc(26 * var(--rpx));
  font-weight: 700;
  cursor: pointer;
}

.send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.sheet-enter-active,
.sheet-leave-active {
  transition: transform 0.28s ease, opacity 0.28s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(6%);
  opacity: 0;
}

@media (min-width: 900px) {
  .ai-panel {
    left: auto;
    right: 24px;
    top: 24px;
    bottom: 24px;
    width: 420px;
    max-height: none;
    border: 1px solid rgba(212, 175, 55, 0.5);
    border-radius: 16px;
  }

  .ai-fab,
  .ai-fab.above-nav {
    right: 28px;
    bottom: 28px;
    width: 60px;
    height: 60px;
  }

  .fab-char {
    font-size: 28px;
  }
}
</style>
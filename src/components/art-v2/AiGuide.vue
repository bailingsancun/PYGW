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
      <img class="fab-icon" :src="AI_ICON" alt="" aria-hidden="true" />
    </button>

    <transition name="sheet">
      <div v-if="open" class="ai-panel" role="dialog" aria-label="AI 讲解员">
        <div class="ai-head">
          <div class="ai-head-title">
            <img class="seal" :src="AI_ICON" alt="" aria-hidden="true" />
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
            <span class="empty-copy">Agent 模式会调用展馆工具查流派、工序与历史，并规划展项路线；也可点「图」上传皮影照片看图讲解，点「语」语音提问、点「朗读」听讲解。回答均基于展馆资料并做安全复核。</span>
          </div>

          <div v-for="(m, i) in messages" :key="m.id || i" class="msg" :class="m.role">
            <img v-if="m.image" class="user-img" :src="m.image" alt="上传的皮影图片" />
            <div class="bubble">
              <span
                v-if="m.role === 'ai' && !m.pending && m.text && !m.error"
                class="ai-badge"
                :class="{ curated: m.fallback }"
              >{{ m.fallback ? '展馆资料' : 'AI 生成' }}</span>
              <span v-if="m.pending" class="thinking"><i></i><i></i><i></i></span>
              <template v-else>
                <span class="text">{{ m.text }}</span>
                <span v-if="streaming && m.role === 'ai' && i === messages.length - 1" class="caret"></span>
              </template>
              <span v-if="m.error" class="err">{{ m.error }}</span>
            </div>
            <div v-if="m.safety" class="safety-note">安全过滤 · {{ m.safety }}</div>
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
            <div v-if="m.role === 'ai' && !m.pending && m.text && !m.error" class="answer-meta">
              <span v-if="m.modality === 'image'" class="modality-tag">图像识别</span>
              <span class="gen-note">{{ disclaimer }}</span>
              <button class="speak-btn" type="button" @click="speak(m)">{{ speakingId === m.id ? '停止' : '朗读' }}</button>
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

        <p class="privacy-note">识图与语音仅用于本次讲解，不会被保存；图片可能发送至第三方 AI 服务，请勿上传身份证、人脸等敏感信息。</p>

        <form class="ai-input" @submit.prevent="send">
          <div v-if="pendingImage" class="image-preview">
            <img :src="pendingImage" alt="待识别的图片预览" />
            <button class="preview-remove" type="button" aria-label="移除图片" @click="pendingImage = ''">×</button>
            <span class="preview-tip">识图讲解 · 可补充问题</span>
          </div>
          <div class="input-row">
            <button
              class="tool-btn"
              type="button"
              :disabled="streaming"
              aria-label="上传皮影图片识别"
              title="上传皮影图片，AI 看图讲解"
              @click="pickImage"
            >图</button>
            <button
              v-if="canVoice"
              class="tool-btn"
              :class="{ rec: listening }"
              type="button"
              :disabled="streaming"
              :aria-label="listening ? '停止语音输入' : '语音输入'"
              :title="listening ? '停止语音输入' : '语音输入'"
              @click="toggleVoice"
            >{{ listening ? '听' : '语' }}</button>
            <input
              v-model="input"
              :disabled="streaming"
              maxlength="200"
              :placeholder="pendingImage ? '补充问题（可选），如「这是哪个流派」' : '问点什么，或上传皮影图片识别'"
              aria-label="向 AI 讲解员提问"
            />
            <button class="send" type="submit" :disabled="streaming || (!input.trim() && !pendingImage)">发送</button>
          </div>
          <input ref="fileRef" class="file-input" type="file" accept="image/png,image/jpeg,image/webp" @change="onFileChange" />
        </form>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCurrentRegion } from '@/utils/navigation.js';
import { streamGuide, streamAgent, streamVision, getHealth } from '@/api/ai.js';
import { showToast } from '@/utils/toast.js';

const route = useRoute();
const router = useRouter();

const open = ref(false);
const input = ref('');
const messages = ref([]);
const streaming = ref(false);
const health = ref(null);
const agentMode = ref(true);
const msgsRef = ref(null);
const pendingImage = ref('');
const fileRef = ref(null);
const listening = ref(false);
const speakingId = ref(null);
let handle = null;
let navTimer = null;
let currentAi = null;
let msgSeq = 0;
let recog = null;
const canVoice = typeof window !== 'undefined'
  && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
const disclaimer = 'AI 生成内容 · 已安全复核 · 仅供参考';

/*
 * AI 图标走运行期静态路径（由 /images 中间件提供），不能写成模板里的静态 src 字面量：
 * Vue 编译器会把静态 src 提取成 import，而 Vite 构建期解析不了 /images/... 这种运行期路由，
 * 会直接报 import-analysis 失败。用常量 + :src 绑定即可绕开静态分析。
 */
const AI_ICON = '/images/web/ui/icon_fab_dengying_yuanchuang.svg';

const clearNavTimer = () => {
  if (navTimer) {
    clearTimeout(navTimer);
    navTimer = null;
  }
};

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
  clearNavTimer();
  stopSpeak();
  if (listening.value) {
    recog?.stop();
    listening.value = false;
  }
  if (currentAi) currentAi.pending = false;
  if (handle) {
    handle.abort();
    handle = null;
  }
  streaming.value = false;
};

/** 统一收尾：无论正常结束、报错还是中断，都要把 pending 关掉，避免气泡一直转圈 */
const finish = (ai, { fallback = false, aborted = false } = {}) => {
  ai.pending = false;
  ai.fallback = Boolean(fallback);
  if (!aborted) streaming.value = false;
  scrollBottom();
  if (aborted) return;
  if (ai.route && !ai.navigated) {
    ai.navigated = true;
    clearNavTimer();
    navTimer = window.setTimeout(() => {
      navTimer = null;
      goRoute(ai.route);
    }, 700);
  }
};

const run = (mode, question, userLabel) => {
  if (streaming.value) return;
  if (handle) {
    handle.abort();
    handle = null;
  }
  clearNavTimer();
  stopSpeak();
  messages.value.push({ role: 'user', text: userLabel });
  const ai = reactive({ id: ++msgSeq, role: 'ai', text: '', sources: [], trace: [], route: null, pending: true, fallback: false, error: '', safety: '', filtered: false });
  messages.value.push(ai);
  currentAi = ai;
  streaming.value = true;
  scrollBottom();

  const onSources = (s) => { ai.sources = s; scrollBottom(); };
  const onDelta = (t) => { ai.pending = false; ai.text += t; scrollBottom(); };
  const onSafety = (s) => {
    ai.safety = s?.message || '已进行安全过滤';
    if (s?.stage === 'output') { ai.text = s.message; ai.filtered = true; }
    scrollBottom();
  };
  const onDone = (d) => finish(ai, { fallback: d?.fallback });
  const onError = (m) => { ai.pending = false; ai.error = m; streaming.value = false; scrollBottom(); };
  const onAbort = () => finish(ai, { aborted: true });

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
        onSafety,
        onDone,
        onError,
        onAbort,
      },
    );
  } else {
    handle = streamGuide(
      { mode, question, region: region.value, page: route.path },
      { onSources, onDelta, onSafety, onDone, onError, onAbort },
    );
  }
};

const send = () => {
  if (streaming.value) return;
  if (pendingImage.value) {
    runVision(input.value.trim());
    return;
  }
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  run('ask', q, q);
};

const quick = (q) => run('ask', q, q);
const narrate = () => run('narrate', undefined, region.value ? `讲解${region.value}皮影` : '讲解当前展项');

// ---- 多模态识图：本地把图片压缩为 JPEG DataURL，减小上传体积 ----
const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    try {
      const max = 1024;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    } catch (error) {
      reject(error);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('图片加载失败'));
  };
  img.src = objectUrl;
});

const pickImage = () => {
  if (!streaming.value) fileRef.value?.click();
};

const onFileChange = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
    showToast('请选择 PNG/JPG/WebP 图片');
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    showToast('图片过大，请换一张（≤12MB）');
    return;
  }
  try {
    pendingImage.value = await fileToDataUrl(file);
  } catch {
    showToast('图片读取失败，请重试');
  }
};

const runVision = (question) => {
  if (streaming.value || !pendingImage.value) return;
  if (handle) {
    handle.abort();
    handle = null;
  }
  clearNavTimer();
  stopSpeak();
  const image = pendingImage.value;
  pendingImage.value = '';
  input.value = '';
  messages.value.push({ role: 'user', text: question ? `识别图片：${question}` : '识别这张皮影图片', image });
  const ai = reactive({ id: ++msgSeq, role: 'ai', modality: 'image', text: '', sources: [], trace: [], route: null, pending: true, fallback: false, error: '', safety: '', filtered: false });
  messages.value.push(ai);
  currentAi = ai;
  streaming.value = true;
  scrollBottom();

  const onSources = (s) => { ai.sources = s; scrollBottom(); };
  const onDelta = (t) => { ai.pending = false; ai.text += t; scrollBottom(); };
  const onSafety = (s) => {
    ai.safety = s?.message || '已进行安全过滤';
    if (s?.stage === 'output') { ai.text = s.message; ai.filtered = true; }
    scrollBottom();
  };
  const onDone = (d) => finish(ai, { fallback: d?.fallback });
  const onError = (m) => { ai.pending = false; ai.error = m; streaming.value = false; scrollBottom(); };
  const onAbort = () => finish(ai, { aborted: true });

  handle = streamVision(
    { image, question: question || '', region: region.value, page: route.path },
    { onSources, onDelta, onSafety, onDone, onError, onAbort },
  );
};

// ---- 语音：输入（Web Speech ASR）与朗读（speechSynthesis TTS），均为浏览器原生能力，无新依赖 ----
const toggleVoice = () => {
  if (!canVoice || streaming.value) return;
  if (listening.value) {
    recog?.stop();
    return;
  }
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  recog = new SpeechRec();
  recog.lang = 'zh-CN';
  recog.interimResults = false;
  recog.maxAlternatives = 1;
  recog.onresult = (event) => {
    const text = event.results?.[0]?.[0]?.transcript || '';
    if (text) input.value = input.value ? `${input.value} ${text}` : text;
  };
  recog.onend = () => { listening.value = false; };
  recog.onerror = () => {
    listening.value = false;
    showToast('语音识别不可用，请改用键盘输入');
  };
  listening.value = true;
  try {
    recog.start();
  } catch {
    listening.value = false;
  }
};

const stopSpeak = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  speakingId.value = null;
};

const speak = (m) => {
  if (!m?.text || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (speakingId.value === m.id) {
    stopSpeak();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new window.SpeechSynthesisUtterance(m.text);
  utter.lang = 'zh-CN';
  utter.rate = 1;
  utter.onend = () => { if (speakingId.value === m.id) speakingId.value = null; };
  utter.onerror = () => { if (speakingId.value === m.id) speakingId.value = null; };
  speakingId.value = m.id;
  window.speechSynthesis.speak(utter);
};

const goSource = (r) => {
  if (r && r.path) router.push({ path: r.path, query: r.query || {} });
};

onBeforeUnmount(() => {
  clearNavTimer();
  stopSpeak();
  if (recog) recog.abort?.();
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
  /* 图标 SVG 自带金色圆形底与描边，这里不再叠渐变背景/边框，否则会重影 */
  border: 0;
  border-radius: 50%;
  background: transparent;
  box-shadow: 0 calc(8 * var(--rpx)) calc(24 * var(--rpx)) rgba(0, 0, 0, 0.45),
    0 0 calc(20 * var(--rpx)) rgba(255, 179, 0, 0.35);
  cursor: pointer;
}

.ai-fab.above-nav {
  bottom: calc(176 * var(--rpx) + env(safe-area-inset-bottom));
}

.fab-icon {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: contain;
  display: block;
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
  overflow: hidden;
  border-top: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.5);
  border-radius: calc(24 * var(--rpx)) calc(24 * var(--rpx)) 0 0;
  background: rgba(43, 26, 22, 0.94);
  backdrop-filter: blur(12px);
  box-shadow: 0 calc(-12 * var(--rpx)) calc(40 * var(--rpx)) rgba(0, 0, 0, 0.5);
  color: #fff8e1;
  font-family: var(--art-font-body);
}

.ai-head {
  flex-shrink: 0;
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
  flex-shrink: 0;
  display: block;
  object-fit: contain;
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
  flex-shrink: 0;
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
  min-height: 0;
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
  flex-shrink: 0;
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

.user-img {
  max-width: 62%;
  max-height: calc(320 * var(--rpx));
  margin-bottom: calc(8 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.5);
  border-radius: calc(12 * var(--rpx));
  object-fit: contain;
  background: rgba(0, 0, 0, 0.25);
}

.safety-note {
  align-self: flex-start;
  margin-top: calc(8 * var(--rpx));
  padding: calc(6 * var(--rpx)) calc(14 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(178, 58, 46, 0.6);
  border-radius: calc(999 * var(--rpx));
  background: rgba(178, 58, 46, 0.16);
  color: #ffb0a6;
  font-size: calc(21 * var(--rpx));
  line-height: 1.4;
}

.answer-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: calc(10 * var(--rpx));
  margin-top: calc(8 * var(--rpx));
}

.modality-tag {
  padding: calc(4 * var(--rpx)) calc(12 * var(--rpx));
  border-radius: calc(999 * var(--rpx));
  background: rgba(255, 179, 0, 0.18);
  color: #ffb300;
  font-size: calc(20 * var(--rpx));
  font-weight: 700;
}

.gen-note {
  color: rgba(255, 248, 225, 0.42);
  font-size: calc(20 * var(--rpx));
  line-height: 1.4;
}

.ai-badge {
  display: block;
  width: fit-content;
  margin-bottom: calc(6 * var(--rpx));
  padding: calc(2 * var(--rpx)) calc(10 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(255, 179, 0, 0.55);
  border-radius: calc(4 * var(--rpx));
  background: rgba(255, 179, 0, 0.12);
  color: #ffb300;
  font-size: calc(19 * var(--rpx));
  font-weight: 700;
  letter-spacing: calc(1 * var(--rpx));
}

.ai-badge.curated {
  border-color: rgba(212, 175, 55, 0.35);
  background: rgba(212, 175, 55, 0.08);
  color: #d4af37;
}

.privacy-note {
  flex-shrink: 0;
  margin: 0;
  padding: calc(8 * var(--rpx)) calc(28 * var(--rpx)) 0;
  color: rgba(255, 248, 225, 0.38);
  font-size: calc(19 * var(--rpx));
  line-height: 1.5;
}

.speak-btn {
  padding: calc(4 * var(--rpx)) calc(14 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.45);
  border-radius: calc(999 * var(--rpx));
  background: transparent;
  color: #d4af37;
  font-family: inherit;
  font-size: calc(20 * var(--rpx));
  cursor: pointer;
}

.speak-btn:hover {
  border-color: #ffb300;
  color: #ffb300;
}

.ai-input {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: calc(10 * var(--rpx));
  padding: calc(12 * var(--rpx)) calc(28 * var(--rpx)) calc(20 * var(--rpx) + env(safe-area-inset-bottom));
}

.input-row {
  display: flex;
  align-items: stretch;
  gap: calc(10 * var(--rpx));
}

.file-input {
  display: none;
}

.tool-btn {
  flex: none;
  width: calc(64 * var(--rpx));
  padding: 0;
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.45);
  border-radius: calc(12 * var(--rpx));
  background: rgba(255, 179, 0, 0.1);
  color: #ffb300;
  font-family: inherit;
  font-size: calc(26 * var(--rpx));
  font-weight: 700;
  cursor: pointer;
}

.tool-btn.rec {
  border-color: #b23a2e;
  background: rgba(178, 58, 46, 0.35);
  color: #fff8e1;
  animation: recPulse 1.2s ease-in-out infinite;
}

.tool-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@keyframes recPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}

.image-preview {
  position: relative;
  display: flex;
  align-items: center;
  gap: calc(12 * var(--rpx));
}

.image-preview img {
  width: calc(96 * var(--rpx));
  height: calc(96 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.45);
  border-radius: calc(10 * var(--rpx));
  object-fit: cover;
}

.preview-remove {
  position: absolute;
  left: calc(78 * var(--rpx));
  top: calc(-10 * var(--rpx));
  width: calc(36 * var(--rpx));
  height: calc(36 * var(--rpx));
  padding: 0;
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.6);
  border-radius: 50%;
  background: rgba(43, 26, 22, 0.95);
  color: #ffb300;
  font-size: calc(24 * var(--rpx));
  line-height: 1;
  cursor: pointer;
}

.preview-tip {
  color: rgba(255, 248, 225, 0.6);
  font-size: calc(22 * var(--rpx));
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
}
</style>
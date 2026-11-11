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
      ref="fabRef"
      class="ai-fab"
      :class="{ 'above-nav': hasNav, dragging: fabDrag.active }"
      :style="fabStyle"
      type="button"
      aria-label="打开 AI 讲解员"
      @pointerdown="onFabDown"
      @pointermove="onFabMove"
      @pointerup="onFabUp"
      @pointercancel="onFabUp"
      @click="openGuideIfNotDragged"
    >
      <img class="fab-icon" :src="AI_ICON" alt="" aria-hidden="true" />
    </button>

    <transition name="sheet">
      <div
        v-if="open"
        ref="panelRef"
        class="ai-panel"
        :class="{ positioned: panelPos.placed, dragging: dragState.active }"
        :style="panelStyle"
        role="dialog"
        aria-label="AI 讲解员"
      >
        <div class="ai-head" @pointerdown="onDragStart">
          <div class="ai-head-title">
            <img class="seal" :src="AI_ICON" alt="" aria-hidden="true" />
            <div class="head-text">
              <span class="t">AI 讲解员</span>
              <span class="s">非遗知识 · 有据回答</span>
            </div>
          </div>
          <button class="close" type="button" aria-label="关闭" @pointerdown.stop @click="close">×</button>
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

        <div ref="msgsRef" class="ai-msgs" :class="{ empty: !messages.length }">
          <div v-if="!messages.length" class="ai-empty">
            <span class="empty-title">点亮一盏灯，听影戏千年</span>
            <span class="empty-copy">Agent 模式会调用展馆工具查流派、工序与历史，并规划展项路线；也可点「图」上传皮影照片看图讲解，点「语」语音提问、点「朗读」听讲解。回答均基于展馆资料并做安全复核。</span>
            <!-- 首次打开、尚未提问：推荐词居中展示 -->
            <div v-if="showQuick" class="ai-quick centered">
              <button class="quick narrate" type="button" @click="narrate">讲解当前页</button>
              <button
                v-for="q in quickPrompts"
                :key="q"
                class="quick"
                type="button"
                @click="quick(q)"
              >{{ q }}</button>
            </div>
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
            <!-- 步骤日志同样等正文打字机吐完再出现，避免抢在回答前面 -->
            <div v-if="m.metaReady && m.trace && m.trace.length" class="trace">
              <div v-for="(t, ti) in m.trace" :key="ti" class="trace-row" :class="t.kind">
                <span class="trace-dot"></span>
                <span class="trace-text">{{ t.text }}</span>
              </div>
            </div>
            <button v-if="m.route" class="route-chip" type="button" @click="goRoute(m.route)">
              前往「{{ pageName(m.route.path) }}」<span v-if="m.route.query && m.route.query.region"> · {{ m.route.query.region }}</span>
            </button>
            <!-- 命中资料等附属信息，等正文打字机吐完后再出现 -->
            <div v-if="m.metaReady && m.sources && m.sources.length" class="sources">
              <button
                v-for="(s, si) in m.sources"
                :key="si"
                class="source-chip"
                type="button"
                @click="goSource(s.route)"
              >[{{ si + 1 }}] {{ s.title }}</button>
            </div>
            <div v-if="m.role === 'ai' && !m.pending && m.metaReady && m.text && !m.error" class="answer-meta">
              <span v-if="m.modality === 'image'" class="modality-tag">图像识别</span>
              <span class="gen-note">{{ disclaimer }}</span>
              <button class="speak-btn" type="button" @click="speak(m)">{{ speakingId === m.id ? '停止' : '朗读' }}</button>
            </div>
            <div v-if="m.fallback" class="fallback-note">AI 暂不可用 · 已展示展馆资料</div>
          </div>

          <!--
            有对话时：推荐提示词收在消息流末尾（输出栏下方），回答一结束就出现；
            点其中一条即以用户气泡发出，随后整组隐藏，等这次生成结束再统一冒出来。
          -->
          <div v-if="showQuick && messages.length" class="ai-quick">
            <button class="quick narrate" type="button" @click="narrate">讲解当前页</button>
            <button
              v-for="q in quickPrompts"
              :key="q"
              class="quick"
              type="button"
              @click="quick(q)"
            >{{ q }}</button>
          </div>
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

        <!-- 桌面端右下角：拖动可调整面板尺寸 -->
        <div class="resize-handle" aria-hidden="true" @pointerdown.stop="onResizeStart"></div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCurrentRegion, REGION_CHANGE_EVENT } from '@/utils/navigation.js';
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
const fabRef = ref(null);
const panelRef = ref(null);
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
/*
 * 当前地区：URL 显式带的 region 优先，其次跟随「当前地区」的变更。
 * getCurrentRegion() 读的是 localStorage，本身不具备响应性——地图页选中省份后
 * 这里不会自动更新（表现为 AI 面板里还显示旧地区）。因此监听 saveRegion 派发的
 * 自定义事件，把值转存到响应式 ref 上。
 */
const regionSignal = ref(getCurrentRegion());
const region = computed(() => String(route.query.region || regionSignal.value || ''));

/** 推荐提示词：空对话时居中展示，有对话时出现在消息流末尾；生成中一律隐藏 */
const showQuick = computed(() => !streaming.value);

const onRegionChange = (e) => {
  const next = e?.detail ? String(e.detail) : getCurrentRegion();
  if (next) regionSignal.value = next;
};

const pageName = (path) => PAGE_LABEL[path] || path;
const toggleAgent = () => { agentMode.value = !agentMode.value; };
const stepText = (step) => step.note || step.text || (step.phase === 'answer' ? '组织讲解' : '思考中');
const goRoute = (r) => {
  if (r && r.path) router.push({ path: r.path, query: r.query || {} });
};

const scrollBottom = () => nextTick(() => {
  if (msgsRef.value) msgsRef.value.scrollTop = msgsRef.value.scrollHeight;
});

/* ---------- 打字机 ----------
 * 真实 token 流每片都很短，直接追加即可；但离线兜底（未配置 LLM）时服务端往往
 * 一次性把整段文本推过来，观感是「突然蹦出一大段」。这里把过长的块排进队列逐字吐出，
 * 让在线/离线都有「逐行生成」的一致体验。
 */
let typeQueue = '';
let typeTimer = null;
/** 收尾动作被推迟到「队列吐完」时执行，避免 finish 一调用就把整段补齐 */
let pendingFinish = null;

const stopTypewriter = () => {
  typeQueue = '';
  pendingFinish = null;
  if (typeTimer) {
    clearTimeout(typeTimer);
    typeTimer = null;
  }
};

/** 强制立刻补齐（仅用于关闭面板等需要即时收尾的场景） */
const flushTypewriter = (target) => {
  if (typeTimer) {
    clearTimeout(typeTimer);
    typeTimer = null;
  }
  if (target && typeQueue) target.text += typeQueue;
  typeQueue = '';
  pendingFinish = null;
};

const startTypewriter = (target) => {
  if (typeTimer) return;
  const pump = () => {
    if (!typeQueue) {
      typeTimer = null;
      // 队列吐完，补上被推迟的收尾（切 streaming / 处理自动跳转）
      if (pendingFinish) {
        const run = pendingFinish;
        pendingFinish = null;
        run();
      }
      return;
    }
    // 队列越长吐得越快，避免整段兜底时等太久
    const step = typeQueue.length > 160 ? 8 : typeQueue.length > 48 ? 3 : 1;
    target.text += typeQueue.slice(0, step);
    typeQueue = typeQueue.slice(step);
    scrollBottom();
    typeTimer = window.setTimeout(pump, 14);
  };
  typeTimer = window.setTimeout(pump, 14);
};

const openGuide = async () => {
  /*
   * 必须在 open 置真之前取悬浮球位置：面板一打开，球会被 v-show 隐藏（display:none），
   * 那时 getBoundingClientRect() 全为 0，锚定坐标会被 clamp 到左上角。
   */
  const fabRect = fabRef.value ? fabRef.value.getBoundingClientRect() : null;
  panelDragged = false;
  open.value = true;
  // 等面板挂载后再定位，使其出现在悬浮球附近（两者位置关联）
  await nextTick();
  anchorPanelToFab(fabRect);
  if (!health.value) {
    health.value = await getHealth().catch(() => ({ configured: false }));
  }
  scrollBottom();
};

const close = async () => {
  /*
   * 关闭前把面板位置记下来：如果用户拖过窗口，就把悬浮球移到窗口边上，
   * 让「球 ↔ 窗」双向呼应（打开时窗跟着球、关闭时球跟着窗）。
   */
  const panelRect = panelRef.value ? panelRef.value.getBoundingClientRect() : null;
  open.value = false;
  stopTypewriter();
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

  if (panelRect && panelDragged) {
    // 只有用户真的拖过窗口才让球跟过去；单纯开关不移动球，避免来回漂移
    await nextTick();
    syncFabToPanel(panelRect);
  }
  panelDragged = false;
};

/**
 * 把悬浮球沿水平方向挪到面板右边附近。
 * 只同步 x 轴：悬浮球的垂直位置是用户的固定偏好，开关窗口不应让它上下跳动
 * （之前两轴都同步，目标落在默认位置下方时会被 clamp 回底部，看起来像「沉底」）。
 */
const syncFabToPanel = (panelRect) => {
  const fab = fabRef.value;
  if (!fab || !isDesktopWidth()) return;
  const cur = fab.getBoundingClientRect();
  if (!cur.width) return;
  const gap = 12;
  const targetCx = panelRect.right - cur.width / 2 - gap;
  const cx = cur.left + cur.width / 2;
  fabPos.x = clampNum(fabPos.x + (targetCx - cx), -(window.innerWidth - 140), 0);
  fabPos.moved = true;
  savePos();
};

/** 真正的收尾动作：关 pending、切 streaming、必要时自动跳转 */
const doFinish = (ai, { fallback = false, aborted = false } = {}) => {
  ai.pending = false;
  // 正文（打字机）已经吐完，这时才放出「命中资料」「AI 生成」等附属信息
  ai.metaReady = true;
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

/**
 * 统一收尾：无论正常结束、报错还是中断，都要把 pending 关掉，避免气泡一直转圈。
 * 若打字机队列里还有内容没吐完，就把收尾推迟到吐完那一刻
 * —— 否则离线兜底「一次给整段」时会瞬间补齐，看不到逐字生成。
 */
const finish = (ai, options = {}) => {
  if (options.aborted) {
    stopTypewriter();
    doFinish(ai, options);
    return;
  }
  if (typeQueue) {
    pendingFinish = () => doFinish(ai, options);
    return;
  }
  doFinish(ai, options);
};

const run = (mode, question, userLabel) => {
  if (streaming.value) return;
  stopTypewriter();
  if (handle) {
    handle.abort();
    handle = null;
  }
  clearNavTimer();
  stopSpeak();
  messages.value.push({ role: 'user', text: userLabel });
  const ai = reactive({ id: ++msgSeq, role: 'ai', text: '', sources: [], trace: [], route: null, pending: true, fallback: false, error: '', safety: '', filtered: false, metaReady: false });
  messages.value.push(ai);
  currentAi = ai;
  streaming.value = true;
  scrollBottom();

  const onSources = (s) => { ai.sources = s; scrollBottom(); };
  const onDelta = (t) => {
    if (!t) return;
    ai.pending = false;
    // 短 token 直接追加；长块（离线兜底一次给整段）交给打字机逐字吐
    if (!typeQueue && t.length <= 6) {
      ai.text += t;
      scrollBottom();
      return;
    }
    typeQueue += t;
    startTypewriter(ai);
  };
  const onSafety = (s) => {
    stopTypewriter();
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
  const onDelta = (t) => {
    if (!t) return;
    ai.pending = false;
    // 短 token 直接追加；长块（离线兜底一次给整段）交给打字机逐字吐
    if (!typeQueue && t.length <= 6) {
      ai.text += t;
      scrollBottom();
      return;
    }
    typeQueue += t;
    startTypewriter(ai);
  };
  const onSafety = (s) => {
    stopTypewriter();
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

/* ---------- 可拖动：悬浮球与面板 ----------
 * 桌面端（≥900px）面板是居中浮动窗，拖动标题栏即可移动；悬浮球也可任意拖动。
 * 移动端保持底部抽屉形态，不启用拖动（抽屉本来就是全宽贴底的标准交互）。
 * 位置写入 localStorage，刷新后保持；拖出视口时用 clamp 兜住。
 */
const DND_KEY = 'ai-guide-pos';
const isDesktopWidth = () => typeof window !== 'undefined' && window.innerWidth >= 900;
const clampNum = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));

const panelPos = reactive({ x: 0, y: 0, w: 0, h: 0, placed: false });
const dragState = reactive({ active: false, dx: 0, dy: 0 });
const resizeState = reactive({ active: false, startX: 0, startY: 0, startW: 0, startH: 0 });
const fabPos = reactive({ x: 0, y: 0, moved: false });
const fabDrag = reactive({ active: false, dx: 0, dy: 0, far: false });
/**
 * 本次打开期间用户是否真的拖动过面板。
 * 只有拖过才在关闭时把悬浮球挪过去——否则「打开锚定球 → 关闭球跟面板」会互相推，
 * 单纯开关窗口就足以让球一轮一轮地漂移。
 */
let panelDragged = false;

const panelStyle = computed(() => {
  if (!panelPos.placed) return {};
  const style = {
    left: `${panelPos.x}px`,
    top: `${panelPos.y}px`,
    right: 'auto',
    bottom: 'auto',
    transform: 'none',
  };
  /*
   * 拖动/锚定后 right、bottom 会被复位，尺寸改由内容决定（看着突然小一截）；
   * 把实际宽高固定下来，窗口形状与拖动前一致；右下角 resize 也复用这两个值。
   */
  if (panelPos.w) style.width = `${panelPos.w}px`;
  if (panelPos.h) style.height = `${panelPos.h}px`;
  return style;
});
const fabStyle = computed(() => (
  fabPos.moved ? { transform: `translate(${fabPos.x}px, ${fabPos.y}px)` } : {}
));

const loadPos = () => {
  try {
    const raw = window.localStorage.getItem(DND_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) || {};
    if (Number.isFinite(data.fabX) && Number.isFinite(data.fabY)) {
      fabPos.x = data.fabX;
      fabPos.y = data.fabY;
      fabPos.moved = Boolean(data.fabX || data.fabY);
    }
    // 面板只记住用户调过的尺寸；位置每次打开都重新锚定悬浮球，保持两者关联
    if (Number.isFinite(data.panelW)) panelPos.w = data.panelW;
    if (Number.isFinite(data.panelH)) panelPos.h = data.panelH;
  } catch {
    // 本地数据损坏或不可写时忽略，用默认位置
  }
};

const savePos = () => {
  try {
    window.localStorage.setItem(DND_KEY, JSON.stringify({
      fabX: fabPos.x,
      fabY: fabPos.y,
      panelW: panelPos.w || null,
      panelH: panelPos.h || null,
    }));
  } catch {
    // 隐私模式写入失败，忽略
  }
};

/** 打开面板时把它锚定到悬浮球附近：优先在球的上方，空间不够就落到球的下方 */
const anchorPanelToFab = (fabRect) => {
  const panel = panelRef.value;
  const fallbackFab = fabRef.value;
  const f = fabRect || (fallbackFab ? fallbackFab.getBoundingClientRect() : null);
  if (!panel || !f || !isDesktopWidth()) return;
  // 用 offsetWidth/Height 而不是 rect：进入过渡里 transform 会让 rect 带位移
  const pw = panel.offsetWidth || 420;
  const ph = panel.offsetHeight || 560;
  const maxLeft = Math.max(8, window.innerWidth - pw - 8);
  let left = f.left + f.width / 2 - pw / 2;
  // 球贴近右边界时，居中会越界；此时改为「面板右边贴球右边」，视觉上仍然挨着球
  if (left > maxLeft) left = f.right - pw;
  let top = f.top - ph - 12;
  if (top < 8) top = f.bottom + 12;
  panelPos.x = clampNum(left, 8, maxLeft);
  panelPos.y = clampNum(top, 8, Math.max(8, window.innerHeight - ph - 8));
  panelPos.w = pw;
  panelPos.h = ph;
  panelPos.placed = true;
};

const onDragMove = (e) => {
  if (!dragState.active) return;
  panelDragged = true;
  const panelW = panelRef.value?.offsetWidth || 420;
  const panelH = panelRef.value?.offsetHeight || 560;
  panelPos.x = clampNum(e.clientX - dragState.dx, 8, Math.max(8, window.innerWidth - panelW - 8));
  panelPos.y = clampNum(e.clientY - dragState.dy, 8, Math.max(8, window.innerHeight - panelH - 8));
};

const onResizeMove = (e) => {
  if (!resizeState.active) return;
  panelPos.w = clampNum(
    resizeState.startW + (e.clientX - resizeState.startX),
    300,
    Math.max(300, window.innerWidth - panelPos.x - 8),
  );
  panelPos.h = clampNum(
    resizeState.startH + (e.clientY - resizeState.startY),
    260,
    Math.max(260, window.innerHeight - panelPos.y - 8),
  );
};

const onResizeEnd = () => {
  resizeState.active = false;
  window.removeEventListener('pointermove', onResizeMove);
  savePos();
};

const onResizeStart = (e) => {
  if (!isDesktopWidth()) return;
  const panel = panelRef.value;
  if (!panel) return;
  resizeState.active = true;
  resizeState.startX = e.clientX;
  resizeState.startY = e.clientY;
  resizeState.startW = panel.offsetWidth;
  resizeState.startH = panel.offsetHeight;
  e.currentTarget.setPointerCapture?.(e.pointerId);
  window.addEventListener('pointermove', onResizeMove);
  window.addEventListener('pointerup', onResizeEnd, { once: true });
};

const onDragEnd = () => {
  dragState.active = false;
  window.removeEventListener('pointermove', onDragMove);
  savePos();
};

const onDragStart = (e) => {
  if (!isDesktopWidth()) return;
  if (typeof e.button === 'number' && e.button !== 0) return;
  const panel = e.currentTarget.closest('.ai-panel');
  if (!panel) return;
  if (!panelPos.placed) {
    // 把「右侧固定窗」的定位固化成 left/top + 固定高度，之后直接改坐标即可
    const rect = panel.getBoundingClientRect();
    panelPos.x = rect.left;
    panelPos.y = rect.top;
    panelPos.h = rect.height;
    panelPos.placed = true;
  }
  dragState.active = true;
  dragState.dx = e.clientX - panelPos.x;
  dragState.dy = e.clientY - panelPos.y;
  e.currentTarget.setPointerCapture?.(e.pointerId);
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd, { once: true });
};

const onFabUp = () => {
  fabDrag.active = false;
  window.removeEventListener('pointermove', onFabMove);
  if (fabDrag.far) savePos();
};

const onFabMove = (e) => {
  if (!fabDrag.active) return;
  const nx = e.clientX - fabDrag.dx;
  const ny = e.clientY - fabDrag.dy;
  if (Math.abs(nx - fabPos.x) > 4 || Math.abs(ny - fabPos.y) > 4) fabDrag.far = true;
  fabPos.x = clampNum(nx, -(window.innerWidth - 140), 0);
  fabPos.y = clampNum(ny, -(window.innerHeight - 140), 0);
  fabPos.moved = Boolean(fabPos.x || fabPos.y);
};

const onFabDown = (e) => {
  if (typeof e.button === 'number' && e.button !== 0) return;
  fabDrag.active = true;
  fabDrag.far = false;
  fabDrag.dx = e.clientX - fabPos.x;
  fabDrag.dy = e.clientY - fabPos.y;
  e.currentTarget.setPointerCapture?.(e.pointerId);
  window.addEventListener('pointermove', onFabMove);
  window.addEventListener('pointerup', onFabUp, { once: true });
};

/** 拖动结束后浏览器仍会派发 click，这里把「刚拖过」的那次忽略掉 */
const openGuideIfNotDragged = () => {
  if (fabDrag.far) {
    fabDrag.far = false;
    return;
  }
  openGuide();
};

onMounted(() => {
  loadPos();
  window.addEventListener(REGION_CHANGE_EVENT, onRegionChange);
});

onBeforeUnmount(() => {
  clearNavTimer();
  stopSpeak();
  stopTypewriter();
  window.removeEventListener(REGION_CHANGE_EVENT, onRegionChange);
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointermove', onFabMove);
  window.removeEventListener('pointermove', onResizeMove);
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
  /* 可拖动：阻止拖拽时触发页面滚动/文本选择 */
  touch-action: none;
  user-select: none;
  transition: box-shadow 0.16s ease;
}

.ai-fab.dragging {
  cursor: grabbing;
  box-shadow: 0 calc(12 * var(--rpx)) calc(32 * var(--rpx)) rgba(0, 0, 0, 0.55),
    0 0 calc(28 * var(--rpx)) rgba(255, 179, 0, 0.5);
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

/* 桌面端右下角的缩放手柄（移动端隐藏：抽屉形态不适用） */
.resize-handle {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 20px;
  height: 20px;
  cursor: nwse-resize;
  touch-action: none;
  z-index: 6;
}

.resize-handle::before {
  content: '';
  position: absolute;
  right: 5px;
  bottom: 5px;
  width: 9px;
  height: 9px;
  border-right: 2px solid rgba(212, 175, 55, 0.5);
  border-bottom: 2px solid rgba(212, 175, 55, 0.5);
  border-radius: 0 0 3px 0;
}

.resize-handle:hover::before {
  border-color: #ffb300;
}

@media (max-width: 899px) {
  .resize-handle {
    display: none;
  }
}

/*
 * 桌面端：把「贴底抽屉」升级成可拖动的浮动窗。
 * 默认居中，加上 .positioned（拖动过后）即由内联 left/top 接管位置。
 * 移动端不套用这些规则，保持抽屉形态。
 */
@media (min-width: 900px) {
  /*
   * 桌面端默认布局由文件末尾的媒体查询定义（右侧固定窗：top/right/bottom 24px + 固定宽 420px）。
   * 这里只处理「拖动之后」：用 .positioned + 内联 left/top 接管位置，
   * 必须把 right/bottom/transform 一并复位，否则两端固定会把面板拉成怪尺寸。
   */
  .ai-panel.positioned {
    top: 0;
    left: 0;
    right: auto;
    bottom: auto;
    transform: none;
  }

  .ai-head {
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .ai-panel.dragging .ai-head {
    cursor: grabbing;
  }
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

/* 空对话：整块（标题 + 说明 + 推荐词）在消息区垂直居中 */
.ai-msgs.empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-msgs.empty .ai-empty {
  width: 100%;
  /*
   * 视觉上略上移：消息区下方还压着「隐私说明 + 输入框」，
   * 纯几何居中看起来会偏下，这里整体上提约 65px（仅视觉偏移，不影响布局）。
   */
  transform: translateY(calc(-100 * var(--rpx)));
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
  /* 新气泡进入动画：发送与回复都淡入并轻微上移 */
  animation: msgIn 0.26s cubic-bezier(0.22, 0.8, 0.3, 1) both;
}

@keyframes msgIn {
  from {
    opacity: 0;
    transform: translateY(calc(12 * var(--rpx)));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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
  /* 已移入消息流末尾，不再单独占一条带分割线的固定栏 */
  margin: calc(6 * var(--rpx)) 0 calc(4 * var(--rpx));
  animation: msgIn 0.26s cubic-bezier(0.22, 0.8, 0.3, 1) both;
}

/* 首次打开（空对话）时推荐词水平居中 */
.ai-quick.centered {
  justify-content: center;
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

/*
 * 「讲解当前页」只是众多推荐提示词中的一个，不应有选中/高亮样式；
 * 保留 .narrate 类名仅用于无障碍/测试定位，视觉与其它 .quick 完全一致。
 */
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
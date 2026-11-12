<!--
  实现功能：知识挑战答题页（Web 版）
  职责：一轮多题（默认 5 题）的皮影知识选择题：进度条 → 题板 → 选项作答 → 即时判定（妙极/遗憾印章）
        → 解析面板 → 下一题 → 结果面板（得分/答对率）→ 再出一轮。
        题目优先由 POST /api/ai/quiz 动态生成（含解析，服务端安全复核 + JSON 校验），
        不可用时自动回落展馆题库 GET /quiz/questions/random；素材取自 artAssets.quiz.*。
  与源工程的差异：
    - uni onLoad → onMounted；uni.navigateBack → router.back()（无页面栈时回落 /display）
    - view/text/image → div/span/img；选项由可点 view 升级为真实 button（键盘可操作，已判分后禁用）
    - 状态机沿用源码语义，把源码的 'playing' 命名为 'answering'（同一状态：等待作答）
    - 后端 category 下发英文枚举（general），展示前做轻量本地化，避免中英混排；
      normalizeQuestion 里 type 的回落链原样保留
    - 宽屏（CONVENTIONS §8）：答题板在 ≥900px 变「题板 | 选项」两栏，解析面板居中限宽，
      移动端仍是源码的单列布局
-->
<template>
  <ArtPageShell :bg="artAssets.quiz.bg" scroll overlay="rgba(12, 6, 4, 0.2)">
    <div class="quiz-page">
      <ArtTopBar title="知识挑战" theme="dark" back-text="返回" />

      <ArtStatus v-if="status === 'loading'" title="AI 正在出题" description="正在依据展馆资料生成题目与解析，随后会做安全复核" />

      <div v-else-if="status === 'error'" class="quiz-empty">
        <ArtStatus type="error" title="暂无题目数据" description="AI 出题与展馆题库均不可用，请稍后重试" />
        <ArtButton class="reload-button" text="重新加载" size="medium" @click="fetchQuestions" />
      </div>

      <div v-else-if="(status === 'answering' || status === 'submitted') && currentQ" class="quiz-content">
        <div v-if="source" class="quiz-meta">
          <span class="source-chip" :class="{ bank: source === 'bank' }">{{ sourceLabel }}</span>
          <span v-if="isAiGenerated" class="source-note">AI 生成内容 · 已安全复核 · 仅供学习</span>
          <span v-else-if="aiFallback" class="source-note">AI 出题暂不可用，已使用展馆 curated 题目</span>
        </div>

        <div class="quiz-board">
          <div class="progress-box" :style="{ backgroundImage: `url(${artAssets.quiz.progress})` }">
            <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
            <span class="progress-text">第 {{ currentIndex + 1 }} / {{ questionList.length }} 题</span>
          </div>

          <div class="question-card" :style="{ backgroundImage: `url(${artAssets.quiz.question})` }">
            <span class="question-type">{{ questionType }}</span>
            <span class="question-title">{{ currentQ.title }}</span>
          </div>

          <div class="options-list">
            <button
              v-for="opt in currentQ.options"
              :key="opt.label"
              type="button"
              class="option-item"
              :class="{ dimmed: status === 'submitted' && opt.label !== selectedOption && opt.label !== currentQ.answer }"
              :style="{ backgroundImage: `url(${optionBg(opt.label)})` }"
              :disabled="status === 'submitted'"
              @click="handleSelect(opt.label)"
            >
              <span class="option-label">{{ opt.label }}</span>
              <span class="option-text">{{ opt.text }}</span>
            </button>
          </div>

          <div
            v-if="status === 'submitted'"
            class="explanation-panel"
            :style="{ backgroundImage: `url(${artAssets.quiz.explanation})` }"
          >
            <div :key="`${currentQ.id}-${selectedOption}`" class="stamp-drop" :class="{ wrong: !isCorrect }">
              <div class="stamp-shadow"></div>
              <img
                class="stamp-img"
                :src="isCorrect ? artAssets.quiz.stampCorrect : artAssets.quiz.stampWrong"
                alt=""
              />
              <span class="stamp-text">{{ stampText }}</span>
            </div>
            <span class="exp-title">{{ isCorrect ? '回答正确' : '再看一眼' }}</span>
            <span class="exp-answer">正确答案：{{ currentQ.answer }}</span>
            <span class="exp-badge">{{ explanationBadge }}</span>
            <span class="exp-content">{{ currentQ.explanation }}</span>
            <ArtButton
              class="next-button"
              size="medium"
              :text="currentIndex === questionList.length - 1 ? '查看结果' : '下一题'"
              @click="nextQuestion"
            />
          </div>
        </div>
      </div>

      <div
        v-else-if="status === 'finished'"
        class="result-panel"
        :style="{ backgroundImage: `url(${artAssets.quiz.result})` }"
      >
        <span class="result-title">挑战完成</span>
        <span class="result-score">{{ score }} / {{ questionList.length }}</span>
        <span class="result-desc">答对率 {{ scorePercent }}%。继续游览展示页，可以把答案背后的工艺与流派串起来。</span>
        <span v-if="sourceLabel" class="result-source">本轮题目：{{ sourceLabel }}</span>
        <ArtButton class="result-btn" text="再出一轮" size="medium" @click="fetchQuestions" />
        <ArtButton class="result-btn" text="返回展示" variant="secondary" size="medium" @click="goBack" />
      </div>
    </div>
  </ArtPageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import request from '@/api/index.js';
import ArtPageShell from '@/components/art-v2/ArtPageShell.vue';
import ArtTopBar from '@/components/art-v2/ArtTopBar.vue';
import ArtButton from '@/components/art-v2/ArtButton.vue';
import ArtStatus from '@/components/art-v2/ArtStatus.vue';
import { artAssets } from '@/config/artAssets.js';
import { generateQuiz } from '@/api/ai.js';
import { getCurrentRegion } from '@/utils/navigation.js';
import { playPageSlide } from '@/utils/pageSlide.js';

const router = useRouter();

/**
 * 状态机（沿用源码语义）：
 *   loading    拉题中
 *   answering  等待作答（源码里的 playing）
 *   submitted  已判分、展示解析
 *   finished   本轮结束、展示结果面板
 *   error      拉题失败
 */
const questionList = ref([]);
const currentIndex = ref(0);
const selectedOption = ref('');
const status = ref('loading');
const score = ref(0);
const source = ref('');
const aiFallback = ref(false);

const currentQ = computed(() => questionList.value[currentIndex.value] || null);
const isCorrect = computed(() => Boolean(currentQ.value) && selectedOption.value === currentQ.value.answer);
const stampText = computed(() => (isCorrect.value ? '妙极' : '遗憾'));
const progressPercent = computed(() => {
  const total = questionList.value.length;
  if (!total) return 0;
  /*
   * 进度条语义：首题留空、末题填满。
   * 原实现沿用源码的 (currentIndex + 1) / total，导致第 1 题就显示 20%，
   * 且题目总数不是 5（AI 动态出题可能只给 3~4 道）时，会让人误以为「第 4 题就满了」。
   * 改为按「题号在 0..total-1 区间内的位置」取值：0% → 25% → 50% → 75% → 100%。
   */
  if (total === 1) return 100;
  return Math.round((currentIndex.value / (total - 1)) * 100);
});
const scorePercent = computed(() => {
  if (!questionList.value.length) return 0;
  return Math.round((score.value / questionList.value.length) * 100);
});

const isAiGenerated = computed(() => source.value === 'ai' && !aiFallback.value);
const sourceLabel = computed(() => {
  if (source.value === 'bank') return '展馆题库';
  if (source.value === 'ai') return aiFallback.value ? 'AI 出题兜底' : 'AI 动态出题';
  return '';
});
const explanationBadge = computed(() => (isAiGenerated.value ? 'AI 生成解析' : '题库解析'));

/**
 * 后端 quiz_questions.category 目前是英文枚举（general），源码直接渲染会出现中英混排；
 * 这里只做展示层本地化，未知值原样透出，normalizeQuestion 的 type 回落链保持不变。
 */
const QUESTION_TYPE_LABELS = {
  general: '皮影知识',
  history: '历史源流',
  craft: '制作工艺',
  region: '地域流派',
  repertoire: '经典剧目',
  music: '唱腔乐器',
};
const questionType = computed(() => {
  const raw = String(currentQ.value?.type || '').trim();
  if (!raw) return '皮影知识';
  return QUESTION_TYPE_LABELS[raw.toLowerCase()] || raw;
});

const normalizeQuestion = (item, index) => ({
  id: item.id || `question-${index}`,
  type: item.type || item.category || '皮影知识',
  title: item.questionText || item.question || item.title || '题目加载失败',
  options: Array.isArray(item.options)
    ? item.options.map((text, idx) => ({ label: ['A', 'B', 'C', 'D'][idx], text }))
    : [
        { label: 'A', text: item.optionA },
        { label: 'B', text: item.optionB },
        { label: 'C', text: item.optionC },
        { label: 'D', text: item.optionD },
      ].filter((opt) => opt.text),
  answer: item.correctAnswer || item.answer || 'A',
  explanation: item.explanation || item.analysis || '暂无解析。',
});

const resetRound = (list) => {
  questionList.value = list;
  currentIndex.value = 0;
  selectedOption.value = '';
  score.value = 0;
  status.value = 'answering';
};

const fetchQuestions = async () => {
  status.value = 'loading';
  questionList.value = [];
  source.value = '';
  aiFallback.value = false;

  // 1) AI 动态出题：服务端做安全复核与严格 JSON 校验；不可用时返回 curated 种子题
  try {
    const data = await generateQuiz({ count: 5, region: getCurrentRegion() || '' });
    const list = Array.isArray(data?.questions) ? data.questions : [];
    if (list.length) {
      source.value = 'ai';
      aiFallback.value = data.fallback === true || data.mode === 'curated';
      resetRound(list.map(normalizeQuestion));
      return;
    }
  } catch (err) {
    /* AI 服务不可用，继续回落展馆题库 */
  }

  // 2) 兜底：展馆题库（shim /quiz/questions/random）
  try {
    const res = await request({ url: '/quiz/questions/random' });
    const data = res && res.code === 200 ? res.data : res?.data || res;
    if (Array.isArray(data) && data.length) {
      source.value = 'bank';
      resetRound(data.map(normalizeQuestion));
      return;
    }
  } catch (err) {
    /* 两种来源都失败 */
  }

  status.value = 'error';
};

const handleSelect = (label) => {
  if (status.value !== 'answering' || !currentQ.value) return;
  selectedOption.value = label;
  if (label === currentQ.value.answer) {
    score.value += 1;
  }
  status.value = 'submitted';
};

const nextQuestion = () => {
  if (currentIndex.value < questionList.value.length - 1) {
    currentIndex.value += 1;
    selectedOption.value = '';
    status.value = 'answering';
  } else {
    status.value = 'finished';
  }
};

/** 等价于 uni.navigateBack：有页面栈就返回，直接打开 /quiz 时回落展示页
 *  返回走「影人推移」的反向，与从展示页推入的动效对称 */
const goBack = () => {
  // 全站跳转都用 router.replace，SPA 自身不产生历史记录；
  // 用 history.state.back 判断上一条是否站内页面，避免从外链进入时 back 退出网站。
  playPageSlide('back', () => {
    if (window.history.state?.back) router.back();
    else router.replace('/display');
  });
};

const optionBg = (label) => {
  if (!currentQ.value) return artAssets.quiz.optionDefault;
  if (status.value === 'submitted' && label === currentQ.value.answer) return artAssets.quiz.optionCorrect;
  if (status.value === 'submitted' && label === selectedOption.value && label !== currentQ.value.answer) {
    return artAssets.quiz.optionWrong;
  }
  if (label === selectedOption.value) return artAssets.quiz.optionSelected;
  return artAssets.quiz.optionDefault;
};

onMounted(fetchQuestions);
</script>

<style scoped>
.quiz-page {
  min-height: 100%;
  padding-bottom: 44rpx;
}

/* ---------- 加载失败 ---------- */
.quiz-empty {
  padding: 24rpx 28rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.reload-button {
  margin-top: 10rpx;
}

/* ---------- 出题来源与解析标注 ---------- */
.quiz-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14rpx;
  margin: 0 0 18rpx;
}

.source-chip {
  padding: 8rpx 20rpx;
  border: 1rpx solid rgba(212, 175, 55, 0.6);
  border-radius: 999rpx;
  background: rgba(178, 58, 46, 0.16);
  color: #ffb300;
  font-size: 24rpx;
  font-weight: 700;
}

.source-chip.bank {
  border-color: rgba(255, 248, 225, 0.4);
  background: rgba(43, 26, 22, 0.4);
  color: rgba(255, 248, 225, 0.82);
}

.source-note {
  color: rgba(255, 248, 225, 0.62);
  font-size: 22rpx;
  line-height: 1.4;
}

.exp-badge {
  display: inline-block;
  margin-top: 14rpx;
  padding: 4rpx 16rpx;
  border: 1rpx solid rgba(178, 58, 46, 0.4);
  border-radius: 999rpx;
  background: rgba(178, 58, 46, 0.1);
  color: #b23a2e;
  font-size: 22rpx;
  font-weight: 700;
}

.result-source {
  display: block;
  margin-top: 18rpx;
  color: #8d6e63;
  font-size: 24rpx;
}

/* ---------- 答题区 ---------- */
.quiz-content {
  padding: 18rpx 28rpx 0;
}

.quiz-board {
  display: block;
}

/* 进度条底图 620x80；内部轨道按同一比例定位，桌面放大时不会跑位 */
.progress-box {
  position: relative;
  width: 620rpx;
  height: 80rpx;
  margin: 0 auto 22rpx;
  padding: 22rpx 56rpx;
  box-sizing: border-box;
  overflow: hidden;
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

.progress-fill {
  position: absolute;
  left: 58rpx;
  top: 34rpx;
  height: 12rpx;
  max-width: 504rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, #b23a2e, #ffb300);
  transition: width 0.25s ease;
}

.progress-text {
  position: relative;
  z-index: 2;
  display: block;
  color: #fff8e1;
  font-size: 24rpx;
  line-height: 1;
  text-align: center;
  text-shadow: 0 3rpx 8rpx rgba(0, 0, 0, 0.75);
}

.question-card {
  width: 100%;
  min-height: 380rpx;
  padding: 76rpx 68rpx 58rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

.question-type {
  align-self: flex-start;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(178, 58, 46, 0.14);
  color: #b23a2e;
  font-size: 24rpx;
  font-weight: 700;
}

.question-title {
  display: block;
  margin-top: 26rpx;
  color: #2b1a16;
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1.55;
}

.options-list {
  margin-top: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

/* 选项：源码是可点 view，这里用原生 button（键盘可达），故重置 UA 样式 */
.option-item {
  width: 100%;
  min-height: 104rpx;
  padding: 18rpx 46rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  border: 0;
  border-radius: 0;
  appearance: none;
  background-color: transparent;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.option-item:active {
  transform: scale(0.985);
}

.option-item:disabled {
  transform: none;
  cursor: default;
}

.option-item.dimmed {
  opacity: 0.62;
}

.option-label {
  width: 56rpx;
  height: 56rpx;
  margin-right: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(43, 26, 22, 0.86);
  color: #ffb300;
  font-family: Arial, sans-serif;
  font-size: 26rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.option-text {
  flex: 1;
  color: #fff8e1;
  font-size: 28rpx;
  line-height: 1.42;
  text-shadow: 0 3rpx 8rpx rgba(0, 0, 0, 0.68);
}

/* ---------- 解析面板 ---------- */
.explanation-panel {
  position: relative;
  min-height: 470rpx;
  margin-top: 26rpx;
  padding: 70rpx 70rpx 42rpx;
  box-sizing: border-box;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  color: #2b1a16;
}

.stamp-drop {
  position: absolute;
  right: 38rpx;
  top: 10rpx;
  z-index: 4;
  width: 184rpx;
  height: 184rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center;
  animation: stampDrop 0.64s cubic-bezier(0.16, 1.1, 0.28, 1) both;
}

.stamp-shadow {
  position: absolute;
  left: 50%;
  bottom: 8rpx;
  width: 112rpx;
  height: 28rpx;
  border-radius: 50%;
  background: rgba(43, 26, 22, 0.22);
  transform: translateX(-50%);
  animation: stampShadow 0.64s ease-out both;
}

.stamp-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.94;
}

.stamp-text {
  position: relative;
  z-index: 2;
  color: #b23a2e;
  font-family: "STKaiti", "KaiTi", "FangSong", serif;
  font-size: 42rpx;
  font-weight: 800;
  letter-spacing: 4rpx;
  line-height: 1;
  text-shadow: 0 2rpx 0 rgba(255, 248, 225, 0.36);
  transform: rotate(-12deg);
}

.stamp-drop.wrong .stamp-text {
  color: #5d4037;
}

.exp-title,
.exp-answer,
.exp-content {
  display: block;
}

.exp-title {
  color: #b23a2e;
  font-size: 34rpx;
  font-weight: 700;
}

.exp-answer {
  margin-top: 12rpx;
  color: #5d4037;
  font-size: 26rpx;
  font-weight: 700;
}

.exp-content {
  margin-top: 18rpx;
  padding-right: 96rpx;
  color: #3e2723;
  font-size: 27rpx;
  line-height: 1.7;
}

.next-button {
  margin: 28rpx auto 0;
}

@keyframes stampDrop {
  0% {
    opacity: 0;
    transform: translateY(-300rpx) scale(1.72) rotate(-22deg);
  }
  54% {
    opacity: 1;
    transform: translateY(8rpx) scale(0.88) rotate(-9deg);
  }
  68% {
    transform: translateY(-18rpx) scale(1.08) rotate(-14deg);
  }
  82% {
    transform: translateY(0) scale(0.98) rotate(-11deg);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(-12deg);
  }
}

@keyframes stampShadow {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.25);
  }
  54% {
    opacity: 0.6;
    transform: translateX(-50%) scale(1.12);
  }
  100% {
    opacity: 0.3;
    transform: translateX(-50%) scale(1);
  }
}

/* ---------- 结果面板 ---------- */
.result-panel {
  width: 760rpx;
  min-height: 860rpx;
  margin: 34rpx auto 0;
  padding: 108rpx 84rpx 70rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
  color: #2b1a16;
}

.result-title {
  color: #b23a2e;
  font-size: 48rpx;
  font-weight: 800;
}

.result-score {
  margin-top: 48rpx;
  color: #3e2723;
  font-size: 92rpx;
  font-weight: 800;
  line-height: 1;
}

.result-desc {
  margin-top: 34rpx;
  color: #5d4037;
  font-size: 28rpx;
  line-height: 1.7;
  text-align: center;
}

.result-btn {
  margin-top: 34rpx;
}

/*
 * 宽屏：题板与选项分左右两栏——单列铺满 1440px 会把 760x104 的选项底图拉成细长条；
 * 分栏后选项宽高比回到素材本身的 7.3:1，题板保持 820x420 的纸卷比例。
 * 解析面板横跨两栏但限宽居中，避免 820x520 的纸卷被拉扁。
 */
@media (min-width: 900px) {
  .quiz-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 26px 36px 0;
  }

  .quiz-board {
    display: grid;
    grid-template-columns: minmax(0, 1.06fr) minmax(0, 0.94fr);
    gap: 26px 36px;
    align-items: stretch;
  }

  .progress-box {
    grid-column: 1 / -1;
    justify-self: center;
    width: min(100%, 720px);
    height: 92px;
    margin: 0 0 4px;
    padding: 0 64px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .progress-fill {
    left: 9.35%;
    top: 42.5%;
    height: 15%;
    max-width: 81.3%;
  }

  .progress-text {
    font-size: 16px;
  }

  .question-card {
    grid-column: 1;
    grid-row: 2;
    min-height: 300px;
    padding: 56px 48px 44px;
  }

  .question-title {
    font-size: 25px;
  }

  .question-type {
    font-size: 15px;
    padding: 5px 12px;
  }

  .options-list {
    grid-column: 2;
    grid-row: 2;
    margin-top: 0;
  }

  .option-item {
    min-height: 74px;
    padding: 12px 30px;
  }

  .option-label {
    width: 40px;
    height: 40px;
    margin-right: 16px;
    font-size: 17px;
  }

  .option-text {
    font-size: 18px;
  }

  .explanation-panel {
    grid-column: 1 / -1;
    justify-self: center;
    width: min(100%, 780px);
    margin-top: 0;
  }

  .result-panel {
    width: 560px;
    min-height: 640px;
  }
}
</style>

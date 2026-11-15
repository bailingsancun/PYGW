<!--
  实现功能：AI 图片转皮影工坊（身入影幕 · 幕后「AI图片转皮影」入口）
  职责：上传人物照片 → 选快速/精致模式 → 调服务端按 piying-pipeline 的提示词约束生成零件图 →
        前端抠图分割并装到标准骨架上（无图像生成模型时由本地皮影合成器产出）→ 预览 → 采用并注册角色。
  说明：生成结果一定是「可装配的皮影文件（部件图 + manifest）」，采用后会立刻换上并注册进角色库。
  Emits：created(record) / close
-->
<template>
  <div class="ai-mask" @click.self="$emit('close')">
    <div class="ai-panel">
      <header class="ai-head">
        <span class="ai-title">AI 图片转皮影</span>
        <span class="ai-env" :class="imageReady ? 'ok' : 'warn'">{{ envLabel }}</span>
      </header>

      <template v-if="!record">
        <p class="ai-desc">
          上传一张人物照片（照片 / 插画 / 成品皮影都行）。工坊会按皮影工艺流程把它拆成可活动的关节部件，
          生成后直接注册成本地皮影形象。
        </p>

        <label
          class="ai-drop"
          :class="{ dragging }"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
          @click="pickFile"
        >
          <img v-if="previewUrl" :src="previewUrl" alt="待转换的照片" />
          <span v-else class="ai-drop-hint">
            点击选择照片，或把图片拖到这里
            <em>JPG / PNG / WebP，建议全身或半身清晰人像</em>
          </span>
          <input ref="fileInput" type="file" accept="image/*" hidden @change="onFileChange" />
        </label>

        <div class="ai-field">
          <label class="ai-label" for="ai-title">角色名（可选）</label>
          <input id="ai-title" v-model="title" class="ai-input" maxlength="16" placeholder="例如：红脸武净" />
        </div>

        <div class="ai-modes">
          <button type="button" :class="{ on: mode === 'fast' }" @click="mode = 'fast'">
            <b>快速</b><span>单张零件图 · 十几秒</span>
          </button>
          <button type="button" :class="{ on: mode === 'refined' }" @click="mode = 'refined'">
            <b>精致</b><span>定妆图 + 零件图 · 更细的甲纹</span>
          </button>
        </div>

        <p class="ai-note">
          {{ modeNote }}
        </p>

        <button type="button" class="ai-primary" :disabled="!file || busy" @click="generate">
          {{ busy ? '生成中…' : '开始生成' }}
        </button>
      </template>

      <template v-else>
        <div class="ai-result">
          <div ref="previewMount" class="ai-preview"></div>
          <div class="ai-result-info">
            <p class="ai-result-title">{{ record.title }}</p>
            <p class="ai-meta">{{ record.meta?.message }}</p>
            <p class="ai-meta dim">{{ record.notes }}</p>
            <ul v-if="record.meta?.partsSheet" class="ai-facts">
              <li>零件图 {{ record.meta.partsSheet.width }}×{{ record.meta.partsSheet.height }}</li>
              <li>识别出 {{ record.meta.partsSheet.count }} 块独立部件</li>
              <li>模式：{{ record.meta.mode === 'refined' ? '精致' : '快速' }}</li>
            </ul>
          </div>
        </div>
        <div class="ai-actions">
          <button type="button" class="ai-primary" @click="$emit('created', record)">采用这个形象</button>
          <button type="button" class="ai-ghost" @click="reset">重新生成</button>
        </div>
      </template>

      <p v-if="progressText" class="ai-progress">{{ progressText }}</p>
      <p v-if="errorText" class="ai-error">{{ errorText }}</p>

      <button type="button" class="ai-close" @click="$emit('close')">关闭</button>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { createRig } from '@/piying/rig-engine.js';
import { generateAiCharacter } from '@/piying/ai/curtainAi.js';

const emit = defineEmits(['created', 'close']);

const fileInput = ref(null);
const previewMount = ref(null);
const file = ref(null);
const previewUrl = ref('');
const title = ref('');
const mode = ref('fast');
const busy = ref(false);
const dragging = ref(false);
const progressText = ref('');
const errorText = ref('');
const record = ref(null);
const imageReady = ref(false);

let previewRig = null;
let aiAbort = null;

const envLabel = computed(() =>
  imageReady.value ? '当前环境：图像生成模型 已配置' : '当前环境：未配置图像生成模型（走本地皮影合成）',
);

const modeNote = computed(() =>
  mode.value === 'fast'
    ? '快速模式：只生成一张零件图，直接装配，适合先看效果。'
    : '精致模式：先出定妆图再出零件图，甲纹与配色更讲究，耗时也更长。',
);

function pickFile() {
  fileInput.value?.click();
}

function acceptFile(nextFile) {
  errorText.value = '';
  if (!nextFile) return;
  if (!/^image\//.test(nextFile.type || '')) {
    errorText.value = '只能上传图片文件（JPG / PNG / WebP）';
    return;
  }
  if (nextFile.size > 12 * 1024 * 1024) {
    errorText.value = '图片太大了（上限 12MB），请先压缩再上传';
    return;
  }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  file.value = nextFile;
  previewUrl.value = URL.createObjectURL(nextFile);
}

function onFileChange(event) {
  acceptFile(event.target.files?.[0]);
  if (fileInput.value) fileInput.value.value = '';
}

function onDrop(event) {
  dragging.value = false;
  acceptFile(event.dataTransfer?.files?.[0]);
}

function reset() {
  teardownPreview();
  record.value = null;
  errorText.value = '';
  progressText.value = '';
}

function teardownPreview() {
  if (previewRig) {
    previewRig.destroy();
    previewRig = null;
  }
  if (previewMount.value) previewMount.value.innerHTML = '';
}

async function renderPreview(character) {
  await nextTick();
  teardownPreview();
  if (!previewMount.value || !character) return;
  try {
    previewRig = createRig(previewMount.value, character.manifest, {
      handles: false,
      interactive: false,
      keyTarget: new EventTarget(),
      extraBottom: 96,
    });
    previewRig.setPose('rest');
    await previewRig.ready();
    const frame = previewMount.value.getBoundingClientRect();
    previewRig.fit({ width: frame.width || 320, height: frame.height || 360 });
    previewRig.setIdle(true);
  } catch (error) {
    console.warn('[piying] 预览装配失败', error);
  }
}

async function generate() {
  if (!file.value || busy.value) return;
  busy.value = true;
  errorText.value = '';
  progressText.value = '准备中…';
  aiAbort = new AbortController();
  try {
    const result = await generateAiCharacter({
      file: file.value,
      mode: mode.value,
      title: title.value,
      signal: aiAbort.signal,
      onProgress: (stage, text) => {
        progressText.value = text;
      },
    });
    record.value = result;
    progressText.value = '';
    await renderPreview(result);
  } catch (error) {
    progressText.value = '';
    if (error?.code === 'PIYING_REFUSED') {
      errorText.value = `暂时不能生成：${error.message}（请换一张能看清头部、躯干和至少两条肢体的人物图）`;
    } else {
      errorText.value = error?.message || '生成失败，请稍后再试';
    }
  } finally {
    aiAbort = null;
    busy.value = false;
  }
}

async function checkHealth() {
  try {
    const response = await fetch('/api/ai/health', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const payload = await response.json();
    const data = payload?.data || payload;
    imageReady.value = Boolean(data?.piyingImage);
  } catch {
    imageReady.value = false;
  }
}

onMounted(() => {
  checkHealth();
});

onBeforeUnmount(() => {
  aiAbort?.abort();
  teardownPreview();
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});
</script>

<style scoped>
.ai-mask {
  position: absolute;
  inset: 0;
  z-index: 75;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(30 * var(--rpx));
  background: rgba(4, 2, 1, 0.78);
  backdrop-filter: blur(2px);
}

.ai-panel {
  position: relative;
  width: min(96%, calc(720 * var(--rpx)));
  max-height: 94%;
  overflow-y: auto;
  padding: calc(24 * var(--rpx)) calc(28 * var(--rpx)) calc(28 * var(--rpx));
  box-sizing: border-box;
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.44);
  border-radius: calc(16 * var(--rpx));
  background: linear-gradient(180deg, rgba(44, 26, 14, 0.98), rgba(16, 9, 4, 0.99));
  box-shadow: 0 calc(30 * var(--rpx)) calc(80 * var(--rpx)) rgba(0, 0, 0, 0.6);
  color: #fff8e1;
}

.ai-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: calc(12 * var(--rpx));
  padding-bottom: calc(12 * var(--rpx));
  border-bottom: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.26);
}

.ai-title {
  color: #ffe9bd;
  font-family: var(--art-font-title);
  font-size: calc(36 * var(--rpx));
  letter-spacing: calc(3 * var(--rpx));
}

.ai-env {
  font-size: calc(18 * var(--rpx));
  letter-spacing: calc(1 * var(--rpx));
}

.ai-env.ok {
  color: rgba(160, 226, 160, 0.86);
}

.ai-env.warn {
  color: rgba(255, 214, 138, 0.7);
}

.ai-desc {
  margin: calc(14 * var(--rpx)) 0;
  color: rgba(255, 248, 225, 0.78);
  font-size: calc(22 * var(--rpx));
  line-height: 1.7;
}

.ai-drop {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(240 * var(--rpx));
  border: calc(2 * var(--rpx)) dashed rgba(212, 175, 55, 0.44);
  border-radius: calc(12 * var(--rpx));
  background: rgba(255, 236, 196, 0.05);
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.ai-drop.dragging {
  border-color: rgba(255, 217, 138, 0.9);
  background: rgba(255, 217, 138, 0.12);
}

.ai-drop img {
  display: block;
  max-width: 100%;
  max-height: calc(300 * var(--rpx));
  object-fit: contain;
}

.ai-drop-hint {
  display: flex;
  flex-direction: column;
  gap: calc(8 * var(--rpx));
  color: rgba(255, 233, 189, 0.72);
  font-size: calc(22 * var(--rpx));
  text-align: center;
}

.ai-drop-hint em {
  color: rgba(255, 227, 163, 0.44);
  font-size: calc(19 * var(--rpx));
  font-style: normal;
}

.ai-field {
  margin-top: calc(16 * var(--rpx));
  display: flex;
  flex-direction: column;
  gap: calc(6 * var(--rpx));
}

.ai-label {
  color: rgba(255, 227, 163, 0.66);
  font-size: calc(20 * var(--rpx));
}

.ai-input {
  width: 100%;
  padding: calc(10 * var(--rpx)) calc(14 * var(--rpx));
  box-sizing: border-box;
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.4);
  border-radius: calc(8 * var(--rpx));
  background: rgba(10, 5, 2, 0.7);
  color: #fff8e1;
  font-family: inherit;
  font-size: calc(22 * var(--rpx));
}

.ai-modes {
  display: flex;
  gap: calc(12 * var(--rpx));
  margin-top: calc(16 * var(--rpx));
}

.ai-modes button {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  gap: calc(4 * var(--rpx));
  padding: calc(12 * var(--rpx)) calc(14 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.34);
  border-radius: calc(10 * var(--rpx));
  background: rgba(24, 13, 7, 0.8);
  color: rgba(255, 233, 189, 0.8);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.ai-modes button b {
  color: #ffe9bd;
  font-size: calc(24 * var(--rpx));
  letter-spacing: calc(2 * var(--rpx));
}

.ai-modes button span {
  font-size: calc(19 * var(--rpx));
  color: rgba(255, 227, 163, 0.56);
}

.ai-modes button.on {
  border-color: rgba(255, 217, 138, 0.86);
  background: linear-gradient(180deg, rgba(120, 74, 24, 0.6), rgba(60, 34, 12, 0.8));
}

.ai-note {
  margin: calc(10 * var(--rpx)) 0 0;
  color: rgba(255, 227, 163, 0.56);
  font-size: calc(19 * var(--rpx));
  line-height: 1.6;
}

.ai-primary,
.ai-ghost {
  width: 100%;
  margin-top: calc(16 * var(--rpx));
  padding: calc(14 * var(--rpx)) 0;
  border-radius: calc(10 * var(--rpx));
  font-family: inherit;
  font-size: calc(26 * var(--rpx));
  letter-spacing: calc(2 * var(--rpx));
  cursor: pointer;
}

.ai-primary {
  border: calc(1 * var(--rpx)) solid rgba(255, 217, 138, 0.72);
  background: linear-gradient(#d59a45, #a5641a);
  color: #fff8e1;
}

.ai-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-ghost {
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.44);
  background: transparent;
  color: rgba(255, 233, 189, 0.86);
}

.ai-result {
  display: flex;
  gap: calc(18 * var(--rpx));
  margin-top: calc(16 * var(--rpx));
  align-items: stretch;
}

.ai-preview {
  flex: 0 0 calc(260 * var(--rpx));
  min-height: calc(300 * var(--rpx));
  display: flex;
  align-items: center;
  justify-content: center;
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.3);
  border-radius: calc(10 * var(--rpx));
  background: rgba(255, 236, 196, 0.06);
  overflow: hidden;
}

.ai-preview :deep(.py-stage) {
  border-radius: calc(8 * var(--rpx));
}

.ai-result-info {
  flex: 1 1 auto;
  min-width: 0;
}

.ai-result-title {
  margin: 0 0 calc(8 * var(--rpx));
  color: #ffe9bd;
  font-family: var(--art-font-title);
  font-size: calc(30 * var(--rpx));
  letter-spacing: calc(2 * var(--rpx));
}

.ai-meta {
  margin: 0 0 calc(8 * var(--rpx));
  color: rgba(255, 248, 225, 0.78);
  font-size: calc(21 * var(--rpx));
  line-height: 1.6;
}

.ai-meta.dim {
  color: rgba(255, 227, 163, 0.5);
  font-size: calc(19 * var(--rpx));
}

.ai-facts {
  margin: calc(6 * var(--rpx)) 0 0;
  padding-left: calc(30 * var(--rpx));
  color: rgba(255, 227, 163, 0.6);
  font-size: calc(19 * var(--rpx));
  line-height: 1.7;
}

.ai-actions {
  display: flex;
  gap: calc(12 * var(--rpx));
}

.ai-actions .ai-primary,
.ai-actions .ai-ghost {
  flex: 1 1 0;
  width: auto;
}

.ai-progress {
  margin: calc(12 * var(--rpx)) 0 0;
  color: rgba(255, 217, 138, 0.86);
  font-size: calc(21 * var(--rpx));
  text-align: center;
}

.ai-error {
  margin: calc(12 * var(--rpx)) 0 0;
  padding: calc(10 * var(--rpx)) calc(14 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(208, 112, 79, 0.44);
  border-radius: calc(8 * var(--rpx));
  background: rgba(90, 24, 10, 0.28);
  color: #e8b39a;
  font-size: calc(21 * var(--rpx));
  line-height: 1.6;
}

.ai-close {
  display: block;
  margin: calc(16 * var(--rpx)) auto 0;
  padding: calc(8 * var(--rpx)) calc(28 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.4);
  border-radius: calc(999 * var(--rpx));
  background: transparent;
  color: rgba(255, 227, 163, 0.7);
  font-family: inherit;
  font-size: calc(20 * var(--rpx));
  cursor: pointer;
}

@media (max-width: 600px) {
  .ai-result {
    flex-direction: column;
  }

  .ai-preview {
    flex: 0 0 calc(240 * var(--rpx));
  }
}
</style>

<!--
  实现功能：身入影幕 · 「切换本地皮影」的已注册角色选择窗口
  职责：点「切换本地皮影」先弹这个窗口，列出角色库里全部已注册角色（角色图 + 角色名 + 单选勾选），
        点一项即换上该形象；窗口右下角另放「导入其他文件」，点了才走文件夹导入流程。
  Props：characters（[{id,title,kind,thumb}]）/ current（当前角色 id）/ busy
  Emits：select(id) / import / close
-->
<template>
  <div class="picker-mask" @click.self="$emit('close')">
    <div class="picker">
      <header class="picker-head">
        <span class="picker-title">选择皮影形象</span>
        <button type="button" class="picker-close" @click="$emit('close')">关闭</button>
      </header>

      <p class="picker-desc">
        点一个角色即换上（武器仍然是主角的宝剑）；需要别的人物时用右下角「导入其他文件」。
      </p>

      <div v-if="!characters.length" class="picker-empty">角色库为空，请先导入一个人物文件夹</div>
      <div v-else class="picker-grid">
        <button
          v-for="item in characters"
          :key="item.id"
          type="button"
          class="picker-card"
          :class="{ active: item.id === current }"
          :disabled="busy"
          @click="$emit('select', item.id)"
        >
          <span class="picker-thumb">
            <img v-if="item.thumb" :src="item.thumb" :alt="item.title" draggable="false" />
            <span v-else class="picker-thumb-empty">无预览</span>
          </span>
          <span class="picker-name">{{ item.title }}</span>
          <span class="picker-meta">{{ kindLabel(item.kind) }}</span>
          <span class="picker-check" :class="{ on: item.id === current }" aria-hidden="true">
            {{ item.id === current ? '✓' : '' }}
          </span>
        </button>
      </div>

      <footer class="picker-foot">
        <span class="picker-hint">
          当前形象：{{ currentTitle }} · 共 {{ characters.length }} 个
        </span>
        <button type="button" class="picker-import" :disabled="busy" @click="$emit('import')">
          导入其他文件
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  characters: { type: Array, default: () => [] },
  current: { type: String, default: '' },
  busy: { type: Boolean, default: false },
});

defineEmits(['select', 'import', 'close']);

const currentTitle = computed(
  () => props.characters.find((item) => item.id === props.current)?.title || '—',
);

const kindLabel = (kind) => {
  if (kind === 'builtin') return '内置';
  if (kind === 'ai') return 'AI 生成';
  return '本地导入';
};
</script>

<style scoped>
.picker-mask {
  position: absolute;
  inset: 0;
  z-index: 78;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(28 * var(--rpx));
  background: rgba(4, 2, 1, 0.72);
  backdrop-filter: blur(2px);
}

.picker {
  position: relative;
  width: min(96%, calc(760 * var(--rpx)));
  max-height: 90%;
  display: flex;
  flex-direction: column;
  padding: calc(22 * var(--rpx)) calc(26 * var(--rpx)) calc(18 * var(--rpx));
  box-sizing: border-box;
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.44);
  border-radius: calc(16 * var(--rpx));
  background: linear-gradient(180deg, rgba(46, 27, 15, 0.99), rgba(18, 10, 5, 0.99));
  box-shadow: 0 calc(30 * var(--rpx)) calc(80 * var(--rpx)) rgba(0, 0, 0, 0.62);
  color: #fff8e1;
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: calc(12 * var(--rpx));
  border-bottom: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.26);
}

.picker-title {
  color: #ffe9bd;
  font-family: var(--art-font-title);
  font-size: calc(34 * var(--rpx));
  letter-spacing: calc(3 * var(--rpx));
}

.picker-close {
  padding: calc(6 * var(--rpx)) calc(18 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.44);
  border-radius: calc(999 * var(--rpx));
  background: transparent;
  color: rgba(255, 233, 189, 0.8);
  font-family: inherit;
  font-size: calc(19 * var(--rpx));
  cursor: pointer;
}

.picker-desc {
  margin: calc(12 * var(--rpx)) 0 calc(14 * var(--rpx));
  color: rgba(255, 248, 225, 0.66);
  font-size: calc(20 * var(--rpx));
  line-height: 1.6;
}

.picker-empty {
  padding: calc(30 * var(--rpx)) 0;
  color: rgba(255, 227, 163, 0.5);
  font-size: calc(21 * var(--rpx));
  text-align: center;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(calc(170 * var(--rpx)), 1fr));
  gap: calc(14 * var(--rpx));
  overflow-y: auto;
  padding: calc(2 * var(--rpx));
}

.picker-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: calc(6 * var(--rpx));
  padding: calc(12 * var(--rpx)) calc(10 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.26);
  border-radius: calc(12 * var(--rpx));
  background: rgba(255, 236, 196, 0.05);
  color: rgba(255, 233, 189, 0.86);
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease;
}

.picker-card:hover {
  border-color: rgba(255, 217, 138, 0.7);
  background: rgba(255, 236, 196, 0.1);
}

.picker-card.active {
  border-color: rgba(255, 217, 138, 0.95);
  background: rgba(255, 236, 196, 0.14);
  box-shadow: 0 0 calc(22 * var(--rpx)) rgba(255, 207, 120, 0.28);
}

.picker-card:disabled {
  opacity: 0.55;
  cursor: wait;
}

.picker-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: calc(112 * var(--rpx));
  border-radius: calc(8 * var(--rpx));
  background: radial-gradient(70% 60% at 50% 42%, #fff8e6 0%, #f4e6c8 70%, #e8d6b3 100%);
  overflow: hidden;
}

.picker-thumb img {
  max-width: 88%;
  max-height: 92%;
  object-fit: contain;
  pointer-events: none;
  filter: drop-shadow(0 calc(3 * var(--rpx)) calc(6 * var(--rpx)) rgba(80, 50, 20, 0.28));
}

.picker-thumb-empty {
  color: rgba(120, 82, 40, 0.5);
  font-size: calc(18 * var(--rpx));
}

.picker-name {
  max-width: 100%;
  min-height: calc(52 * var(--rpx));
  overflow: hidden;
  color: #ffe9bd;
  font-family: var(--art-font-title);
  font-size: calc(22 * var(--rpx));
  letter-spacing: calc(1 * var(--rpx));
  line-height: 1.25;
  text-align: center;
  /* 角色名可能带副标题（如「皮影武净 · 偃月刀」），允许两行 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
}

.picker-meta {
  color: rgba(255, 227, 163, 0.5);
  font-size: calc(17 * var(--rpx));
}

.picker-check {
  position: absolute;
  right: calc(8 * var(--rpx));
  top: calc(8 * var(--rpx));
  width: calc(28 * var(--rpx));
  height: calc(28 * var(--rpx));
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.5);
  background: rgba(10, 5, 2, 0.6);
  color: transparent;
  font-size: calc(18 * var(--rpx));
  line-height: 1;
}

.picker-check.on {
  border-color: rgba(255, 217, 138, 0.95);
  background: linear-gradient(#d59a45, #a5641a);
  color: #fff8e1;
}

.picker-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(14 * var(--rpx));
  margin-top: calc(16 * var(--rpx));
  padding-top: calc(14 * var(--rpx));
  border-top: calc(1 * var(--rpx)) solid rgba(212, 175, 55, 0.24);
}

.picker-hint {
  color: rgba(255, 227, 163, 0.5);
  font-size: calc(18 * var(--rpx));
  line-height: 1.5;
}

.picker-import {
  flex: 0 0 auto;
  padding: calc(11 * var(--rpx)) calc(26 * var(--rpx));
  border: calc(1 * var(--rpx)) solid rgba(255, 217, 138, 0.7);
  border-radius: calc(999 * var(--rpx));
  background: linear-gradient(#c98a3a, #a5641a);
  color: #fff8e1;
  font-family: var(--art-font-title);
  font-size: calc(22 * var(--rpx));
  letter-spacing: calc(2 * var(--rpx));
  cursor: pointer;
}

.picker-import:disabled {
  opacity: 0.55;
  cursor: wait;
}

@media (max-width: 900px) {
  .picker-grid {
    grid-template-columns: repeat(auto-fill, minmax(calc(120 * var(--rpx)), 1fr));
  }

  .picker-foot {
    flex-direction: column;
    align-items: stretch;
    gap: calc(10 * var(--rpx));
  }

  .picker-import {
    width: 100%;
  }
}
</style>

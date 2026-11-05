<!--
  实现功能：art-v2 状态提示（Web 版）
  职责：加载 / 空数据 / 错误三态，带旋转指示器与可选操作按钮。
  Props：type / title / description / actionText
  Events：action
-->
<template>
  <div class="art-status" :class="`type-${type}`">
    <div class="status-mark" aria-hidden="true"></div>
    <span class="status-title">{{ title }}</span>
    <span v-if="description" class="status-desc">{{ description }}</span>
    <ArtButton
      v-if="actionText"
      class="status-action"
      size="small"
      variant="secondary"
      :text="actionText"
      @click="$emit('action')"
    />
  </div>
</template>

<script setup>
import ArtButton from './ArtButton.vue';

defineProps({
  type: { type: String, default: 'loading' },
  title: { type: String, default: '加载中' },
  description: { type: String, default: '' },
  actionText: { type: String, default: '' },
});

defineEmits(['action']);
</script>

<style scoped>
.art-status {
  min-height: calc(420 * var(--rpx));
  padding: calc(80 * var(--rpx)) calc(44 * var(--rpx));
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #fff8e1;
}

.status-mark {
  width: calc(58 * var(--rpx));
  height: calc(58 * var(--rpx));
  margin-bottom: calc(22 * var(--rpx));
  border: calc(4 * var(--rpx)) solid rgba(255, 179, 0, 0.28);
  border-top-color: #ffb300;
  border-radius: 50%;
  animation: rotateMark 1s linear infinite;
}

.type-empty .status-mark,
.type-error .status-mark {
  animation: none;
  border-color: #d4af37;
  background: rgba(255, 179, 0, 0.16);
}

.type-error .status-mark {
  border-color: #b23a2e;
  background: rgba(178, 58, 46, 0.2);
}

.status-title {
  color: #ffb300;
  font-family: var(--art-font-title);
  font-size: calc(34 * var(--rpx));
  font-weight: 700;
}

.status-desc {
  margin-top: calc(14 * var(--rpx));
  color: rgba(255, 248, 225, 0.78);
  font-size: calc(26 * var(--rpx));
  line-height: 1.55;
}

.status-action {
  margin-top: calc(30 * var(--rpx));
}

@keyframes rotateMark {
  to {
    transform: rotate(360deg);
  }
}
</style>

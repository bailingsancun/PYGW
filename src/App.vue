<!--
  实现功能：根组件
  职责：应用启动时拉一次 /assets/common 填充 globalImages；渲染路由与全局 toast。
-->
<template>
  <router-view />
  <ArtToast />
  <AiGuide />
</template>

<script setup>
import { onMounted } from 'vue';
import { initImageStore } from '@/store/imageStore.js';
import ArtToast from '@/components/ArtToast.vue';
import AiGuide from '@/components/art-v2/AiGuide.vue';

onMounted(() => {
  initImageStore();
});
</script>

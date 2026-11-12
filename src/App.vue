<!--
  实现功能：根组件
  职责：应用启动时拉一次 /assets/common 填充 globalImages；渲染路由与全局 toast。
-->
<template>
  <router-view />
  <ArtToast />
  <AiGuide />
  <TransitionVeil />
  <PageFlash />
  <PageCurtain />
</template>

<script setup>
import { onMounted } from 'vue';
import { initImageStore } from '@/store/imageStore.js';
import ArtToast from '@/components/ArtToast.vue';
import AiGuide from '@/components/art-v2/AiGuide.vue';
import TransitionVeil from '@/components/art-v2/TransitionVeil.vue';
import PageFlash from '@/components/art-v2/PageFlash.vue';
import PageCurtain from '@/components/art-v2/PageCurtain.vue';

onMounted(() => {
  initImageStore();
});
</script>

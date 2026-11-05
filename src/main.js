/**
 * 实现功能：应用入口
 * 职责：创建 Vue 应用、挂载路由与全局样式。
 *       小程序 App.vue 的 onLaunch 里会 initImageStore()，Web 侧放到根组件 onMounted，
 *       因为 /assets/common 是 8 个页面的共同依赖（HANDOFF §7.2）。
 */
import { createApp } from 'vue';
import App from './App.vue';
import router from './router/index.js';
import './styles/base.css';

createApp(App).use(router).mount('#app');

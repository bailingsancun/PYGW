/**
 * 实现功能：路由表（8 条路由，对应小程序 8 个页面）
 * 职责：路径与页面组件映射、文档标题、滚动复位。
 *       小程序用 redirectTo 式跳转（页面栈只留一个），Web 侧对应 router.replace，
 *       但用户手动输入 URL / 前进后退要能用，所以仍保留历史记录。
 */
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'index',
    component: () => import('@/pages/IndexPage.vue'),
    meta: { title: '云幕皮影' },
  },
  {
    path: '/select',
    name: 'select',
    component: () => import('@/pages/SelectPage.vue'),
    meta: { title: '地图寻影' },
  },
  {
    path: '/display',
    name: 'display',
    component: () => import('@/pages/DisplayPage.vue'),
    meta: { title: '皮影展示' },
  },
  {
    path: '/process',
    name: 'process',
    component: () => import('@/pages/ProcessPage.vue'),
    meta: { title: '工艺流程' },
  },
  {
    path: '/interactive',
    name: 'interactive',
    component: () => import('@/pages/InteractivePage.vue'),
    meta: { title: '光影互动' },
  },
  {
    // 光影互动的子场景：打斗过场 + 三处 QTE 校准 + 幕后四入口
    path: '/curtain',
    name: 'curtain',
    component: () => import('@/pages/CurtainPage.vue'),
    meta: { title: '身入影幕' },
  },
  {
    path: '/quiz',
    name: 'quiz',
    component: () => import('@/pages/QuizPage.vue'),
    meta: { title: '知识挑战' },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/pages/HistoryPage.vue'),
    meta: { title: '光影溯源' },
  },
  {
    path: '/school',
    name: 'school',
    component: () => import('@/pages/SchoolPage.vue'),
    meta: { title: '地域流派' },
  },
  {
    // 兜底：未知路径回着陆页，避免白屏
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.afterEach((to) => {
  const title = to.meta?.title;
  document.title = title ? `${title} · 云幕皮影` : '云幕皮影';
});

export default router;

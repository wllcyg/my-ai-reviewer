import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/tts'
  },
  {
    path: '/tts',
    name: 'Tts',
    component: () => import('@/components/modules/TtsPanel.vue'),
    meta: {
      title: '微软语音工作台',
      group: 'tools'
    }
  },
  // 隐藏预留路由，需要时随时直接访问 URL 直达
  {
    path: '/image',
    name: 'Image',
    component: () => import('@/components/modules/ImagePanel.vue'),
    meta: {
      title: 'FLUX 极速生图',
      group: 'hidden'
    }
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('@/components/modules/SearchPanel.vue'),
    meta: {
      title: '免翻智能搜索',
      group: 'tools'
    }
  },
  {
    path: '/news',
    name: 'News',
    component: () => import('@/components/modules/NewsPanel.vue'),
    meta: {
      title: 'HackerNews 资讯',
      group: 'intel'
    }
  },
  // 隐藏预留路由，需要时随时直接访问 URL 直达
  {
    path: '/review',
    name: 'Review',
    component: () => import('@/components/modules/ReviewPanel.vue'),
    meta: {
      title: 'AI 代码审查',
      group: 'hidden'
    }
  },
  {
    path: '/webpage',
    name: 'Webpage',
    component: () => import('@/components/modules/WebpagePanel.vue'),
    meta: {
      title: 'Jina 网页提取',
      group: 'hidden'
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

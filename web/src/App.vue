<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Menu } from 'lucide-vue-next'
import { useServerStatus } from '@/composables/useServerStatus'
import Sidebar from '@/components/layout/Sidebar.vue'
import Footer from '@/components/layout/Footer.vue'

// 1. 服务端健康状态
const { status: serverStatus } = useServerStatus()

// 2. 路由与面包屑
const route = useRoute()
const pageTitle = computed(() => (route.meta?.title as string) || '工作台')

// 3. 移动端侧滑抽屉状态
const isMobileMenuOpen = ref(false)
</script>

<template>
  <div class="min-h-screen flex bg-slate-50">
    <!-- 左侧分组侧边栏 (桌面端固定，移动端抽屉) -->
    <Sidebar
      :server-status="serverStatus"
      v-model:mobile-open="isMobileMenuOpen"
    />

    <!-- 右侧主工作区容器 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 顶部工作区轻量信息栏 -->
      <header class="h-15 border-b border-slate-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-6 md:px-8 flex items-center justify-between">
        <div class="flex items-center space-x-2.5">
          <!-- 移动端汉堡菜单触发按钮 -->
          <button
            type="button"
            @click="isMobileMenuOpen = true"
            class="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
            title="打开菜单"
          >
            <Menu class="w-5 h-5" />
          </button>

          <div class="flex items-center space-x-2 text-xs">
            <span class="text-slate-400">控制台</span>
            <span class="text-slate-300">/</span>
            <span class="font-semibold text-slate-800 text-sm tracking-tight">{{ pageTitle }}</span>
          </div>
        </div>

        <div class="flex items-center space-x-3 text-xs text-slate-400 font-mono">
          <span class="hidden sm:inline">OverseasFreeHub · 0元免Key</span>
          <span class="sm:hidden text-[11px] text-slate-500 font-sans font-medium">FreeHub</span>
        </div>
      </header>

      <!-- 路由动态视图内容区 (移动端自适应内边距) -->
      <main class="flex-1 p-3.5 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
        <router-view v-slot="{ Component }">
          <transition mode="out-in" enter-active-class="transition duration-150 ease-out" enter-from-class="opacity-0 translate-y-1" enter-to-class="opacity-100 translate-y-0">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- 页脚 -->
      <Footer />
    </div>
  </div>
</template>

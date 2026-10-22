<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { Menu, RefreshCw, Server, AlertCircle, CheckCircle2, ChevronDown } from 'lucide-vue-next'
import { useServerStatus } from '@/composables/useServerStatus'
import Sidebar from '@/components/layout/Sidebar.vue'
import Footer from '@/components/layout/Footer.vue'

// 1. 服务端健康状态
const { status: serverStatus, checkHealth } = useServerStatus()
const isChecking = ref(false)
const showStatusDetail = ref(false)

const handleManualCheck = async () => {
  if (isChecking.value) return
  isChecking.value = true
  await checkHealth()
  setTimeout(() => {
    isChecking.value = false
  }, 400)
}

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

        <!-- 顶部右侧：交互式服务器状态卡片 -->
        <div class="relative flex items-center space-x-3">
          <div
            @click="showStatusDetail = !showStatusDetail"
            :class="[
              'flex items-center space-x-2 px-2.5 py-1.2 rounded-full border text-xs font-mono transition-all cursor-pointer shadow-2xs select-none',
              serverStatus.connected
                ? 'bg-emerald-50/80 border-emerald-200/80 text-emerald-800 hover:bg-emerald-100/80'
                : 'bg-rose-50/80 border-rose-200/80 text-rose-800 hover:bg-rose-100/80'
            ]"
            title="点击查看服务器连接详情"
          >
            <!-- 呼吸灯 -->
            <span class="relative flex h-2 w-2">
              <span
                v-if="serverStatus.connected"
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
              ></span>
              <span
                :class="[
                  'relative inline-flex rounded-full h-2 w-2',
                  serverStatus.connected ? 'bg-emerald-500' : 'bg-rose-500'
                ]"
              ></span>
            </span>

            <span class="font-medium">
              {{ serverStatus.connected ? '后端在线' : '后端离线' }}
            </span>

            <span v-if="serverStatus.connected" class="text-[10px] text-emerald-600 font-bold hidden sm:inline">
              {{ serverStatus.latency }}ms
            </span>

            <ChevronDown class="w-3 h-3 text-slate-400 ml-0.5" />
          </div>

          <!-- 展开的状态详情浮层 -->
          <transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 scale-95 translate-y-1"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 translate-y-1"
          >
            <div
              v-if="showStatusDetail"
              class="absolute right-0 top-10 w-72 bg-white rounded-xl shadow-xl border border-slate-200/90 p-4 z-50 text-xs text-slate-700 font-sans"
            >
              <div class="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5">
                <div class="flex items-center space-x-1.5 font-semibold text-slate-900">
                  <Server class="w-4 h-4 text-indigo-600" />
                  <span>后端服务节点诊断</span>
                </div>
                <button
                  type="button"
                  @click.stop="handleManualCheck"
                  :disabled="isChecking"
                  class="inline-flex items-center space-x-1 text-[11px] text-indigo-600 hover:text-indigo-800 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw :class="['w-3 h-3', isChecking ? 'animate-spin' : '']" />
                  <span>刷新检测</span>
                </button>
              </div>

              <div class="space-y-2 font-mono text-[11px]">
                <div class="flex justify-between items-center">
                  <span class="text-slate-400 font-sans">运行状态:</span>
                  <span :class="serverStatus.connected ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'">
                    {{ serverStatus.connected ? '● 正常连接 (Healthy)' : '● 无法访问 (Offline)' }}
                  </span>
                </div>

                <div class="flex justify-between items-center">
                  <span class="text-slate-400 font-sans">网络延迟:</span>
                  <span class="text-slate-800">{{ serverStatus.latency ? `${serverStatus.latency} ms` : '--' }}</span>
                </div>

                <div class="flex flex-col space-y-0.5 pt-1 border-t border-slate-100">
                  <span class="text-slate-400 font-sans">连接目标:</span>
                  <span class="text-[10px] text-slate-800 break-all bg-slate-50 p-1.5 rounded border border-slate-100 select-all">
                    {{ serverStatus.targetUrl }}
                  </span>
                </div>

                <div v-if="serverStatus.errorMsg" class="flex flex-col space-y-0.5 pt-1 text-rose-600 font-sans text-[11px]">
                  <span class="font-semibold flex items-center space-x-1">
                    <AlertCircle class="w-3 h-3 inline" />
                    <span>诊断提示:</span>
                  </span>
                  <span class="text-[10px] bg-rose-50 text-rose-700 p-1.5 rounded border border-rose-100 leading-relaxed">
                    {{ serverStatus.errorMsg }}
                  </span>
                </div>

                <div v-if="serverStatus.lastChecked" class="text-[10px] text-slate-400 text-right pt-1 font-sans">
                  上次检测: {{ serverStatus.lastChecked }}
                </div>
              </div>
            </div>
          </transition>
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

      <!-- 极简统一底栏 -->
      <Footer />
    </div>
  </div>
</template>

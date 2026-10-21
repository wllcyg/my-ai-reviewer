<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  Mic,
  Image as ImageIcon,
  Search,
  Flame,
  Terminal,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next'

import type { ServerStatus } from '@/composables/useServerStatus'

defineProps<{
  serverStatus: ServerStatus
}>()

const route = useRoute()
const isCollapsed = ref(false)

const menuGroups = [
  {
    groupTitle: '核心工具矩阵',
    items: [
      { path: '/tts', name: '微软 Edge-TTS', icon: Mic, badge: '免Key' },
      { path: '/image', name: 'FLUX 极速生图', icon: ImageIcon, badge: '秒级' },
      { path: '/search', name: '免翻智能搜索', icon: Search, badge: '无广告' }
    ]
  },
  {
    groupTitle: '前沿与情报',
    items: [
      { path: '/news', name: 'HackerNews 资讯', icon: Flame, badge: '热榜' }
    ]
  }
]
</script>

<template>
  <aside
    :class="[
      'h-screen sticky top-0 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-all duration-200 z-30 select-none shrink-0',
      isCollapsed ? 'w-18' : 'w-60'
    ]"
  >
    <!-- 顶部 Logo 栏 -->
    <div>
      <div class="h-15 border-b border-slate-200/80 flex items-center px-4.5 justify-between">
        <div class="flex items-center space-x-3 overflow-hidden">
          <div class="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
            <Terminal class="w-4 h-4" />
          </div>
          <div v-if="!isCollapsed" class="overflow-hidden whitespace-nowrap">
            <div class="font-semibold text-sm text-slate-900 tracking-tight leading-tight">AI Hub Studio</div>
            <div class="text-[10px] text-slate-400 font-mono">v0.1.0 · FastMCP</div>
          </div>
        </div>
      </div>

      <!-- 导航菜单区域 -->
      <nav class="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-120px)]">
        <div v-for="group in menuGroups" :key="group.groupTitle" class="space-y-1">
          <!-- 分组标题 (折叠时隐藏) -->
          <div
            v-if="!isCollapsed"
            class="px-2.5 py-1 text-[11px] font-medium text-slate-400 tracking-wider uppercase font-mono"
          >
            {{ group.groupTitle }}
          </div>

          <!-- 菜单项 -->
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            :class="[
              'flex items-center rounded-lg text-xs font-medium transition-all duration-150 group cursor-pointer',
              isCollapsed ? 'justify-center p-2.5' : 'px-2.5 py-2 space-x-2.5',
              route.path === item.path
                ? 'bg-slate-100 text-slate-900 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            ]"
            :title="isCollapsed ? item.name : undefined"
          >
            <component
              :is="item.icon"
              :class="[
                'w-4 h-4 shrink-0 transition-colors',
                route.path === item.path ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
              ]"
            />
            <span v-if="!isCollapsed" class="flex-1 truncate">{{ item.name }}</span>
            <span
              v-if="!isCollapsed && item.badge"
              :class="[
                'text-[10px] px-1.5 py-0.2 rounded font-normal font-mono',
                route.path === item.path ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'
              ]"
            >
              {{ item.badge }}
            </span>
          </router-link>
        </div>
      </nav>
    </div>

    <!-- 底部状态指示与折叠切换 -->
    <div class="p-3 border-t border-slate-200/80 space-y-2 bg-slate-50/50">
      <!-- 服务端状态指示 -->
      <div
        :class="[
          'flex items-center rounded-lg p-2 text-xs border border-slate-200/60 bg-white shadow-2xs font-mono',
          isCollapsed ? 'justify-center' : 'justify-between'
        ]"
      >
        <div class="flex items-center space-x-2 overflow-hidden">
          <span :class="serverStatus.connected ? 'status-dot-pulse shrink-0' : 'w-2 h-2 rounded-full bg-rose-500 shrink-0'"></span>
          <span v-if="!isCollapsed" class="text-[11px] text-slate-600 truncate">
            {{ serverStatus.connected ? `${serverStatus.mcpName}` : '服务离线' }}
          </span>
        </div>
        <span v-if="!isCollapsed && serverStatus.connected" class="text-[10px] text-emerald-600 font-bold shrink-0">
          {{ serverStatus.latency }}ms
        </span>
      </div>

      <!-- 折叠收起按钮 -->
      <button
        @click="isCollapsed = !isCollapsed"
        class="w-full flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-xs cursor-pointer"
        :title="isCollapsed ? '展开侧边栏' : '收起侧边栏'"
      >
        <ChevronRight v-if="isCollapsed" class="w-4 h-4" />
        <div v-else class="flex items-center space-x-1.5 text-xs text-slate-500">
          <ChevronLeft class="w-4 h-4" />
          <span>收起侧栏</span>
        </div>
      </button>
    </div>
  </aside>
</template>

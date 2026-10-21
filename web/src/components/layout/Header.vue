<script setup lang="ts">
import { Terminal } from 'lucide-vue-next'
import type { ServerStatus } from '@/composables/useServerStatus'

defineProps<{
  serverStatus: ServerStatus
}>()
</script>

<template>
  <header class="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 h-15 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <!-- 沉稳质感 Logo -->
        <div class="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-xs">
          <Terminal class="w-4 h-4" />
        </div>
        <div class="flex items-baseline space-x-2">
          <span class="font-semibold text-base text-slate-900 tracking-tight">AI Reviewer & MCP Studio</span>
          <span class="text-xs text-slate-400 hidden sm:inline font-mono">v0.1.0</span>
        </div>
      </div>

      <!-- 服务端状态指示灯 -->
      <div class="flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-slate-600 font-mono">
        <span :class="serverStatus.connected ? 'status-dot-pulse' : 'w-2 h-2 rounded-full bg-rose-500'"></span>
        <span>
          {{ serverStatus.connected ? `${serverStatus.mcpName} 在线 · ${serverStatus.latency}ms` : '服务未就绪 (main.py 未启动)' }}
        </span>
      </div>
    </div>
  </header>
</template>

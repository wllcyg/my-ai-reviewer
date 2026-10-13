<script setup lang="ts">
import { ref, computed } from 'vue'
import * as monaco from 'monaco-editor'
import { VueMonacoDiffEditor } from '@guolao/vue-monaco-editor'
import {
  Columns2,
  Rows2,
  FileCode2,
  Code2,
  Loader2,
  Sparkles
} from 'lucide-vue-next'
import type { GitFileDiff } from '../../../preload/git-types'

import { setupMonaco } from '../services/monaco-setup'

// 启动 Monaco Web Workers 环境并绑定本地实例
setupMonaco()

const props = defineProps<{
  diffData: GitFileDiff | null
  isLoading: boolean
  sourceLabel?: string
}>()

const isSideBySide = ref(true)

const editorOptions = computed<monaco.editor.IStandaloneDiffEditorConstructionOptions>(() => ({
  readOnly: true,
  renderSideBySide: isSideBySide.value,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  fontSize: 13,
  lineHeight: 20,
  fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', Consolas, monospace",
  fontLigatures: true,
  minimap: {
    enabled: true,
    renderCharacters: false
  },
  smoothScrolling: true,
  renderWhitespace: 'selection',
  renderOverviewRuler: true,
  diffWordWrap: 'off',
  // ⚡ 核心性能加速配置：
  maxComputationTime: 400, // 字符级比对上限 400ms，超时平滑降级，防主线程掉帧
  ignoreTrimWhitespace: true, // 忽略无害行尾空白比对，比对速度提升 30%
  renderMarginRevertIcon: false // 禁用行级还原操作按钮，精简 DOM
}))

// 切换双栏并排 / 单栏行内对比视图
const toggleViewMode = (): void => {
  isSideBySide.value = !isSideBySide.value
}
</script>

<template>
  <div class="flex-1 flex flex-col bg-zinc-950 relative overflow-hidden h-full">
    <!-- 顶部工作区工具栏 -->
    <header class="h-10 bg-zinc-900/60 border-b border-zinc-800/80 px-3 flex items-center justify-between text-xs text-zinc-300 shrink-0 select-none">
      <!-- 当前文件路径与语言标签 -->
      <div class="flex items-center space-x-2 min-w-0">
        <template v-if="diffData">
          <FileCode2 class="w-4 h-4 text-indigo-400 shrink-0" />
          <span class="font-mono text-zinc-200 text-xs font-medium truncate max-w-[360px]" :title="diffData.filePath">
            {{ diffData.filePath }}
          </span>
          <span class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] font-mono border border-zinc-700/60 uppercase">
            {{ diffData.language }}
          </span>
          <span
            v-if="sourceLabel"
            class="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px] font-mono border border-indigo-500/30 truncate max-w-[200px]"
            :title="sourceLabel"
          >
            {{ sourceLabel }}
          </span>
        </template>
        <template v-else>
          <Code2 class="w-4 h-4 text-zinc-500" />
          <span class="text-zinc-500 text-xs font-mono">Diff 对比工作台</span>
        </template>
      </div>

      <!-- 右侧控制项：原始/最新对照标记与模式切换 -->
      <div v-if="diffData" class="flex items-center space-x-3">
        <div class="flex items-center space-x-2 text-[11px] font-mono">
          <span class="flex items-center space-x-1 text-rose-400/80 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            <span>HEAD (原始)</span>
          </span>
          <span class="text-zinc-600">→</span>
          <span class="flex items-center space-x-1 text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Working Tree (改动)</span>
          </span>
        </div>

        <div class="h-3 w-[1px] bg-zinc-800"></div>

        <!-- 双栏 / 行内切换 -->
        <button
          type="button"
          @click="toggleViewMode"
          class="flex items-center space-x-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-[11px] transition-colors cursor-pointer border border-zinc-700/60"
          :title="isSideBySide ? '切换为行内单栏模式' : '切换为双栏并排模式'"
        >
          <Columns2 v-if="isSideBySide" class="w-3.5 h-3.5 text-zinc-400" />
          <Rows2 v-else class="w-3.5 h-3.5 text-zinc-400" />
          <span>{{ isSideBySide ? '双栏模式' : '行内模式' }}</span>
        </button>
      </div>
    </header>

    <!-- 主展示区 -->
    <div class="flex-1 relative overflow-hidden">
      <!-- 加载中轻量遮罩（保持底层不卸载，提供平滑过渡） -->
      <div
        v-if="isLoading"
        class="absolute inset-0 z-20 bg-zinc-950/60 backdrop-blur-[1px] flex items-center justify-center space-x-2 text-zinc-300 text-xs transition-opacity"
      >
        <Loader2 class="w-5 h-5 text-indigo-400 animate-spin" />
        <span class="font-mono">正在比对并加载 Diff...</span>
      </div>

      <!-- Diff 编辑器核心：使用 v-show 常驻保持单例实例，切换文件仅响应式替换 Model 数据 -->
      <div v-show="Boolean(diffData)" class="w-full h-full">
        <VueMonacoDiffEditor
          :original="diffData?.original || ''"
          :modified="diffData?.modified || ''"
          :language="diffData?.language || 'plaintext'"
          theme="vs-dark"
          :options="editorOptions"
          class="w-full h-full"
        />
      </div>

      <!-- 无文件选中时的 Zed 空状态 -->
      <div v-show="!diffData" class="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none">
        <div class="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
          <Sparkles class="w-6 h-6 text-zinc-500" />
        </div>
        <h3 class="text-sm font-semibold text-zinc-300">请选择变更文件</h3>
        <p class="text-xs text-zinc-500 mt-1 max-w-sm leading-relaxed">
          在左侧边栏点选任一受版本控制的变更文件，即可实时载入 Monaco 双栏语法差异对比。
        </p>
      </div>
    </div>
  </div>
</template>

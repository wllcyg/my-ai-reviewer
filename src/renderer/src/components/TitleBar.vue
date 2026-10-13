<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  FolderGit2,
  Minus,
  Square,
  Copy,
  X,
  Code2,
  ChevronRight,
  Sparkles
} from 'lucide-vue-next'

const props = defineProps<{
  currentPath?: string
}>()

const emit = defineEmits<{
  (e: 'select-directory', path: string): void
}>()

const isMaximized = ref(false)
let removeMaximizeListener: (() => void) | null = null

const handleMinimize = async (): Promise<void> => {
  await window.api.minimizeWindow()
}

const handleMaximizeToggle = async (): Promise<void> => {
  await window.api.maximizeWindow()
}

const handleClose = async (): Promise<void> => {
  await window.api.closeWindow()
}

const handleChooseFolder = async (): Promise<void> => {
  const selectedPath = await window.api.openDirectoryDialog()
  if (selectedPath) {
    emit('select-directory', selectedPath)
  }
}

// 格式化展示路径（只保留后两段路径，前缀以省略号展示，保持 Zed 极简视觉）
const displayPath = (fullPath?: string): string => {
  if (!fullPath) return '打开 Git 仓库'
  const normalized = fullPath.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length <= 2) return normalized
  return `.../${parts.slice(-2).join('/')}`
}

onMounted(async () => {
  isMaximized.value = await window.api.isWindowMaximized()
  removeMaximizeListener = window.api.onMaximizeChange((maximized) => {
    isMaximized.value = maximized
  })
})

onUnmounted(() => {
  removeMaximizeListener?.()
})
</script>

<template>
  <header
    class="drag-region h-10 w-full bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-3 select-none text-xs text-zinc-400 shrink-0"
  >
    <!-- 左侧：应用品牌标识 -->
    <div class="flex items-center space-x-2.5 no-drag-region">
      <div class="flex items-center space-x-1.5 text-zinc-200 font-medium">
        <div class="w-5 h-5 rounded-md bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
          <Code2 class="w-3.5 h-3.5 text-indigo-400" />
        </div>
        <span class="tracking-tight text-zinc-200 font-semibold">AI Reviewer</span>
      </div>

      <div class="flex items-center space-x-1 text-[11px] px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50 text-indigo-300">
        <Sparkles class="w-3 h-3 text-indigo-400 mr-0.5" />
        <span>Zed Style</span>
      </div>
    </div>

    <!-- 中间：项目路径选择器 (Zed 风格胶囊栏) -->
    <div class="flex items-center justify-center no-drag-region">
      <button
        type="button"
        @click="handleChooseFolder"
        class="group flex items-center space-x-2 px-3 py-1 rounded-md bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-750 hover:border-zinc-700 text-zinc-300 transition-all duration-150 cursor-pointer text-xs"
        :title="props.currentPath || '点击选择本地 Git 代码仓库'"
      >
        <FolderGit2 class="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
        <span class="font-mono text-[11px] text-zinc-300 max-w-[320px] truncate">
          {{ displayPath(props.currentPath) }}
        </span>
        <ChevronRight class="w-3 h-3 text-zinc-500 group-hover:text-zinc-400" />
      </button>
    </div>

    <!-- 右侧：无边框窗口控制器 (Windows / Linux) -->
    <div class="flex items-center space-x-1 no-drag-region">
      <button
        type="button"
        @click="handleMinimize"
        aria-label="最小化"
        class="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <Minus class="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        @click="handleMaximizeToggle"
        :aria-label="isMaximized ? '还原' : '最大化'"
        class="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <Copy v-if="isMaximized" class="w-3 h-3 rotate-180" />
        <Square v-else class="w-3 h-3" />
      </button>

      <button
        type="button"
        @click="handleClose"
        aria-label="关闭"
        class="w-7 h-7 flex items-center justify-center rounded hover:bg-red-600/90 text-zinc-400 hover:text-white transition-colors"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  </header>
</template>

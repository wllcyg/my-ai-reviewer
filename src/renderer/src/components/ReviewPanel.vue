<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Bot,
  Brain,
  Sparkles,
  Square,
  Settings2,
  ChevronDown,
  AlertCircle,
  Cpu,
  Loader2
} from 'lucide-vue-next'
import AIConfigModal from './AIConfigModal.vue'
import { renderMarkdown } from '../services/markdown'
import type { AIReviewConfig } from '../../../preload/ai-types'

const props = defineProps<{
  isReviewing: boolean
  isThinking: boolean
  isThinkingExpanded: boolean
  thinkingText: string
  reviewText: string
  errorMessage: string
  aiConfig: AIReviewConfig
  hasDiff: boolean
}>()

const emit = defineEmits<{
  (e: 'start-review'): void
  (e: 'stop-review'): void
  (e: 'update-config', config: Partial<AIReviewConfig>): void
  (e: 'toggle-thinking'): void
}>()

const isConfigOpen = ref(false)

const renderedReviewHtml = computed(() => {
  return renderMarkdown(props.reviewText)
})
</script>

<template>
  <aside class="w-88 bg-zinc-900/80 border-l border-zinc-800 flex flex-col shrink-0 select-none overflow-hidden h-full">
    <!-- 顶栏：标题、模型指示与操作区 -->
    <header class="h-10 px-3 border-b border-zinc-800 flex items-center justify-between text-xs text-zinc-300 font-medium shrink-0 bg-zinc-900/60">
      <div class="flex items-center space-x-1.5">
        <Bot class="w-4 h-4 text-indigo-400" />
        <span class="tracking-wide text-zinc-200 font-semibold text-xs">AI 审查助手</span>
      </div>

      <div class="flex items-center space-x-2">
        <!-- 当前模型与配置入口 -->
        <button
          type="button"
          @click="isConfigOpen = true"
          class="flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-750 border border-zinc-700/60 text-[10px] font-mono text-zinc-300 transition-colors cursor-pointer"
          :title="'配置模型: ' + aiConfig.modelId"
        >
          <Cpu class="w-3 h-3 text-indigo-400" />
          <span class="max-w-[80px] truncate">{{ aiConfig.modelId }}</span>
          <Settings2 class="w-2.5 h-2.5 text-zinc-500" />
        </button>

        <!-- 启动 / 停止审查主按钮 -->
        <button
          v-if="!isReviewing"
          type="button"
          @click="emit('start-review')"
          :disabled="!hasDiff"
          class="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-[11px] font-medium transition-all shadow-sm shadow-indigo-600/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="对当前 Diff 触发 AI 审查"
        >
          <Sparkles class="w-3 h-3" />
          <span>开始审查</span>
        </button>

        <button
          v-else
          type="button"
          @click="emit('stop-review')"
          class="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-rose-600/90 hover:bg-rose-600 text-white text-[11px] font-medium transition-colors cursor-pointer"
          title="停止当前审查流"
        >
          <Square class="w-3 h-3 fill-white" />
          <span>停止</span>
        </button>
      </div>
    </header>

    <!-- 主展示区 -->
    <div class="flex-1 overflow-y-auto p-3 space-y-3">
      <!-- 错误提示 -->
      <div
        v-if="errorMessage"
        class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start space-x-2"
      >
        <AlertCircle class="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <span class="text-[11px] leading-relaxed break-all">{{ errorMessage }}</span>
      </div>

      <!-- 可折叠思维链卡片 (Thinking) -->
      <div
        v-if="thinkingText || isThinking"
        class="rounded-lg bg-zinc-950/70 border border-zinc-800/90 overflow-hidden text-xs transition-all"
      >
        <!-- 思维链卡片头 -->
        <button
          type="button"
          @click="emit('toggle-thinking')"
          class="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-zinc-900/50 transition-colors cursor-pointer"
        >
          <div class="flex items-center space-x-2">
            <Brain
              class="w-3.5 h-3.5 text-indigo-400"
              :class="{ 'animate-pulse text-amber-400': isThinking }"
            />
            <span class="font-medium text-[11px] text-zinc-300">深度思考链</span>
            <span v-if="isThinking" class="flex items-center space-x-1 text-[10px] text-amber-400 font-mono">
              <Loader2 class="w-3 h-3 animate-spin" />
              <span>思考中...</span>
            </span>
            <span v-else class="text-[10px] text-zinc-500 font-mono">
              ({{ thinkingText.length }} 字)
            </span>
          </div>

          <ChevronDown
            class="w-3.5 h-3.5 text-zinc-500 transition-transform"
            :class="{ 'rotate-180': isThinkingExpanded }"
          />
        </button>

        <!-- 思维链流式内容 -->
        <div
          v-if="isThinkingExpanded"
          class="px-3 pb-3 pt-1 border-t border-zinc-900 font-mono text-[11px] text-zinc-400 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto"
        >
          {{ thinkingText }}
        </div>
      </div>

      <!-- 正文审查报告渲染 -->
      <div v-if="reviewText" class="review-markdown text-zinc-200 text-xs leading-relaxed select-text">
        <div v-html="renderedReviewHtml"></div>
      </div>

      <!-- 空状态 -->
      <div
        v-else-if="!isReviewing && !errorMessage"
        class="h-full flex flex-col items-center justify-center p-4 text-center text-zinc-500 text-xs"
      >
        <Bot class="w-10 h-10 text-zinc-800 mb-2 stroke-[1.5]" />
        <p class="font-medium text-zinc-300">就绪等待审查</p>
        <p class="text-[11px] text-zinc-500 mt-1 max-w-[220px]">
          选定变更文件后，点击右上角“开始审查”，AI 助手将进行多维度安全与质量分析。
        </p>
      </div>

      <!-- 审查初始化中骨架 -->
      <div
        v-else-if="isReviewing && !thinkingText && !reviewText"
        class="flex flex-col items-center justify-center py-12 text-center text-zinc-500 space-y-2"
      >
        <Loader2 class="w-6 h-6 text-indigo-400 animate-spin" />
        <span class="text-xs font-mono text-zinc-400">正在建立流式连接...</span>
      </div>
    </div>

    <!-- 底部状态统计 -->
    <footer class="h-7 px-3 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 font-mono shrink-0">
      <span class="flex items-center space-x-1">
        <span class="w-1.5 h-1.5 rounded-full" :class="isReviewing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'"></span>
        <span>{{ isReviewing ? 'Streaming' : 'Idle' }}</span>
      </span>
      <span>{{ reviewText.length }} 字已渲染</span>
    </footer>

    <!-- 模型配置弹窗 -->
    <AIConfigModal
      :is-open="isConfigOpen"
      :config="aiConfig"
      @close="isConfigOpen = false"
      @save="(cfg) => emit('update-config', cfg)"
    />
  </aside>
</template>

<style scoped>
:deep(.review-markdown) {
  line-height: 1.6;
}
:deep(.review-markdown h2) {
  font-size: 13px;
  font-weight: 700;
  color: #f4f4f5;
  margin-top: 14px;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #27272a;
}
:deep(.review-markdown h3) {
  font-size: 12px;
  font-weight: 600;
  color: #e4e4e7;
  margin-top: 10px;
  margin-bottom: 4px;
}
:deep(.review-markdown p) {
  margin-bottom: 8px;
  color: #d4d4d8;
}
:deep(.review-markdown ul),
:deep(.review-markdown ol) {
  padding-left: 18px;
  margin-bottom: 8px;
}
:deep(.review-markdown li) {
  margin-bottom: 3px;
}
:deep(.review-markdown code) {
  font-family: 'Geist Mono', 'JetBrains Mono', Consolas, monospace;
  font-size: 11px;
  background-color: #27272a;
  color: #a5b4fc;
  padding: 1px 4px;
  border-radius: 4px;
}
:deep(.review-markdown pre) {
  background-color: #121215;
  border: 1px solid #27272a;
  padding: 8px 10px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}
:deep(.review-markdown pre code) {
  background-color: transparent;
  padding: 0;
  color: #f4f4f5;
}
</style>

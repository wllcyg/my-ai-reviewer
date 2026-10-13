<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Check, Key, Globe, Cpu } from 'lucide-vue-next'
import type { AIReviewConfig } from '../../../preload/ai-types'

const props = defineProps<{
  isOpen: boolean
  config: AIReviewConfig
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', config: Partial<AIReviewConfig>): void
}>()

const form = ref<AIReviewConfig>({ ...props.config })

watch(
  () => props.config,
  (val) => {
    form.value = { ...val }
  },
  { deep: true }
)

// 常见快捷预设
const applyPreset = (preset: 'deepseek' | 'openai' | 'claude' | 'ollama'): void => {
  switch (preset) {
    case 'deepseek':
      form.value.provider = 'deepseek'
      form.value.modelId = 'deepseek-chat'
      form.value.baseUrl = 'https://api.deepseek.com/v1'
      break
    case 'openai':
      form.value.provider = 'openai'
      form.value.modelId = 'gpt-4o'
      form.value.baseUrl = 'https://api.openai.com/v1'
      break
    case 'claude':
      form.value.provider = 'anthropic'
      form.value.modelId = 'claude-3-7-sonnet'
      form.value.baseUrl = 'https://api.anthropic.com/v1'
      break
    case 'ollama':
      form.value.provider = 'ollama'
      form.value.modelId = 'qwen2.5-coder'
      form.value.baseUrl = 'http://localhost:11434/v1'
      form.value.apiKey = 'ollama'
      break
  }
}

const handleSave = (): void => {
  emit('save', form.value)
  emit('close')
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none"
  >
    <div class="w-full max-w-md bg-zinc-900 border border-zinc-750 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
      <!-- 头部 -->
      <div class="h-11 px-4 border-b border-zinc-800 flex items-center justify-between">
        <div class="flex items-center space-x-2 text-zinc-100 font-semibold text-xs">
          <Cpu class="w-4 h-4 text-indigo-400" />
          <span>AI 审查引擎配置</span>
        </div>
        <button
          type="button"
          @click="emit('close')"
          class="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- 内容表单 -->
      <div class="p-4 space-y-3.5 text-xs">
        <!-- 预设选择器 -->
        <div>
          <label class="block text-[11px] font-mono text-zinc-400 mb-1.5 uppercase">快捷厂商预设</label>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              @click="applyPreset('deepseek')"
              class="py-1 px-2 rounded border text-center transition-colors cursor-pointer"
              :class="form.provider === 'deepseek' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-medium' : 'bg-zinc-800 text-zinc-400 border-zinc-750 hover:bg-zinc-750'"
            >
              DeepSeek
            </button>
            <button
              type="button"
              @click="applyPreset('openai')"
              class="py-1 px-2 rounded border text-center transition-colors cursor-pointer"
              :class="form.provider === 'openai' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-medium' : 'bg-zinc-800 text-zinc-400 border-zinc-750 hover:bg-zinc-750'"
            >
              OpenAI
            </button>
            <button
              type="button"
              @click="applyPreset('claude')"
              class="py-1 px-2 rounded border text-center transition-colors cursor-pointer"
              :class="form.provider === 'anthropic' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-medium' : 'bg-zinc-800 text-zinc-400 border-zinc-750 hover:bg-zinc-750'"
            >
              Claude
            </button>
            <button
              type="button"
              @click="applyPreset('ollama')"
              class="py-1 px-2 rounded border text-center transition-colors cursor-pointer"
              :class="form.provider === 'ollama' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-medium' : 'bg-zinc-800 text-zinc-400 border-zinc-750 hover:bg-zinc-750'"
            >
              本地 Ollama
            </button>
          </div>
        </div>

        <!-- Model ID -->
        <div>
          <label class="block text-[11px] font-mono text-zinc-400 mb-1">模型 ID (Model)</label>
          <input
            v-model="form.modelId"
            type="text"
            placeholder="例如: deepseek-chat 或 gpt-4o"
            class="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded px-2.5 py-1.5 text-zinc-200 outline-none font-mono text-xs"
          />
        </div>

        <!-- API Key -->
        <div>
          <label class="block text-[11px] font-mono text-zinc-400 mb-1 flex items-center justify-between">
            <span>API Key</span>
            <span class="text-zinc-600 font-normal">本地加密隔离</span>
          </label>
          <div class="relative flex items-center">
            <Key class="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 pointer-events-none" />
            <input
              v-model="form.apiKey"
              type="password"
              placeholder="sk-..."
              class="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded pl-8 pr-2.5 py-1.5 text-zinc-200 outline-none font-mono text-xs"
            />
          </div>
        </div>

        <!-- Base URL -->
        <div>
          <label class="block text-[11px] font-mono text-zinc-400 mb-1">接口 Base URL</label>
          <div class="relative flex items-center">
            <Globe class="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 pointer-events-none" />
            <input
              v-model="form.baseUrl"
              type="text"
              placeholder="https://api.openai.com/v1"
              class="w-full bg-zinc-950 border border-zinc-800 focus:border-indigo-500 rounded pl-8 pr-2.5 py-1.5 text-zinc-200 outline-none font-mono text-xs"
            />
          </div>
        </div>
      </div>

      <!-- 底部 -->
      <div class="p-3 bg-zinc-950/80 border-t border-zinc-800 flex justify-end space-x-2">
        <button
          type="button"
          @click="emit('close')"
          class="px-3 py-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer text-xs"
        >
          取消
        </button>
        <button
          type="button"
          @click="handleSave"
          class="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium transition-all shadow-md shadow-indigo-600/30 cursor-pointer text-xs"
        >
          <Check class="w-3.5 h-3.5" />
          <span>保存配置</span>
        </button>
      </div>
    </div>
  </div>
</template>

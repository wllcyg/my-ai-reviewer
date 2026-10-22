<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import {
  FileAudio,
  MessageSquare,
  Users
} from 'lucide-vue-next'
import type { ExportAudioFormat } from './tts/types'
import AcousticController from './tts/AcousticController.vue'
import SingleTtsView from './tts/SingleTtsView.vue'
import DialogueTheaterView from './tts/DialogueTheaterView.vue'
import { useAudioEngine } from './tts/useAudioEngine'

// 模式与导出格式状态
const activeTab = ref<'single' | 'dialogue'>('single')
const exportFormat = ref<ExportAudioFormat>('mp3')

// 全局基准声学参数
const speedMultiplier = ref(1.0)
const pitchOffset = ref(0)

const computedRate = computed(() => {
  const percent = Math.round((speedMultiplier.value - 1.0) * 100)
  return percent >= 0 ? `+${percent}%` : `${percent}%`
})

const computedPitch = computed(() => {
  const hz = Math.round(pitchOffset.value)
  return hz >= 0 ? `+${hz}Hz` : `${hz}Hz`
})

const singleViewRef = ref<InstanceType<typeof SingleTtsView> | null>(null)
const { stopAudio, clearCache } = useAudioEngine()

onUnmounted(() => {
  stopAudio()
  clearCache()
})

defineExpose({
  playText: (text: string) => {
    activeTab.value = 'single'
    singleViewRef.value?.playText(text)
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="ui-card p-6">
      <!-- 顶部控制与功能 Tab 切换 -->
      <div class="flex items-start justify-between mb-6 flex-wrap gap-4 border-b border-slate-100 pb-5">
        <div>
          <div class="flex items-center space-x-2">
            <h2 class="text-lg font-semibold text-slate-900 tracking-tight">微软高拟真人声语音工作台</h2>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              模块化微架构 · SRT字幕 · 独立声线 · SSML
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            支持毫秒级 SRT 字幕导出、多角色独立语速音高微调、SSML 停顿强调标记及 MP3 / WAV 无损缝合。
          </p>
        </div>

        <div class="flex items-center space-x-3 flex-wrap gap-2">
          <!-- 导出格式选择器 (MP3 / WAV) -->
          <div class="flex items-center space-x-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200 text-xs font-medium">
            <span class="px-2 text-slate-400 flex items-center space-x-1">
              <FileAudio class="w-3.5 h-3.5" />
              <span>导出格式:</span>
            </span>
            <button
              type="button"
              @click="exportFormat = 'mp3'"
              :class="exportFormat === 'mp3' ? 'bg-white text-indigo-700 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-900'"
              class="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
            >
              MP3 (通用压缩)
            </button>
            <button
              type="button"
              @click="exportFormat = 'wav'"
              :class="exportFormat === 'wav' ? 'bg-white text-indigo-700 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-900'"
              class="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
            >
              WAV (无损保真)
            </button>
          </div>

          <!-- 模式切换：单句合成 vs 多角色对话剧场 -->
          <div class="flex items-center space-x-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/80 text-xs font-medium">
            <button
              type="button"
              @click="activeTab = 'single'"
              :class="activeTab === 'single' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
              class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              <MessageSquare class="w-3.5 h-3.5 text-indigo-500" />
              <span>单句试听与字幕</span>
            </button>
            <button
              type="button"
              @click="activeTab = 'dialogue'"
              :class="activeTab === 'dialogue' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'"
              class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
            >
              <Users class="w-3.5 h-3.5 text-purple-500" />
              <span>多角色对话剧场</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-50 text-indigo-600 font-semibold">Pro</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 全局声学控制器组件 -->
      <AcousticController
        v-model:speed-multiplier="speedMultiplier"
        v-model:pitch-offset="pitchOffset"
      />

      <!-- TAB 1: 单句试听与字幕视图 -->
      <SingleTtsView
        v-if="activeTab === 'single'"
        ref="singleViewRef"
        :computed-rate="computedRate"
        :computed-pitch="computedPitch"
        :export-format="exportFormat"
      />

      <!-- TAB 2: 多角色对话剧场视图 -->
      <DialogueTheaterView
        v-else
        :computed-rate="computedRate"
        :computed-pitch="computedPitch"
        :export-format="exportFormat"
      />
    </div>
  </div>
</template>

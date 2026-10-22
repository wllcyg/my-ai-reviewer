<script setup lang="ts">
import { computed } from 'vue'
import {
  Sliders,
  RotateCcw,
  Zap,
  Film,
  Smile,
  BookOpen
} from 'lucide-vue-next'

const props = defineProps<{
  speedMultiplier: number
  pitchOffset: number
}>()

const emit = defineEmits<{
  (e: 'update:speedMultiplier', value: number): void
  (e: 'update:pitchOffset', value: number): void
}>()

const localSpeed = computed({
  get: () => props.speedMultiplier,
  set: (val: number) => emit('update:speedMultiplier', val)
})

const localPitch = computed({
  get: () => props.pitchOffset,
  set: (val: number) => emit('update:pitchOffset', val)
})

const computedRate = computed(() => {
  const percent = Math.round((props.speedMultiplier - 1.0) * 100)
  return percent >= 0 ? `+${percent}%` : `${percent}%`
})

const computedPitch = computed(() => {
  const hz = Math.round(props.pitchOffset)
  return hz >= 0 ? `+${hz}Hz` : `${hz}Hz`
})

const applyPreset = (preset: 'default' | 'fastShorts' | 'deepMovie' | 'animeCute' | 'slowStudy') => {
  if (preset === 'default') {
    emit('update:speedMultiplier', 1.0)
    emit('update:pitchOffset', 0)
  } else if (preset === 'fastShorts') {
    emit('update:speedMultiplier', 1.3)
    emit('update:pitchOffset', 5)
  } else if (preset === 'deepMovie') {
    emit('update:speedMultiplier', 0.95)
    emit('update:pitchOffset', -20)
  } else if (preset === 'animeCute') {
    emit('update:speedMultiplier', 1.15)
    emit('update:pitchOffset', 35)
  } else if (preset === 'slowStudy') {
    emit('update:speedMultiplier', 0.8)
    emit('update:pitchOffset', 0)
  }
}
</script>

<template>
  <div class="mb-5 p-4 bg-slate-50/70 border border-slate-200/90 rounded-2xl space-y-3">
    <div class="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-200/60">
      <div class="flex items-center space-x-1.5 text-xs font-semibold text-slate-800">
        <Sliders class="w-3.5 h-3.5 text-indigo-600" />
        <span>全局声学调谐基准 (Global Acoustic Studio)</span>
      </div>

      <!-- 快捷风格预设 -->
      <div class="flex items-center space-x-1.5 flex-wrap gap-1 text-[11px]">
        <span class="text-slate-400">风格预设:</span>
        <button
          @click="applyPreset('fastShorts')"
          class="px-2 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 flex items-center space-x-1 cursor-pointer transition-colors"
        >
          <Zap class="w-3 h-3" />
          <span>短视频解说</span>
        </button>
        <button
          @click="applyPreset('deepMovie')"
          class="px-2 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 flex items-center space-x-1 cursor-pointer transition-colors"
        >
          <Film class="w-3 h-3" />
          <span>电影大片旁白</span>
        </button>
        <button
          @click="applyPreset('animeCute')"
          class="px-2 py-0.5 rounded bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200 flex items-center space-x-1 cursor-pointer transition-colors"
        >
          <Smile class="w-3 h-3" />
          <span>二次元萌音</span>
        </button>
        <button
          @click="applyPreset('slowStudy')"
          class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 flex items-center space-x-1 cursor-pointer transition-colors"
        >
          <BookOpen class="w-3 h-3" />
          <span>慢速口语跟读</span>
        </button>
        <button
          @click="applyPreset('default')"
          class="px-2 py-0.5 rounded bg-slate-200/70 text-slate-700 hover:bg-slate-300 flex items-center space-x-1 cursor-pointer transition-colors"
          title="重置为标准默认"
        >
          <RotateCcw class="w-3 h-3" />
          <span>重置</span>
        </button>
      </div>
    </div>

    <!-- 两个调节滑块 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
      <!-- 语速滑块 -->
      <div class="space-y-1">
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-600 font-medium">基准语速 (Speed Rate)</span>
          <span class="font-mono font-semibold text-indigo-600">{{ speedMultiplier.toFixed(2) }}x ({{ computedRate }})</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.05"
          v-model.number="localSpeed"
          class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <div class="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>0.5x (慢读)</span>
          <span>1.0x (原速)</span>
          <span>2.0x (极速)</span>
        </div>
      </div>

      <!-- 音调滑块 -->
      <div class="space-y-1">
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-600 font-medium">基准音调 (Pitch Shift)</span>
          <span class="font-mono font-semibold text-indigo-600">{{ computedPitch }}</span>
        </div>
        <input
          type="range"
          min="-50"
          max="50"
          step="5"
          v-model.number="localPitch"
          class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <div class="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>-50Hz (低沉大叔)</span>
          <span>0Hz (原音)</span>
          <span>+50Hz (高亢灵动)</span>
        </div>
      </div>
    </div>
  </div>
</template>

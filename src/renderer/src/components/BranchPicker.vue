<script setup lang="ts">
import { ref } from 'vue'
import { GitBranch, GitCompare, ChevronDown } from 'lucide-vue-next'
import type { BranchInfo } from '../../../preload/git-types'

const props = defineProps<{
  branches: BranchInfo[]
  currentBranch: string
  baseBranch: string
  isLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'select-base', branchName: string): void
}>()

const isOpen = ref(false)

const handleSelect = (branchName: string): void => {
  emit('select-base', branchName)
  isOpen.value = false
}
</script>

<template>
  <div class="relative px-2.5 py-1.5 border-b border-zinc-800/80 bg-zinc-950/40 select-none">
    <div class="text-[10px] text-zinc-500 font-mono uppercase mb-1 flex items-center justify-between">
      <span>分支差异对比</span>
      <span class="text-zinc-600">目标: {{ currentBranch }}</span>
    </div>

    <!-- 对比选择触发按钮 -->
    <div class="flex items-center space-x-1.5">
      <button
        type="button"
        @click="isOpen = !isOpen"
        class="flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-left transition-colors cursor-pointer"
      >
        <div class="flex items-center space-x-2 min-w-0">
          <GitCompare class="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span class="text-xs text-zinc-400 font-mono">基准:</span>
          <span class="font-mono text-xs text-zinc-200 font-semibold truncate">
            {{ baseBranch || '选择基准分支' }}
          </span>
        </div>
        <ChevronDown class="w-3.5 h-3.5 text-zinc-500 shrink-0 ml-1 transition-transform" :class="{ 'rotate-180': isOpen }" />
      </button>
    </div>

    <!-- 分支选择下拉面板 -->
    <div
      v-if="isOpen"
      class="absolute left-2.5 right-2.5 top-[calc(100%+4px)] z-50 bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl overflow-hidden p-1 max-h-[220px] overflow-y-auto"
    >
      <div
        v-for="branch in branches"
        :key="branch.name"
        @click="handleSelect(branch.name)"
        class="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-800 cursor-pointer text-xs font-mono transition-colors"
        :class="baseBranch === branch.name ? 'bg-indigo-500/15 text-indigo-300 font-medium' : 'text-zinc-300'"
      >
        <div class="flex items-center space-x-2 truncate">
          <GitBranch class="w-3.5 h-3.5" :class="baseBranch === branch.name ? 'text-indigo-400' : 'text-zinc-500'" />
          <span class="truncate">{{ branch.name }}</span>
        </div>
        <span v-if="branch.isCurrent" class="text-[10px] px-1 rounded bg-zinc-800 text-zinc-400">当前</span>
      </div>
    </div>
  </div>
</template>

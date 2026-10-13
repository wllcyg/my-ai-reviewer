<script setup lang="ts">
import { ref, computed } from 'vue'
import { GitCommit as GitCommitIcon, ChevronDown, Search, User, Calendar, Check } from 'lucide-vue-next'
import type { GitCommit } from '../../../preload/git-types'

const props = defineProps<{
  commits: GitCommit[]
  selectedCommit: GitCommit | null
  isLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'select', commit: GitCommit): void
}>()

const isOpen = ref(false)
const searchQuery = ref('')

const filteredCommits = computed(() => {
  if (!searchQuery.value.trim()) return props.commits
  const q = searchQuery.value.toLowerCase().trim()
  return props.commits.filter(
    (c) =>
      c.message.toLowerCase().includes(q) ||
      c.shortHash.toLowerCase().includes(q) ||
      c.author.toLowerCase().includes(q)
  )
})

const handleSelect = (commit: GitCommit): void => {
  emit('select', commit)
  isOpen.value = false
}
</script>

<template>
  <div class="relative px-2.5 py-1.5 border-b border-zinc-800/80 bg-zinc-950/40 select-none">
    <div class="text-[10px] text-zinc-500 font-mono uppercase mb-1 flex items-center justify-between">
      <span>选择审查提交 (Commit)</span>
      <span class="text-zinc-600">共 {{ commits.length }} 条</span>
    </div>

    <!-- 触发按钮 -->
    <button
      type="button"
      @click="isOpen = !isOpen"
      class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-left transition-colors cursor-pointer"
    >
      <div v-if="selectedCommit" class="flex items-center space-x-2 min-w-0 pr-1">
        <GitCommitIcon class="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span class="font-mono text-[10px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
          {{ selectedCommit.shortHash }}
        </span>
        <span class="text-xs text-zinc-200 truncate font-medium">
          {{ selectedCommit.message }}
        </span>
      </div>
      <div v-else class="text-xs text-zinc-500 flex items-center space-x-1.5">
        <GitCommitIcon class="w-3.5 h-3.5 text-zinc-600" />
        <span>点击选择提交记录...</span>
      </div>
      <ChevronDown class="w-3.5 h-3.5 text-zinc-500 shrink-0 ml-1 transition-transform" :class="{ 'rotate-180': isOpen }" />
    </button>

    <!-- 下拉弹窗 -->
    <div
      v-if="isOpen"
      class="absolute left-2.5 right-2.5 top-[calc(100%+4px)] z-50 bg-zinc-900 border border-zinc-750 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[320px]"
    >
      <!-- 搜索过滤 -->
      <div class="p-2 border-b border-zinc-800 bg-zinc-950/60 flex items-center relative">
        <Search class="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索提交说明 / Hash / 作者..."
          class="w-full bg-zinc-900 border border-zinc-800 focus:border-indigo-500/60 rounded px-2 pl-7 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none"
        />
      </div>

      <!-- 提交列表 -->
      <div class="flex-1 overflow-y-auto p-1 divide-y divide-zinc-850">
        <div
          v-for="commit in filteredCommits"
          :key="commit.hash"
          @click="handleSelect(commit)"
          class="p-2 rounded-md hover:bg-zinc-800/90 cursor-pointer transition-colors text-xs flex flex-col space-y-1"
          :class="selectedCommit?.hash === commit.hash ? 'bg-zinc-800/70 border-l-2 border-indigo-500' : ''"
        >
          <div class="flex items-center justify-between">
            <span class="font-mono text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 px-1 rounded">
              {{ commit.shortHash }}
            </span>
            <div class="flex items-center space-x-2 text-[10px] text-zinc-500 font-mono">
              <span class="flex items-center space-x-0.5"><User class="w-2.5 h-2.5" /><span>{{ commit.author }}</span></span>
              <span class="flex items-center space-x-0.5"><Calendar class="w-2.5 h-2.5" /><span>{{ commit.date }}</span></span>
              <Check v-if="selectedCommit?.hash === commit.hash" class="w-3 h-3 text-emerald-400" />
            </div>
          </div>
          <p class="text-zinc-200 text-xs font-medium line-clamp-2 leading-tight">
            {{ commit.message }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

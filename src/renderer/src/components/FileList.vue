<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  RotateCw,
  Search,
  FileCode,
  FolderGit2,
  CheckCircle2,
  AlertCircle,
  Layers,
  GitCommit as GitCommitIcon,
  GitCompare
} from 'lucide-vue-next'
import CommitPicker from './CommitPicker.vue'
import BranchPicker from './BranchPicker.vue'
import type {
  BranchInfo,
  GitChangedFile,
  GitCommit,
  GitFileStatusCode,
  ReviewSourceMode
} from '../../../preload/git-types'

const props = defineProps<{
  files: GitChangedFile[]
  selectedFilePath: string | null
  isLoading: boolean
  isGitRepo: boolean
  errorMessage?: string
  sourceMode: ReviewSourceMode
  commits: GitCommit[]
  selectedCommit: GitCommit | null
  branches: BranchInfo[]
  currentBranch: string
  baseBranch: string
}>()

const emit = defineEmits<{
  (e: 'select', filePath: string): void
  (e: 'refresh'): void
  (e: 'switch-mode', mode: ReviewSourceMode): void
  (e: 'select-commit', commit: GitCommit): void
  (e: 'select-base-branch', branchName: string): void
}>()

const searchQuery = ref('')

const filteredFiles = computed(() => {
  if (!searchQuery.value.trim()) return props.files
  const query = searchQuery.value.toLowerCase().trim()
  return props.files.filter(
    (file) => file.path.toLowerCase().includes(query) || file.filename.toLowerCase().includes(query)
  )
})

const getStatusMeta = (status: GitFileStatusCode) => {
  switch (status) {
    case 'added':
      return { label: 'A', textClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10 border-emerald-500/20' }
    case 'modified':
      return { label: 'M', textClass: 'text-amber-400', bgClass: 'bg-amber-500/10 border-amber-500/20' }
    case 'deleted':
      return { label: 'D', textClass: 'text-rose-400', bgClass: 'bg-rose-500/10 border-rose-500/20' }
    case 'renamed':
      return { label: 'R', textClass: 'text-purple-400', bgClass: 'bg-purple-500/10 border-purple-500/20' }
    case 'untracked':
    default:
      return { label: 'U', textClass: 'text-sky-400', bgClass: 'bg-sky-500/10 border-sky-500/20' }
  }
}
</script>

<template>
  <aside class="w-68 bg-zinc-900/80 border-r border-zinc-800 flex flex-col shrink-0 select-none overflow-hidden">
    <!-- 顶部：审查模式切换胶囊 (Zed 极简暗黑风格) -->
    <div class="p-2 border-b border-zinc-800/80 bg-zinc-950/60 shrink-0">
      <div class="grid grid-cols-3 gap-1 p-0.5 bg-zinc-900 rounded-md border border-zinc-800 text-[11px] font-medium">
        <button
          type="button"
          @click="emit('switch-mode', 'working')"
          class="flex items-center justify-center space-x-1 py-1 rounded transition-colors cursor-pointer"
          :class="sourceMode === 'working' ? 'bg-zinc-800 text-zinc-100 shadow-sm font-semibold' : 'text-zinc-500 hover:text-zinc-300'"
          title="审查当前未提交的工作区变更"
        >
          <Layers class="w-3 h-3" />
          <span>工作区</span>
        </button>

        <button
          type="button"
          @click="emit('switch-mode', 'commit')"
          class="flex items-center justify-center space-x-1 py-1 rounded transition-colors cursor-pointer"
          :class="sourceMode === 'commit' ? 'bg-zinc-800 text-zinc-100 shadow-sm font-semibold' : 'text-zinc-500 hover:text-zinc-300'"
          title="选择历史提交记录进行审查"
        >
          <GitCommitIcon class="w-3 h-3" />
          <span>提交</span>
        </button>

        <button
          type="button"
          @click="emit('switch-mode', 'branch')"
          class="flex items-center justify-center space-x-1 py-1 rounded transition-colors cursor-pointer"
          :class="sourceMode === 'branch' ? 'bg-zinc-800 text-zinc-100 shadow-sm font-semibold' : 'text-zinc-500 hover:text-zinc-300'"
          title="对比分支间的所有累积差异"
        >
          <GitCompare class="w-3 h-3" />
          <span>分支</span>
        </button>
      </div>
    </div>

    <!-- 动态模式专属选择器 -->
    <div v-if="isGitRepo" class="shrink-0">
      <!-- 提交记录选择器 -->
      <CommitPicker
        v-if="sourceMode === 'commit'"
        :commits="commits"
        :selected-commit="selectedCommit"
        :is-loading="isLoading"
        @select="(c) => emit('select-commit', c)"
      />

      <!-- 分支比对选择器 -->
      <BranchPicker
        v-else-if="sourceMode === 'branch'"
        :branches="branches"
        :current-branch="currentBranch"
        :base-branch="baseBranch"
        :is-loading="isLoading"
        @select-base="(b) => emit('select-base-branch', b)"
      />
    </div>

    <!-- 顶栏：统计与刷新 -->
    <div class="h-9 px-3 border-b border-zinc-800/80 flex items-center justify-between text-xs text-zinc-300 font-medium shrink-0 bg-zinc-900/40">
      <div class="flex items-center space-x-2">
        <span class="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">变更文件</span>
        <span
          class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium"
          :class="files.length > 0 ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-zinc-800 text-zinc-500'"
        >
          {{ files.length }}
        </span>
      </div>

      <button
        type="button"
        @click="emit('refresh')"
        :disabled="isLoading"
        aria-label="刷新变更状态"
        class="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-40 cursor-pointer"
      >
        <RotateCw class="w-3.5 h-3.5" :class="{ 'animate-spin text-indigo-400': isLoading }" />
      </button>
    </div>

    <!-- 过滤搜索框 -->
    <div v-if="files.length > 4" class="px-2.5 py-1.5 border-b border-zinc-800/60 shrink-0">
      <div class="relative flex items-center">
        <Search class="w-3.5 h-3.5 text-zinc-500 absolute left-2 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="过滤变更文件..."
          class="w-full bg-zinc-950/80 border border-zinc-800 focus:border-indigo-500/60 rounded px-2 pl-7 py-1 text-[11px] text-zinc-200 placeholder-zinc-600 outline-none transition-colors"
        />
      </div>
    </div>

    <!-- 列表展示区 -->
    <div class="flex-1 overflow-y-auto py-1">
      <div v-if="errorMessage" class="p-3 m-2 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start space-x-2">
        <AlertCircle class="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <span class="text-[11px] leading-relaxed">{{ errorMessage }}</span>
      </div>

      <div v-else-if="!isGitRepo" class="h-full flex flex-col items-center justify-center p-4 text-center text-zinc-500 text-xs">
        <FolderGit2 class="w-8 h-8 text-zinc-700 mb-2 stroke-[1.5]" />
        <p class="font-medium text-zinc-400">未选择 Git 仓库</p>
        <p class="text-[11px] text-zinc-600 mt-1">请从顶栏打开本地项目</p>
      </div>

      <div v-else-if="files.length === 0" class="h-full flex flex-col items-center justify-center p-4 text-center text-zinc-500 text-xs">
        <CheckCircle2 class="w-8 h-8 text-emerald-500/70 mb-2 stroke-[1.5]" />
        <p class="font-medium text-zinc-300">无改动文件</p>
        <p class="text-[11px] text-zinc-600 mt-1">当前选定的比对源没有文件差异</p>
      </div>

      <div v-else class="space-y-0.5 px-1.5">
        <div
          v-for="file in filteredFiles"
          :key="file.path"
          @click="emit('select', file.path)"
          class="group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-all relative border"
          :class="
            selectedFilePath === file.path
              ? 'bg-zinc-800/90 text-zinc-100 border-zinc-700 shadow-sm'
              : 'border-transparent text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200'
          "
        >
          <div
            v-if="selectedFilePath === file.path"
            class="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-500 rounded-r"
          ></div>

          <div class="flex items-center space-x-2 min-w-0 pr-1.5 pl-1">
            <FileCode
              class="w-3.5 h-3.5 shrink-0 transition-colors"
              :class="selectedFilePath === file.path ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-400'"
            />
            <div class="flex flex-col min-w-0">
              <span class="truncate font-mono text-[11px] leading-tight font-medium" :title="file.filename">
                {{ file.filename }}
              </span>
              <span
                v-if="file.directory"
                class="truncate font-mono text-[9px] text-zinc-500 leading-tight group-hover:text-zinc-400"
                :title="file.directory"
              >
                {{ file.directory }}
              </span>
            </div>
          </div>

          <span
            class="shrink-0 w-4 h-4 rounded flex items-center justify-center font-mono text-[10px] font-bold border"
            :class="[getStatusMeta(file.status).textClass, getStatusMeta(file.status).bgClass]"
            :title="file.status"
          >
            {{ getStatusMeta(file.status).label }}
          </span>
        </div>
      </div>
    </div>
  </aside>
</template>

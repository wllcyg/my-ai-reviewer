<script setup lang="ts">
import { computed } from 'vue'
import TitleBar from './components/TitleBar.vue'
import FileList from './components/FileList.vue'
import DiffEditor from './components/DiffEditor.vue'
import ReviewPanel from './components/ReviewPanel.vue'
import { useGitDiff } from './composables/useGitDiff'
import { useAIReviewer } from './composables/useAIReviewer'
import {
  GitBranch,
  Sparkles,
  Layers,
  FolderGit2,
  GitCommit as GitCommitIcon,
  GitCompare,
  Cpu
} from 'lucide-vue-next'

// Git 数据状态
const {
  currentProject,
  branchName,
  isGitRepo,
  repoErrorMessage,
  sourceMode,
  changedFiles,
  selectedFilePath,
  currentDiff,
  commits,
  selectedCommit,
  branches,
  baseBranch,
  isLoadingRepo,
  isLoadingDiff,
  loadRepo,
  switchSourceMode,
  selectCommit,
  selectBaseBranch,
  selectFile,
  refresh
} = useGitDiff()

// AI 审查状态与 RAF 打字机
const {
  isReviewing,
  isThinking,
  isThinkingExpanded,
  thinkingText,
  reviewText,
  errorMessage: aiErrorMessage,
  aiConfig,
  triggerReview,
  cancelReview,
  saveConfig
} = useAIReviewer()

// 切换选择目录时加载 Git 仓库
const handleSelectDirectory = (dirPath: string): void => {
  loadRepo(dirPath)
}

// 唤起选择目录弹窗
const handleOpenFolderDialog = async (): Promise<void> => {
  const path = await window.api.openDirectoryDialog()
  if (path) {
    loadRepo(path)
  }
}

// 触发 AI 审查当前选定差异
const handleStartReview = async (): Promise<void> => {
  if (!currentDiff.value) return
  await triggerReview(currentDiff.value.diffText, currentDiff.value.filePath)
}

// 计算当前 Diff 面板上展示的对比来源描述
const currentSourceLabel = computed<string>(() => {
  if (sourceMode.value === 'commit' && selectedCommit.value) {
    return `提交 [${selectedCommit.value.shortHash}]: ${selectedCommit.value.message}`
  }
  if (sourceMode.value === 'branch' && baseBranch.value) {
    return `分支对比: ${baseBranch.value} ... ${branchName.value}`
  }
  return '工作区未提交变更'
})
</script>

<template>
  <div class="flex flex-col h-screen w-screen bg-zinc-950 text-zinc-200 overflow-hidden select-none">
    <!-- 顶部 Zed 风格标题栏 -->
    <TitleBar :current-path="currentProject" @select-directory="handleSelectDirectory" />

    <!-- 主工作区：三栏布局 -->
    <main class="flex-1 flex overflow-hidden">
      <!-- 左栏：多模式变更文件列表 -->
      <FileList
        :files="changedFiles"
        :selected-file-path="selectedFilePath"
        :is-loading="isLoadingRepo"
        :is-git-repo="isGitRepo"
        :error-message="repoErrorMessage"
        :source-mode="sourceMode"
        :commits="commits"
        :selected-commit="selectedCommit"
        :branches="branches"
        :current-branch="branchName"
        :base-branch="baseBranch"
        @select="selectFile"
        @refresh="refresh"
        @switch-mode="switchSourceMode"
        @select-commit="selectCommit"
        @select-base-branch="selectBaseBranch"
      />

      <!-- 中间主视图：Monaco Diff 差异编辑器 -->
      <section class="flex-1 flex flex-col relative overflow-hidden bg-zinc-950">
        <!-- 未选择项目时的欢迎引导 -->
        <div
          v-if="!currentProject"
          class="flex-1 flex flex-col items-center justify-center p-6 text-center select-none"
        >
          <div class="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 shadow-xl shadow-black/40">
            <Sparkles class="w-7 h-7 text-indigo-400" />
          </div>
          <h2 class="text-lg font-semibold tracking-tight text-zinc-100">Zed 风格 AI 代码审查工作台</h2>
          <p class="text-xs text-zinc-400 max-w-md mt-1.5 leading-relaxed">
            轻量无边框暗黑质感，支持工作区、提交及分支间 Diff 比对与流式思考链深度审查。
          </p>
          <div class="mt-6">
            <button
              type="button"
              @click="handleOpenFolderDialog"
              class="flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <FolderGit2 class="w-4 h-4" />
              <span>打开本地 Git 仓库</span>
            </button>
          </div>
        </div>

        <!-- 已选定项目，渲染 Monaco Diff 编辑器 -->
        <DiffEditor
          v-else
          :diff-data="currentDiff"
          :is-loading="isLoadingDiff"
          :source-label="currentSourceLabel"
        />
      </section>

      <!-- 右栏：AI 审查侧边栏 (阶段三核心组件) -->
      <ReviewPanel
        :is-reviewing="isReviewing"
        :is-thinking="isThinking"
        :is-thinking-expanded="isThinkingExpanded"
        :thinking-text="thinkingText"
        :review-text="reviewText"
        :error-message="aiErrorMessage"
        :ai-config="aiConfig"
        :has-diff="Boolean(currentDiff && currentDiff.diffText)"
        @start-review="handleStartReview"
        @stop-review="cancelReview"
        @update-config="saveConfig"
        @toggle-thinking="isThinkingExpanded = !isThinkingExpanded"
      />
    </main>

    <!-- 底部状态栏 -->
    <footer class="h-6 bg-zinc-900 border-t border-zinc-800 px-3 flex items-center justify-between text-[11px] text-zinc-400 shrink-0 font-mono">
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-1.5 text-zinc-300">
          <GitBranch class="w-3 h-3 text-indigo-400" />
          <span>{{ isGitRepo ? branchName : '无仓库' }}</span>
        </div>
        <div class="h-3 w-[1px] bg-zinc-800"></div>

        <!-- 模式徽章提示 -->
        <div class="flex items-center space-x-1 text-zinc-300">
          <Layers v-if="sourceMode === 'working'" class="w-3 h-3 text-zinc-400" />
          <GitCommitIcon v-else-if="sourceMode === 'commit'" class="w-3 h-3 text-indigo-400" />
          <GitCompare v-else class="w-3 h-3 text-emerald-400" />
          <span class="capitalize">{{ sourceMode }} 模式</span>
        </div>

        <div class="h-3 w-[1px] bg-zinc-800"></div>
        <div class="flex items-center space-x-1 text-zinc-400">
          <span>{{ changedFiles.length }} 个文件变更</span>
        </div>
      </div>

      <div class="flex items-center space-x-3 text-zinc-500">
        <span class="flex items-center space-x-1.5">
          <Cpu class="w-3 h-3" :class="isReviewing ? 'text-amber-400 animate-spin' : 'text-indigo-400'" />
          <span class="text-zinc-300">{{ aiConfig.modelId }}</span>
        </span>
        <div class="h-3 w-[1px] bg-zinc-800"></div>
        <span class="flex items-center space-x-1">
          <span class="w-1.5 h-1.5 rounded-full" :class="isReviewing ? 'bg-amber-400 animate-ping' : (isGitRepo ? 'bg-emerald-400' : 'bg-zinc-600')"></span>
          <span class="text-zinc-400">{{ isReviewing ? 'AI Reviewing' : (isGitRepo ? 'Ready' : 'Idle') }}</span>
        </span>
      </div>
    </footer>
  </div>
</template>

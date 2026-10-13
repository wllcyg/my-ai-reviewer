import { ref, shallowRef } from 'vue'
import type {
  BranchInfo,
  GitChangedFile,
  GitCommit,
  GitFileDiff,
  GitRepoStatus,
  ReviewSourceMode
} from '../../../preload/git-types'

export function useGitDiff() {
  const currentProject = ref<string>('')
  const branchName = ref<string>('main')
  const isGitRepo = ref<boolean>(false)
  const repoErrorMessage = ref<string>('')

  // 审查源模式：working (工作区未提交) | commit (指定提交记录) | branch (两分支对比)
  const sourceMode = ref<ReviewSourceMode>('working')

  // 文件列表与当前选中项
  const changedFiles = ref<GitChangedFile[]>([])
  const selectedFilePath = ref<string | null>(null)
  const currentDiff = shallowRef<GitFileDiff | null>(null)

  // 提交记录与选中的提交
  const commits = ref<GitCommit[]>([])
  const selectedCommit = ref<GitCommit | null>(null)

  // 分支列表与比对基准分支
  const branches = ref<BranchInfo[]>([])
  const baseBranch = ref<string>('')

  // 状态指示
  const isLoadingRepo = ref<boolean>(false)
  const isLoadingDiff = ref<boolean>(false)

  // ⚡ 性能优化：前端 Diff 内存快速缓存池（点选过的文件 0ms 秒开）
  const diffCache = new Map<string, GitFileDiff>()
  let activeRequestId = 0

  const getDiffCacheKey = (filePath: string): string => {
    if (sourceMode.value === 'commit') {
      return `commit:${selectedCommit.value?.hash || ''}:${filePath}`
    }
    if (sourceMode.value === 'branch') {
      return `branch:${baseBranch.value}..${branchName.value}:${filePath}`
    }
    return `working:${filePath}`
  }

  // 加载仓库基础信息（分支列表、提交记录、默认工作区状态）
  const loadRepo = async (dirPath: string): Promise<void> => {
    if (!dirPath) return
    diffCache.clear()
    currentProject.value = dirPath
    isLoadingRepo.value = true
    repoErrorMessage.value = ''

    try {
      const status: GitRepoStatus = await window.api.getRepoStatus(dirPath)
      isGitRepo.value = status.isGitRepo
      branchName.value = status.branch || 'unknown'

      if (!status.isGitRepo) {
        repoErrorMessage.value = status.errorMessage || '非 Git 仓库'
        changedFiles.value = []
        selectedFilePath.value = null
        currentDiff.value = null
        return
      }

      // 并行异步加载分支列表与最近提交
      const [fetchedBranches, fetchedCommits] = await Promise.all([
        window.api.getBranches(dirPath),
        window.api.getCommits(dirPath, 50)
      ])

      branches.value = fetchedBranches
      commits.value = fetchedCommits

      // 默认基准分支推导（优先选择 main 或 master，否则选列表除当前外的第一个）
      const candidateBase = fetchedBranches.find(
        (b) => !b.isCurrent && (b.name === 'main' || b.name === 'master' || b.name === 'origin/main')
      )
      baseBranch.value = candidateBase?.name || fetchedBranches.find((b) => !b.isCurrent)?.name || ''

      // 默认按当前模式初始化文件列表
      await applySourceModeData()
    } catch (err: unknown) {
      repoErrorMessage.value = err instanceof Error ? err.message : String(err)
      isGitRepo.value = false
    } finally {
      isLoadingRepo.value = false
    }
  }

  // 根据当前选择的 sourceMode 刷新文件列表
  const applySourceModeData = async (): Promise<void> => {
    if (!currentProject.value || !isGitRepo.value) return
    isLoadingRepo.value = true

    try {
      if (sourceMode.value === 'working') {
        const status = await window.api.getRepoStatus(currentProject.value)
        changedFiles.value = status.files
      } else if (sourceMode.value === 'commit') {
        if (!selectedCommit.value && commits.value.length > 0) {
          selectedCommit.value = commits.value[0]
        }
        if (selectedCommit.value) {
          changedFiles.value = await window.api.getCommitFiles(
            currentProject.value,
            selectedCommit.value.hash
          )
        } else {
          changedFiles.value = []
        }
      } else if (sourceMode.value === 'branch') {
        if (baseBranch.value && branchName.value) {
          changedFiles.value = await window.api.getBranchDiffFiles(
            currentProject.value,
            baseBranch.value,
            branchName.value
          )
        } else {
          changedFiles.value = []
        }
      }

      // 默认高亮选中首个文件
      if (changedFiles.value.length > 0) {
        const stillExists = changedFiles.value.some((f) => f.path === selectedFilePath.value)
        const targetPath = stillExists && selectedFilePath.value ? selectedFilePath.value : changedFiles.value[0].path
        await selectFile(targetPath)
      } else {
        selectedFilePath.value = null
        currentDiff.value = null
      }
    } catch (err: unknown) {
      console.error('刷新审查源文件失败:', err)
      changedFiles.value = []
    } finally {
      isLoadingRepo.value = false
    }
  }

  // 切换审查源模式 (工作区 / 提交记录 / 分支对比)
  const switchSourceMode = async (mode: ReviewSourceMode): Promise<void> => {
    if (sourceMode.value === mode) return
    diffCache.clear()
    sourceMode.value = mode
    await applySourceModeData()
  }

  // 选中特定 Commit 审查
  const selectCommit = async (commit: GitCommit): Promise<void> => {
    diffCache.clear()
    selectedCommit.value = commit
    sourceMode.value = 'commit'
    isLoadingRepo.value = true
    try {
      changedFiles.value = await window.api.getCommitFiles(currentProject.value, commit.hash)
      if (changedFiles.value.length > 0) {
        await selectFile(changedFiles.value[0].path)
      } else {
        selectedFilePath.value = null
        currentDiff.value = null
      }
    } finally {
      isLoadingRepo.value = false
    }
  }

  // 选中基准分支进行对比
  const selectBaseBranch = async (targetBaseBranch: string): Promise<void> => {
    diffCache.clear()
    baseBranch.value = targetBaseBranch
    sourceMode.value = 'branch'
    isLoadingRepo.value = true
    try {
      changedFiles.value = await window.api.getBranchDiffFiles(
        currentProject.value,
        targetBaseBranch,
        branchName.value
      )
      if (changedFiles.value.length > 0) {
        await selectFile(changedFiles.value[0].path)
      } else {
        selectedFilePath.value = null
        currentDiff.value = null
      }
    } finally {
      isLoadingRepo.value = false
    }
  }

  // 选中文件并异步提取对应的 Diff（支持内存缓存极速回显与防竞态丢帧）
  const selectFile = async (filePath: string): Promise<void> => {
    if (!currentProject.value || !filePath) return
    selectedFilePath.value = filePath

    // ⚡ 1. 命中内存缓存时瞬间秒开，无需显示 Loading 也无 IPC 开销
    const cacheKey = getDiffCacheKey(filePath)
    if (diffCache.has(cacheKey)) {
      currentDiff.value = diffCache.get(cacheKey) || null
      isLoadingDiff.value = false
      return
    }

    const requestId = ++activeRequestId
    isLoadingDiff.value = true

    try {
      let diffData: GitFileDiff | null = null

      if (sourceMode.value === 'commit' && selectedCommit.value) {
        diffData = await window.api.getCommitFileDiff(
          currentProject.value,
          selectedCommit.value.hash,
          filePath
        )
      } else if (sourceMode.value === 'branch' && baseBranch.value) {
        diffData = await window.api.getBranchFileDiff(
          currentProject.value,
          baseBranch.value,
          branchName.value,
          filePath
        )
      } else {
        diffData = await window.api.getFileDiff(currentProject.value, filePath)
      }

      // ⚡ 2. 竞态保护：如果用户在此期间已点选了其他文件，则丢弃旧请求结果
      if (requestId !== activeRequestId) {
        return
      }

      if (diffData) {
        diffCache.set(cacheKey, diffData)
      }
      currentDiff.value = diffData
    } catch (err: unknown) {
      if (requestId === activeRequestId) {
        console.error('加载 Diff 失败:', err)
        currentDiff.value = null
      }
    } finally {
      if (requestId === activeRequestId) {
        isLoadingDiff.value = false
      }
    }
  }

  const refresh = async (): Promise<void> => {
    diffCache.clear()
    if (currentProject.value) {
      await applySourceModeData()
    }
  }

  return {
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
  }
}

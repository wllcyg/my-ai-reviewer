import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import type {
  GitRepoStatus,
  GitFileDiff,
  BranchInfo,
  GitCommit,
  GitChangedFile
} from './git-types'
import type {
  AIReviewConfig,
  ReviewStreamPayload,
  StartReviewParams
} from './ai-types'

export type {
  GitRepoStatus,
  GitFileDiff,
  GitChangedFile,
  GitFileStatusCode,
  BranchInfo,
  GitCommit,
  ReviewSourceMode
} from './git-types'
export type { AIReviewConfig, ReviewStreamPayload, StartReviewParams } from './ai-types'

// Custom APIs for renderer
export interface CustomAPI {
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  isWindowMaximized: () => Promise<boolean>
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void
  openDirectoryDialog: () => Promise<string | null>
  getRepoStatus: (projectPath: string) => Promise<GitRepoStatus>
  getFileDiff: (projectPath: string, filePath: string) => Promise<GitFileDiff>
  getBranches: (projectPath: string) => Promise<BranchInfo[]>
  getCommits: (projectPath: string, limit?: number) => Promise<GitCommit[]>
  getCommitFiles: (projectPath: string, commitHash: string) => Promise<GitChangedFile[]>
  getCommitFileDiff: (
    projectPath: string,
    commitHash: string,
    filePath: string
  ) => Promise<GitFileDiff>
  getBranchDiffFiles: (
    projectPath: string,
    baseBranch: string,
    targetBranch: string
  ) => Promise<GitChangedFile[]>
  getBranchFileDiff: (
    projectPath: string,
    baseBranch: string,
    targetBranch: string,
    filePath: string
  ) => Promise<GitFileDiff>
  startReview: (params: StartReviewParams) => Promise<void>
  stopReview: () => Promise<void>
  getAIConfig: () => Promise<AIReviewConfig>
  updateAIConfig: (config: Partial<AIReviewConfig>) => Promise<AIReviewConfig>
  onReviewStream: (callback: (payload: ReviewStreamPayload) => void) => () => void
}

const api: CustomAPI = {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: IpcRendererEvent, isMaximized: boolean): void => {
      callback(isMaximized)
    }
    ipcRenderer.on('window:maximize-change', listener)
    return () => {
      ipcRenderer.removeListener('window:maximize-change', listener)
    }
  },
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:open-directory'),
  getRepoStatus: (projectPath: string) => ipcRenderer.invoke('git:get-repo-status', projectPath),
  getFileDiff: (projectPath: string, filePath: string) =>
    ipcRenderer.invoke('git:get-file-diff', projectPath, filePath),
  getBranches: (projectPath: string) => ipcRenderer.invoke('git:get-branches', projectPath),
  getCommits: (projectPath: string, limit?: number) =>
    ipcRenderer.invoke('git:get-commits', projectPath, limit),
  getCommitFiles: (projectPath: string, commitHash: string) =>
    ipcRenderer.invoke('git:get-commit-files', projectPath, commitHash),
  getCommitFileDiff: (projectPath: string, commitHash: string, filePath: string) =>
    ipcRenderer.invoke('git:get-commit-file-diff', projectPath, commitHash, filePath),
  getBranchDiffFiles: (projectPath: string, baseBranch: string, targetBranch: string) =>
    ipcRenderer.invoke('git:get-branch-diff-files', projectPath, baseBranch, targetBranch),
  getBranchFileDiff: (
    projectPath: string,
    baseBranch: string,
    targetBranch: string,
    filePath: string
  ) =>
    ipcRenderer.invoke('git:get-branch-file-diff', projectPath, baseBranch, targetBranch, filePath),
  startReview: (params: StartReviewParams) => ipcRenderer.invoke('ai:start-review', params),
  stopReview: () => ipcRenderer.invoke('ai:stop-review'),
  getAIConfig: () => ipcRenderer.invoke('ai:get-config'),
  updateAIConfig: (config: Partial<AIReviewConfig>) => ipcRenderer.invoke('ai:update-config', config),
  onReviewStream: (callback: (payload: ReviewStreamPayload) => void) => {
    const listener = (_event: IpcRendererEvent, payload: ReviewStreamPayload): void => {
      callback(payload)
    }
    ipcRenderer.on('review:stream', listener)
    return () => {
      ipcRenderer.removeListener('review:stream', listener)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  getRepoStatus,
  getFileDiff,
  getRepoBranches,
  getRecentCommits,
  getCommitFiles,
  getCommitFileDiff,
  getBranchDiffFiles,
  getBranchFileDiff
} from './services/git'
import {
  startReview,
  stopCurrentReview,
  getStoredAIConfig,
  updateStoredAIConfig
} from './services/ai'
import type { StartReviewParams, AIReviewConfig } from '../preload/ai-types'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // 创建 Zed 极简暗黑风格无边框主窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false, // 隐藏原生窗口边框
    titleBarStyle: 'hiddenInset', // 适配 macOS 红绿灯控件
    backgroundColor: '#18181b', // 炭黑底色 (zinc-900) 防白屏闪烁
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 窗口最大化/还原状态监听并通知渲染进程
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximize-change', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximize-change', false)
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 注册窗口控制及系统交互 IPC 管道
function registerIpcHandlers(): void {
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })

  ipcMain.handle('window:close', () => {
    mainWindow?.close()
  })

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow?.isMaximized() ?? false
  })

  // 选择本地项目/Git 仓库目录
  ipcMain.handle('dialog:open-directory', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择代码仓库目录'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  // 异步扫描 Git 仓库状态与变更文件列表
  ipcMain.handle('git:get-repo-status', async (_event, projectPath: string) => {
    return await getRepoStatus(projectPath)
  })

  // 异步获取指定文件的前后差异内容与 Diff 文本
  ipcMain.handle('git:get-file-diff', async (_event, projectPath: string, filePath: string) => {
    return await getFileDiff(projectPath, filePath)
  })

  // 异步获取分支列表
  ipcMain.handle('git:get-branches', async (_event, projectPath: string) => {
    return await getRepoBranches(projectPath)
  })

  // 异步获取最近提交历史
  ipcMain.handle('git:get-commits', async (_event, projectPath: string, limit?: number) => {
    return await getRecentCommits(projectPath, limit)
  })

  // 异步获取指定提交包含的变更文件
  ipcMain.handle('git:get-commit-files', async (_event, projectPath: string, commitHash: string) => {
    return await getCommitFiles(projectPath, commitHash)
  })

  // 异步获取指定提交下某文件的 Diff
  ipcMain.handle(
    'git:get-commit-file-diff',
    async (_event, projectPath: string, commitHash: string, filePath: string) => {
      return await getCommitFileDiff(projectPath, commitHash, filePath)
    }
  )

  // 异步获取两分支间对比的变更文件
  ipcMain.handle(
    'git:get-branch-diff-files',
    async (_event, projectPath: string, baseBranch: string, targetBranch: string) => {
      return await getBranchDiffFiles(projectPath, baseBranch, targetBranch)
    }
  )

    ipcMain.handle(
    'git:get-branch-file-diff',
    async (
      _event,
      projectPath: string,
      baseBranch: string,
      targetBranch: string,
      filePath: string
    ) => {
      return await getBranchFileDiff(projectPath, baseBranch, targetBranch, filePath)
    }
  )

  // AI 代码审查触发与流式管道
  ipcMain.handle('ai:start-review', async (_event, params: StartReviewParams) => {
    if (!mainWindow) return
    await startReview(mainWindow, params)
  })

  // 中断当前 AI 审查
  ipcMain.handle('ai:stop-review', () => {
    stopCurrentReview()
  })

  // 获取与持久化更新 AI 配置
  ipcMain.handle('ai:get-config', () => {
    return getStoredAIConfig()
  })

  ipcMain.handle('ai:update-config', (_event, newConfig: Partial<AIReviewConfig>) => {
    return updateStoredAIConfig(newConfig)
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ai-reviewer.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

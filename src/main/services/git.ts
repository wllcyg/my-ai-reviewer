import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type {
  BranchInfo,
  GitChangedFile,
  GitCommit,
  GitFileDiff,
  GitFileStatusCode,
  GitRepoStatus
} from '../../preload/git-types'

const execAsync = promisify(exec)

// 根据文件扩展名推导 Monaco 语法高亮
export function detectLanguageByFilePath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.vue': 'html',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.json': 'json',
    '.jsonc': 'json',
    '.md': 'markdown',
    '.markdown': 'markdown',
    '.yml': 'yaml',
    '.yaml': 'yaml',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.sql': 'sql',
    '.xml': 'xml'
  }
  return map[ext] || 'plaintext'
}

// 辅助方法：解析 Git name-status 格式行为结构化文件列表
function parseNameStatusLines(lines: string[]): GitChangedFile[] {
  const files: GitChangedFile[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.trim().split(/\t+/)
    if (parts.length < 2) continue

    const statusLetter = parts[0].charAt(0).toUpperCase()
    let rawFilePath = parts[parts.length - 1]

    if (rawFilePath.startsWith('"') && rawFilePath.endsWith('"')) {
      rawFilePath = rawFilePath.slice(1, -1)
    }

    let status: GitFileStatusCode = 'modified'
    if (statusLetter === 'A') {
      status = 'added'
    } else if (statusLetter === 'D') {
      status = 'deleted'
    } else if (statusLetter === 'R') {
      status = 'renamed'
    } else {
      status = 'modified'
    }

    const normalizedPath = rawFilePath.replace(/\\/g, '/')
    const filename = path.posix.basename(normalizedPath)
    const directory = path.posix.dirname(normalizedPath)

    files.push({
      path: normalizedPath,
      filename,
      directory: directory === '.' ? '' : directory,
      status,
      staged: false
    })
  }

  return files
}

// 1. 异步获取工作区状态（默认 Working Tree 模式）
export async function getRepoStatus(projectPath: string): Promise<GitRepoStatus> {
  if (!projectPath) {
    return {
      isGitRepo: false,
      rootPath: '',
      branch: '',
      files: [],
      errorMessage: '路径为空'
    }
  }

  try {
    const { stdout: rootPathStdout } = await execAsync('git rev-parse --show-toplevel', {
      cwd: projectPath,
      encoding: 'utf8'
    })
    const rootPath = rootPathStdout.trim()

    let branch = 'HEAD'
    try {
      const { stdout: branchStdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: rootPath,
        encoding: 'utf8'
      })
      branch = branchStdout.trim()
    } catch {
      branch = 'unknown'
    }

    const { stdout: statusStdout } = await execAsync('git status --porcelain=v1 -uall', {
      cwd: rootPath,
      encoding: 'utf8'
    })

    const files: GitChangedFile[] = []
    const lines = statusStdout.split('\n').filter((line) => line.trim().length > 0)

    for (const line of lines) {
      const indexStatus = line.charAt(0)
      const workTreeStatus = line.charAt(1)
      let rawFilePath = line.substring(3).trim()

      if (rawFilePath.includes(' -> ')) {
        rawFilePath = rawFilePath.split(' -> ')[1].trim()
      }
      if (rawFilePath.startsWith('"') && rawFilePath.endsWith('"')) {
        rawFilePath = rawFilePath.slice(1, -1)
      }

      let status: GitFileStatusCode = 'modified'
      if (indexStatus === '?' || workTreeStatus === '?') {
        status = 'untracked'
      } else if (indexStatus === 'A' || workTreeStatus === 'A') {
        status = 'added'
      } else if (indexStatus === 'D' || workTreeStatus === 'D') {
        status = 'deleted'
      } else if (indexStatus === 'R' || workTreeStatus === 'R') {
        status = 'renamed'
      } else {
        status = 'modified'
      }

      const normalizedPath = rawFilePath.replace(/\\/g, '/')
      const filename = path.posix.basename(normalizedPath)
      const directory = path.posix.dirname(normalizedPath)

      files.push({
        path: normalizedPath,
        filename,
        directory: directory === '.' ? '' : directory,
        status,
        staged: indexStatus !== ' ' && indexStatus !== '?'
      })
    }

    return {
      isGitRepo: true,
      rootPath,
      branch,
      files
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      isGitRepo: false,
      rootPath: projectPath,
      branch: '',
      files: [],
      errorMessage: message.includes('not a git repository')
        ? '当前目录不是有效的 Git 仓库'
        : `Git 读取异常: ${message}`
    }
  }
}

// 辅助异步执行，统一设置超大 buffer 且静默异常
async function safeExec(cmd: string, cwd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 15 * 1024 * 1024
    })
    return stdout
  } catch {
    return ''
  }
}

// 2. 异步获取工作区指定文件的 Diff（并行执行，消灭串行 IO 瓶颈）
export async function getFileDiff(projectPath: string, relativeFilePath: string): Promise<GitFileDiff> {
  const filename = path.posix.basename(relativeFilePath)
  const language = detectLanguageByFilePath(relativeFilePath)
  const absolutePath = path.resolve(projectPath, relativeFilePath)

  const [original, modified, diffText] = await Promise.all([
    safeExec(`git show HEAD:"${relativeFilePath}"`, projectPath),
    fs.readFile(absolutePath, 'utf8').catch(() => ''),
    safeExec(`git diff HEAD -- "${relativeFilePath}"`, projectPath)
  ])

  return {
    filePath: relativeFilePath,
    filename,
    original,
    modified,
    diffText,
    language
  }
}

// 3. 异步获取本地及常用分支列表
export async function getRepoBranches(projectPath: string): Promise<BranchInfo[]> {
  try {
    const { stdout } = await execAsync('git branch --list --format="%(refname:short)|%(HEAD)"', {
      cwd: projectPath,
      encoding: 'utf8'
    })

    const branches: BranchInfo[] = []
    const lines = stdout.split('\n').filter((l) => l.trim().length > 0)

    for (const line of lines) {
      const [name, headFlag] = line.trim().split('|')
      if (name) {
        branches.push({
          name: name.trim(),
          isCurrent: headFlag?.trim() === '*'
        })
      }
    }

    return branches
  } catch {
    return []
  }
}

// 4. 异步获取最近提交历史（支持审查特定 Commit）
export async function getRecentCommits(projectPath: string, limit = 40): Promise<GitCommit[]> {
  try {
    const { stdout } = await execAsync(
      `git log -n ${limit} --pretty=format:"%H|%h|%an|%ad|%s" --date=short`,
      {
        cwd: projectPath,
        encoding: 'utf8'
      }
    )

    const commits: GitCommit[] = []
    const lines = stdout.split('\n').filter((l) => l.trim().length > 0)

    for (const line of lines) {
      const [hash, shortHash, author, date, ...messageParts] = line.split('|')
      if (hash && shortHash) {
        commits.push({
          hash: hash.trim(),
          shortHash: shortHash.trim(),
          author: author?.trim() || '',
          date: date?.trim() || '',
          message: messageParts.join('|').trim()
        })
      }
    }

    return commits
  } catch {
    return []
  }
}

// 5. 异步获取指定提交包含的变更文件列表
export async function getCommitFiles(projectPath: string, commitHash: string): Promise<GitChangedFile[]> {
  try {
    const { stdout } = await execAsync(`git diff-tree --no-commit-id --name-status -r "${commitHash}"`, {
      cwd: projectPath,
      encoding: 'utf8'
    })

    const lines = stdout.split('\n').filter((l) => l.trim().length > 0)
    return parseNameStatusLines(lines)
  } catch {
    return []
  }
}

// 6. 异步获取指定提交中某文件的前后版本 Diff（并行提取加速）
export async function getCommitFileDiff(
  projectPath: string,
  commitHash: string,
  relativeFilePath: string
): Promise<GitFileDiff> {
  const filename = path.posix.basename(relativeFilePath)
  const language = detectLanguageByFilePath(relativeFilePath)

  // 并行拉取：父提交版本、当前提交版本、以及提交自带 diff
  const [original, modified, diffText] = await Promise.all([
    safeExec(`git show "${commitHash}^":"${relativeFilePath}"`, projectPath),
    safeExec(`git show "${commitHash}":"${relativeFilePath}"`, projectPath),
    safeExec(`git diff "${commitHash}^" "${commitHash}" -- "${relativeFilePath}"`, projectPath)
  ])

  return {
    filePath: relativeFilePath,
    filename,
    original,
    modified,
    diffText,
    language
  }
}

// 7. 异步获取两个分支之间的变更文件列表
export async function getBranchDiffFiles(
  projectPath: string,
  baseBranch: string,
  targetBranch: string
): Promise<GitChangedFile[]> {
  try {
    const { stdout } = await execAsync(`git diff --name-status "${baseBranch}...${targetBranch}"`, {
      cwd: projectPath,
      encoding: 'utf8'
    })

    const lines = stdout.split('\n').filter((l) => l.trim().length > 0)
    return parseNameStatusLines(lines)
  } catch {
    return []
  }
}

// 8. 异步获取分支间指定文件的 Diff（并行提取加速）
export async function getBranchFileDiff(
  projectPath: string,
  baseBranch: string,
  targetBranch: string,
  relativeFilePath: string
): Promise<GitFileDiff> {
  const filename = path.posix.basename(relativeFilePath)
  const language = detectLanguageByFilePath(relativeFilePath)

  // 并行拉取：基准分支版本、目标分支版本、以及分支间 diff
  const [original, modified, diffText] = await Promise.all([
    safeExec(`git show "${baseBranch}":"${relativeFilePath}"`, projectPath),
    safeExec(`git show "${targetBranch}":"${relativeFilePath}"`, projectPath),
    safeExec(`git diff "${baseBranch}...${targetBranch}" -- "${relativeFilePath}"`, projectPath)
  ])

  return {
    filePath: relativeFilePath,
    filename,
    original,
    modified,
    diffText,
    language
  }
}

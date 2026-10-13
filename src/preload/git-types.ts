export type GitFileStatusCode = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked'

export type ReviewSourceMode = 'working' | 'commit' | 'branch'

export interface GitChangedFile {
  path: string
  filename: string
  directory: string
  status: GitFileStatusCode
  staged: boolean
}

export interface GitCommit {
  hash: string
  shortHash: string
  author: string
  date: string
  message: string
}

export interface BranchInfo {
  name: string
  isCurrent: boolean
}

export interface GitRepoStatus {
  isGitRepo: boolean
  rootPath: string
  branch: string
  files: GitChangedFile[]
  errorMessage?: string
}

export interface GitFileDiff {
  filePath: string
  filename: string
  original: string
  modified: string
  diffText: string
  language: string
}

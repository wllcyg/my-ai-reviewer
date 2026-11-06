/**
 * Markdown 文档 RAG 切块方案接口与配置契约定义
 */

export interface ChunkMetadata {
  // 1. 文档级元数据
  docId: number
  docCode: string
  title: string
  category: string
  fileName: string
  fileType: string
  scope: string // 可见范围: PUBLIC / DEPT / PRIVATE
  visibleDeptIds: number[] // 可见部门列表 (权限过滤用)

  // 2. 块级元数据
  headingPath: string[]
  chunkIndex: number
  sectionIndex: number // 同一章节内第几个子块 (从 0 开始)
  prevId: string | null
  nextId: string | null
  charCount: number
  oversized?: boolean // 超长代码块或表格保护标记

  // 3. 增量更新用
  contentHash: string // 整篇文档内容 SHA-256
  chunkHash: string // 当前 chunk 内容 SHA-256
}

export interface Chunk {
  id: string // 格式: `${docId}-${chunkIndex}`
  content: string // 原始正文 (展示给用户和 LLM)
  embeddingText: string // 标题路径前缀 + 正文 (供 Embedding 模型向量化)
  metadata: ChunkMetadata
}

export interface DocumentInputMeta {
  docId: number
  docCode: string
  title: string
  category?: string
  fileName?: string
  fileType?: string
  scope?: string
  visibleDeptIds?: number[]
}

export interface MarkdownSplitterConfig {
  /** 按几级标题切分，默认 3 (# ~ ###) */
  headingLevels?: number
  /** 小于此字数触发同一父标题下的合并，默认 100 */
  minChunkSize?: number
  /** 大于此字数触发 RecursiveCharacterTextSplitter 二次切分，默认 800 */
  maxChunkSize?: number
  /** 二次切分目标长度，默认 700 */
  chunkSize?: number
  /** 二次切分重叠长度，默认 100 (约 12%~14%) */
  chunkOverlap?: number
  /** 中文友好分隔符优先级列表 */
  separators?: string[]
  /** 是否在 embeddingText 前拼接标题路径，默认 true */
  includeTitleInEmbedding?: boolean
}

export const DEFAULT_SPLITTER_CONFIG: Required<MarkdownSplitterConfig> = {
  headingLevels: 3,
  minChunkSize: 100,
  maxChunkSize: 800,
  chunkSize: 700,
  chunkOverlap: 100,
  separators: ['\n\n', '\n', '。', '！', '？', '；', '，', ' ', ''],
  includeTitleInEmbedding: true,
}


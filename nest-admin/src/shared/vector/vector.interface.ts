import type { Chunk } from '~/modules/document/splitter/markdown-splitter.interface'

/**
 * 向量切块通用元数据负载契约
 */
export interface VectorPayload {
  docCode: string
  docId: number
  title: string
  chunkIndex: number
  headingPath: string[]
  content: string
  scope: string // PUBLIC / DEPT / PRIVATE
  visibleDeptIds: number[]
  acl_tags: string[] // 权限隔离过滤核心标签: ['public', 'dept:101', 'user:1']
  charCount?: number
  [key: string]: any
}

/**
 * 向量数据库存储点标准数据结构
 */
export interface VectorPoint {
  id: string // 确定性唯一 ID，格式: `${docCode}_${chunkIndex}`
  vector: number[] // 稠密向量浮点数组
  payload: VectorPayload
}

/**
 * 向量检索过滤参数
 */
export interface VectorSearchOptions {
  topK?: number
  filter?: {
    acl_tags?: string[]
    docCode?: string
    [key: string]: any
  }
}

/**
 * 向量检索结果
 */
export interface VectorSearchResult {
  id: string
  score: number
  payload: VectorPayload
}

/**
 * 向量模型提供方抽象接口 (Strategy Pattern)
 */
export interface IEmbeddingProvider {
  /** 提供方标识 (如 'cloudflare-workers-ai' / 'openai' / 'mock') */
  readonly providerName: string
  /** 向量维度 (如 1024 / 512 / 1536) */
  readonly dimension: number

  /**
   * 批量将文本转为向量
   * @param texts 待向量化文本列表 (已包含上下文标题前缀的 embeddingText)
   */
  generateEmbeddings(texts: string[]): Promise<number[][]>
}

/**
 * 向量存储底层抽象接口 (Repository / Adapter Pattern)
 */
export interface IVectorStore {
  /** 存储实现标识 (如 'cloudflare-vectorize' / 'qdrant' / 'memory') */
  readonly storeName: string

  /** 批量幂等 Upsert 写入切片向量与 Payload */
  upsert(points: VectorPoint[]): Promise<void>

  /** 按文档编码彻底清理旧版本向量 */
  deleteByDocCode(docCode: string): Promise<void>

  /** 相似度向量检索 (支持 acl_tags 权限过滤) */
  search(queryVector: number[], options?: VectorSearchOptions): Promise<VectorSearchResult[]>
}

/**
 * 高层门面切块索引入参契约
 */
export interface IndexDocChunksParams {
  docCode: string
  docId: number
  title: string
  scope: string
  visibleDeptIds?: number[]
  createBy?: number
  chunks: Chunk[]
}


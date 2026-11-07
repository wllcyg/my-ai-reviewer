import type { Chunk } from '~/modules/document/splitter/markdown-splitter.interface'

/**
 * 写入 OpenSearch 的单篇切块文档定义
 */
export interface OpenSearchChunkDocument {
  /** 全局切块唯一标识: `${docCode}_${chunkIndex}` */
  id: string
  /** 文档全局唯一业务编码 */
  docCode: string
  /** 数据库文档自增 ID */
  docId: number
  /** 切块序号 (从 0 开始) */
  chunkIndex: number
  /** 文档标题 */
  title: string
  /** 标题感知上下文面包屑路径，如 '第一章 总则 > 1.1 适用范围' */
  headingPath?: string
  /** 切片正文纯文本内容 */
  content: string
  /** Token 预估长度 */
  tokens?: number
  /** 权限范围: PUBLIC / DEPT / PRIVATE */
  scope: string
  /** 授权可见部门 ID 数组 */
  visibleDeptIds?: number[]
  /** 扁平化安全访问标签数组 (如 ['public', 'dept:12', 'user:5']) */
  acl_tags: string[]
  /** 写入时间戳 (ISO 8601) */
  createdAt: string
}

/**
 * OpenSearch 检索入参选项
 */
export interface OpenSearchSearchOptions {
  /** 关键词检索短语 */
  query: string
  /** 召回 Top-K 数量 (默认 10) */
  limit?: number
  /** 当前检索用户的身份 ACL 标签 */
  aclTags?: string[]
  /** 可选限定特定文档 docCode */
  docCode?: string
}

/**
 * OpenSearch 单条命中项
 */
export interface OpenSearchSearchResult {
  /** 切块唯一标识: `${docCode}_${chunkIndex}` */
  id: string
  /** BM25 相关性得分 */
  score: number
  /** 文档业务编码 */
  docCode: string
  /** 数据库文档自增 ID */
  docId: number
  /** 切块序号 */
  chunkIndex: number
  /** 文档标题 */
  title: string
  /** 标题感知路径 */
  headingPath?: string
  /** 切块正文文本 */
  content: string
  /** 权限范围 */
  scope: string
  /** ACL 标签 */
  acl_tags: string[]
  /** 高亮命中片段 (HTML 标签标记，如 <em>关键字</em>) */
  highlights?: {
    title?: string[]
    headingPath?: string[]
    content?: string[]
  }
}

/**
 * 全文检索引擎底层适配器规范
 */
export interface IOpenSearchStore {
  readonly storeName: string

  /**
   * 确保索引与 Mapping 存在
   */
  ensureIndex(): Promise<void>

  /**
   * 批量将切片文档写入/覆盖至倒排索引
   */
  bulkIndex(docs: OpenSearchChunkDocument[]): Promise<void>

  /**
   * 执行 BM25 关键词检索 (带 multi_match 权重与 ACL tags 过滤)
   */
  search(options: OpenSearchSearchOptions): Promise<OpenSearchSearchResult[]>

  /**
   * 根据 docCode 删除文档的所有切块
   */
  deleteByDocCode(docCode: string): Promise<number>

  /**
   * 健康探活
   */
  ping(): Promise<boolean>
}

/**
 * 门面服务批量入库参数契约
 */
export interface IndexEsDocChunksParams {
  docCode: string
  docId: number
  title: string
  scope: string
  visibleDeptIds?: number[]
  createBy?: number
  chunks: Chunk[]
}


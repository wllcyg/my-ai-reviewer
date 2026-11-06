/**
 * 待向量化的单个文本切块数据结构
 */
export interface DocChunkItem {
  /** 切块索引序号 (从 0 开始) */
  chunkIndex: number
  /** 切片文本内容 (用于输入 Embedding 模型) */
  content: string
  /** 标题感知上下文面包屑路径，如 '第一章 总则 > 1.1 适用范围' */
  headingPath?: string
  /** 页码 (若从 PDF/Word 解析得到) */
  page?: number
  /** 权限范围: PUBLIC / DEPT / PRIVATE */
  scope: string
  /** 授权可见部门 ID 列表 */
  visibleDeptIds?: number[]
}

/**
 * 向量化专用通道 (doc.index.vector) 消息契约
 */
export interface DocVectorMessage {
  /** 协议版本号 */
  schemaVersion: 1
  /** 任务跟踪 UUID */
  taskId: string
  /** 链路追踪标识 */
  traceId: string
  /** 文档业务编码 */
  docCode: string
  /** 数据库文档自增 ID */
  docId: number
  /** 文档标题 */
  title: string
  /** 原始文件格式 */
  fileType: string
  /** 切块数据列表 (直接承载待向量化文本) */
  chunks: DocChunkItem[]
  /** 尝试消费/投递次数 (从 1 开始) */
  attempt: number
  /** 创建时间 ISO 字符串 */
  createdAt: string
  /** 创建毫秒时间戳 */
  timestamp: number
}

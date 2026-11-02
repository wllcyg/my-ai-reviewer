/**
 * 文档处理异步任务消息契约 v2
 * 遵循跨语言统一 JSON Schema，供 Nest (Producer) 与 Python AI Worker (Consumer) 通信
 * 兼容原有字段，新增链路追踪与重试控制
 */
export interface DocProcessMessage {
  // === 协议控制字段 ===
  /** 协议架构版本号 */
  schemaVersion: number

  // === 任务标识字段 ===
  /** 任务跟踪 UUID */
  taskId: string
  /** 任务类型: doc.parse | doc.reindex */
  type: string
  /** 链路追踪标识，串联 Nest 与 Python 日志 */
  traceId: string
  /** 第几次投递（重试计数，从1开始）*/
  attempt: number

  // === 文档标识字段 ===
  /** 文档全局唯一业务编码，如 doc_xxx */
  docCode: string
  /** 数据库文档自增 ID */
  docId: number
  /** 文件唯一标识（对应 storageKey）*/
  fileId: string

  // === 文档元数据 ===
  /** 文档标题 */
  title: string
  /** 文件格式后缀，如 pdf, docx, md, txt */
  fileType: string
  /** Cloudflare R2 对象存储路径 Key */
  storageKey: string

  // === 权限字段 ===
  /** 可见权限范围: PUBLIC / DEPT / PRIVATE */
  visibleRange: string
  /** 可见部门 ID 数组 */
  deptIds?: number[]
  /** 创建者 / 上传人用户 ID */
  creatorId?: number

  // === 时间戳 ===
  /** 消息创建时间（ISO 8601 格式）*/
  createdAt: string
  /** 消息创建时间戳 (毫秒)【兼容旧版】 */
  timestamp: number
}

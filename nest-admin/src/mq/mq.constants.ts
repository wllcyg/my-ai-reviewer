/**
 * 文档处理管道 Topic 交换机
 * 统一承载阶段一（解析切块）与阶段二（三路索引分流）
 */
export const DOC_TOPIC_EXCHANGE = 'doc.process.exchange'

/** 兼容旧常量 */
export const DOC_PROCESS_EXCHANGE = DOC_TOPIC_EXCHANGE

/**
 * 路由键 (Routing Keys) 规范
 * 命名规则：doc.<阶段/模块>.<目标>
 */
export const DOC_ROUTING_KEYS = {
  /** 阶段一：前置解析与分块任务 / 失败重新拉取解析 */
  PARSE: 'doc.process.parse',
  /** 旧版兼容路由键 */
  START: 'doc.process.start',

  /** 阶段二：三路独立索引衍生 */
  INDEX_VECTOR: 'doc.index.vector', // 向量数据库 (Cloudflare Vectorize)
  INDEX_ES: 'doc.index.es', // Elasticsearch 全文倒排
  INDEX_GRAPH: 'doc.index.graph', // 知识图谱 (Neo4j)
} as const

export const DOC_PROCESS_ROUTING_KEY = DOC_ROUTING_KEYS.START

/**
 * 队列名称规范 (Queues)
 * 统一带 kh. (Knowledge Hub) 前缀，避免同实例多应用冲突
 */
export const DOC_QUEUES = {
  /** 旧处理队列 (兼容) */
  LEGACY_PROCESS: 'kh.doc.process.queue',
  /** 解析与切块队列 */
  PARSE: 'kh.doc.parse.queue',
  /** 向量化写入专用队列 */
  INDEX_VECTOR: 'kh.doc.index.vector.queue',
  /** ES 全文倒排专用队列 */
  INDEX_ES: 'kh.doc.index.es.queue',
  /** 知识图谱专用队列 */
  INDEX_GRAPH: 'kh.doc.index.graph.queue',
} as const

export const DOC_PROCESS_QUEUE = DOC_QUEUES.LEGACY_PROCESS

/**
 * 死信交换机与队列 (用于处理不可恢复的毒丸消息与超限重试)
 */
export const DOC_PROCESS_DEAD_EXCHANGE = 'doc.process.dead.exchange'
export const DOC_PROCESS_DEAD_QUEUE = 'kh.doc.process.dead.queue'
export const DOC_PROCESS_DEAD_ROUTING_KEY = 'doc.process.dead'

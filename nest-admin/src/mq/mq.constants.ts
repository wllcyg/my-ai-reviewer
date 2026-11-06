/**
 * 统一文档处理 Topic 交换机
 */
export const DOC_EXCHANGE = 'doc.process.exchange'

/**
 * 路由键 (Routing Keys) 规范
 * 命名规则：doc.index.<目标管道>
 */
export const DOC_ROUTING_KEYS = {
  VECTOR: 'doc.index.vector', // 向量数据库 (Cloudflare Vectorize)
  ES: 'doc.index.es', // Elasticsearch 全文倒排
  GRAPH: 'doc.index.graph', // 知识图谱 (Neo4j)
} as const

/**
 * 业务队列名称规范 (Queues)
 * 统一带 kh. (Knowledge Hub) 前缀隔离
 */
export const DOC_QUEUES = {
  VECTOR: 'kh.doc.index.vector.queue',
  ES: 'kh.doc.index.es.queue',
  GRAPH: 'kh.doc.index.graph.queue',
} as const

/**
 * 统一死信交换机与死信队列 (处理未捕获异常与毒丸消息)
 */
export const DOC_DEAD_EXCHANGE = 'doc.process.dead.exchange'
export const DOC_DEAD_QUEUE = 'kh.doc.process.dead.queue'
export const DOC_DEAD_ROUTING_KEY = 'doc.process.dead'

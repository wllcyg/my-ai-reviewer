/** 文档处理管道交换机 (Topic) */
export const DOC_PROCESS_EXCHANGE = 'doc.process.exchange'

/** AI Worker 消费的队列（带 kh. 前缀避免多服务同机命名冲突） */
export const DOC_PROCESS_QUEUE = 'kh.doc.process.queue'

/** 路由键：文档待处理/已发布触发 */
export const DOC_PROCESS_ROUTING_KEY = 'doc.process.start'

/** 死信交换机与队列 (用于处理连续失败或毒丸消息) */
export const DOC_PROCESS_DEAD_EXCHANGE = 'doc.process.dead.exchange'
export const DOC_PROCESS_DEAD_QUEUE = 'kh.doc.process.dead.queue'
export const DOC_PROCESS_DEAD_ROUTING_KEY = 'doc.process.dead'

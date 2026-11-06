import type { DocProcessMessage } from './messages/doc-process.message'
import type { DocChunkItem, DocVectorMessage } from './messages/doc-vector.message'
import { Injectable, Logger } from '@nestjs/common'
import { nanoid } from 'nanoid'
import {
  DOC_PROCESS_EXCHANGE,
  DOC_PROCESS_ROUTING_KEY,
  DOC_ROUTING_KEYS,
  DOC_TOPIC_EXCHANGE,
} from './mq.constants'
import { RabbitMqService } from './rabbitmq.service'

/**
 * 发送任务参数（协议字段自动生成）
 */
export type SendDocProcessTaskParams = Omit<
  DocProcessMessage,
  'schemaVersion' | 'traceId' | 'attempt' | 'createdAt' | 'timestamp' | 'type' | 'fileId'
> & {
  type?: string
  fileId?: string
  traceId?: string
  attempt?: number
}

/**
 * 发送向量任务参数
 */
export interface SendDocVectorTaskParams {
  docCode: string
  docId: number
  title: string
  fileType: string
  chunks: DocChunkItem[]
  taskId?: string
  traceId?: string
  attempt?: number
}

@Injectable()
export class DocumentPipelinePublisher {
  private readonly logger = new Logger(DocumentPipelinePublisher.name)

  constructor(private readonly rabbitMqService: RabbitMqService) {}

  /**
   * 投递文档异步处理任务至 RabbitMQ (阶段一/全量处理)
   * @param params 任务参数
   */
  async sendDocProcessTask(params: SendDocProcessTaskParams): Promise<boolean> {
    const message: DocProcessMessage = {
      schemaVersion: 1,
      type: params.type || 'doc.parse',
      fileId: params.fileId || params.storageKey,
      traceId: params.traceId || `tr_${nanoid(12)}`,
      attempt: params.attempt || 1,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
      ...params,
    }

    const success = await this.rabbitMqService.publish(
      DOC_PROCESS_EXCHANGE,
      DOC_PROCESS_ROUTING_KEY,
      message,
    )

    if (success) {
      this.logger.log(
        `[MQ 投递成功] taskId=${message.taskId}, docCode=${message.docCode}, traceId=${message.traceId}, attempt=${message.attempt}`,
      )
    }
    else {
      this.logger.error(
        `[MQ 投递失败] taskId=${message.taskId}, docCode=${message.docCode}, traceId=${message.traceId}`,
      )
    }

    return success
  }

  /**
   * 投递向量化专用任务 (阶段二: doc.index.vector)
   * @param params 向量切块数据载荷
   */
  async sendVectorIndexTask(params: SendDocVectorTaskParams): Promise<boolean> {
    const taskId = params.taskId || `task_vec_${nanoid(10)}`
    const traceId = params.traceId || `tr_${nanoid(12)}`

    const message: DocVectorMessage = {
      schemaVersion: 1,
      taskId,
      traceId,
      docCode: params.docCode,
      docId: params.docId,
      title: params.title,
      fileType: params.fileType,
      chunks: params.chunks,
      attempt: params.attempt || 1,
      createdAt: new Date().toISOString(),
      timestamp: Date.now(),
    }

    const routingKey = DOC_ROUTING_KEYS.INDEX_VECTOR
    const success = await this.rabbitMqService.publish(
      DOC_TOPIC_EXCHANGE,
      routingKey,
      message,
    )

    if (success) {
      this.logger.log(
        `[MQ 向量通道投递成功] docCode=${message.docCode}, chunks=${message.chunks.length}, taskId=${taskId}`,
      )
    }
    else {
      this.logger.error(
        `[MQ 向量通道投递失败] docCode=${message.docCode}, taskId=${taskId}`,
      )
    }

    return success
  }
}

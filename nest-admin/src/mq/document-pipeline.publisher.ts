import { Injectable, Logger } from '@nestjs/common'
import { nanoid } from 'nanoid'
import type { DocProcessMessage } from './messages/doc-process.message'
import { DOC_PROCESS_EXCHANGE, DOC_PROCESS_ROUTING_KEY } from './mq.constants'
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

@Injectable()
export class DocumentPipelinePublisher {
  private readonly logger = new Logger(DocumentPipelinePublisher.name)

  constructor(private readonly rabbitMqService: RabbitMqService) {}

  /**
   * 投递文档异步处理任务至 RabbitMQ
   * @param params 任务参数（协议字段自动生成：traceId、attempt、createdAt 等）
   */
  async sendDocProcessTask(params: SendDocProcessTaskParams): Promise<boolean> {
    // 自动填充协议字段
    const message: DocProcessMessage = {
      schemaVersion: 1,
      type: params.type || 'doc.parse',
      fileId: params.fileId || params.storageKey, // fileId 默认用 storageKey
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
}

import type { ConsumeMessage } from 'amqplib'
import type { DocVectorMessage } from '../messages/doc-vector.message'
import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DocIndexTypeEnum } from '~/modules/document/document.constant'
import { DocumentIndexTaskService } from '~/modules/document/services/document-index-task.service'
import { DOC_QUEUES } from '../mq.constants'
import { RabbitMqService } from '../rabbitmq.service'

@Injectable()
export class VectorConsumer implements OnModuleInit {
  private readonly logger = new Logger(VectorConsumer.name)

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    @Inject(forwardRef(() => DocumentIndexTaskService))
    private readonly indexTaskService: DocumentIndexTaskService,
  ) {}

  async onModuleInit() {
    // 监听向量化专用队列，QoS 设为 2 (兼顾性能与批处理内存安全)
    await this.rabbitMqService.consume<DocVectorMessage>(
      DOC_QUEUES.INDEX_VECTOR,
      async (data: DocVectorMessage, rawMsg: ConsumeMessage) => {
        await this.handleMessage(data, rawMsg)
      },
      { prefetch: 2 },
    )
  }

  /**
   * 核心消费处理入口
   */
  private async handleMessage(data: DocVectorMessage, _rawMsg: ConsumeMessage) {
    const startTime = Date.now()
    const docCode = data.docCode
    const chunkCount = data.chunks?.length || 0

    this.logger.log(
      `[VectorConsumer] 📥 收到待向量化任务: docCode=${docCode}, chunks=${chunkCount}, taskId=${data.taskId}`,
    )

    // 1. 状态流转 -> processing
    await this.indexTaskService.markProcessing(docCode, DocIndexTypeEnum.VECTOR)

    try {
      // 2. 核心处理逻辑 (下一步接入 CloudflareVectorService)
      this.logger.log(
        `[VectorConsumer] ⚡ 正在处理 ${docCode} 的 ${chunkCount} 个切块向量化落库...`,
      )

      // 3. 状态流转 -> completed
      const costMs = Date.now() - startTime
      await this.indexTaskService.markCompleted(docCode, DocIndexTypeEnum.VECTOR, costMs)

      this.logger.log(
        `[VectorConsumer] ✅ 向量化通道处理完毕: docCode=${docCode}, 耗时=${costMs}ms`,
      )
    }
    catch (err: any) {
      // 4. 状态流转 -> failed
      await this.indexTaskService.markFailed(
        docCode,
        DocIndexTypeEnum.VECTOR,
        err.message || String(err),
      )
      throw err // 重新抛出触发 RabbitMQ NACK 死信机制
    }
  }
}

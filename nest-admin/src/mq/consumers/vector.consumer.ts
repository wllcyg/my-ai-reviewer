import type { ConsumeMessage } from 'amqplib'
import type { DocVectorMessage } from '../messages/doc-vector.message'
import type { Chunk } from '~/modules/document/splitter/markdown-splitter.interface'
import type { Chunk } from '~/modules/document/splitter/markdown-splitter.interface'
import type { DocVectorMessage } from '../messages/doc-vector.message'
import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DocIndexTypeEnum } from '~/modules/document/document.constant'
import { DocumentIndexTaskService } from '~/modules/document/services/document-index-task.service'
import { splitMarkdownDocument } from '~/modules/document/splitter/markdown-splitter.pure'
import { DocContentService } from '~/shared/mongo/services/doc-content.service'
import { DOC_QUEUES } from '../mq.constants'
import { RabbitMqService } from '../rabbitmq.service'

@Injectable()
export class VectorConsumer implements OnModuleInit {
  private readonly logger = new Logger(VectorConsumer.name)

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    @Inject(forwardRef(() => DocumentIndexTaskService))
    private readonly indexTaskService: DocumentIndexTaskService,
    private readonly docContentService: DocContentService,
  ) {}

  async onModuleInit() {
    // 监听向量化专用队列，QoS 设为 2 (兼顾性能与批处理内存安全)
    await this.rabbitMqService.consume<DocVectorMessage>(
      DOC_QUEUES.VECTOR,
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
    const rawCount = data.chunks?.length || 0

    this.logger.log(
      `[VectorConsumer] 📥 收到待向量化任务: docCode=${docCode}, 原始块数=${rawCount}, taskId=${data.taskId}`,
    )

    // 1. 状态流转 -> processing
    await this.indexTaskService.markProcessing(docCode, DocIndexTypeEnum.VECTOR)

    try {
      // 2. 从 MongoDB 获取文档的 Markdown 全文
      let markdownText = ''
      try {
        markdownText = await this.docContentService.getContentByCode(docCode)
      }
      catch {
        this.logger.warn(`[VectorConsumer] 未在 MongoDB 找到文档 [${docCode}] 的全文，使用消息初始文本兜底`)
      }

      // 如果 MongoDB 中无正文，使用消息中的 content 兜底
      if (!markdownText && data.chunks?.length) {
        markdownText = data.chunks.map(c => c.content).join('\n\n')
      }

      // 3. 执行纯函数语义切块 (按标题切分、特殊块保护、短合并、超长二次切分、双向链表)
      let chunks: Chunk[] = []
      if (markdownText) {
        chunks = await splitMarkdownDocument(markdownText, {
          docId: data.docId,
          docCode: data.docCode,
          title: data.title,
          fileType: data.fileType,
          scope: data.chunks?.[0]?.scope || 'PUBLIC',
          visibleDeptIds: data.chunks?.[0]?.visibleDeptIds || [],
        })
      }

      this.logger.log(
        `[VectorConsumer] ✂️ 语义切块完毕: docCode=${docCode}, 正文字数=${markdownText.length}, 产出切块数=${chunks.length}`,
      )

      // 4. 状态流转 -> completed (持久化真实切块数与耗时)
      const costMs = Date.now() - startTime
      await this.indexTaskService.markCompleted(
        docCode,
        DocIndexTypeEnum.VECTOR,
        costMs,
        chunks.length,
      )

      this.logger.log(
        `[VectorConsumer] ✅ 向量化通道处理完毕: docCode=${docCode}, 切块数=${chunks.length}, 耗时=${costMs}ms`,
      )
    }
    catch (err: any) {
      // 5. 状态流转 -> failed
      await this.indexTaskService.markFailed(
        docCode,
        DocIndexTypeEnum.VECTOR,
        err.message || String(err),
      )
      throw err // 重新抛出触发 RabbitMQ NACK 死信机制
    }
  }
}

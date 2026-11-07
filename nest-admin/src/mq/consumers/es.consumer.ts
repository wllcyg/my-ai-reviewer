import type { ConsumeMessage } from 'amqplib'
import { forwardRef, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DocIndexTypeEnum } from '~/modules/document/document.constant'
import { DocumentIndexTaskService } from '~/modules/document/services/document-index-task.service'
import type { Chunk } from '~/modules/document/splitter/markdown-splitter.interface'
import { splitMarkdownDocument } from '~/modules/document/splitter/markdown-splitter.pure'
import { DocContentService } from '~/shared/mongo/services/doc-content.service'
import { OpenSearchService } from '~/shared/opensearch/opensearch.service'
import type { DocVectorMessage } from '../messages/doc-vector.message'
import { DOC_QUEUES } from '../mq.constants'
import { RabbitMqService } from '../rabbitmq.service'

@Injectable()
export class EsConsumer implements OnModuleInit {
  private readonly logger = new Logger(EsConsumer.name)

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    @Inject(forwardRef(() => DocumentIndexTaskService))
    private readonly indexTaskService: DocumentIndexTaskService,
    private readonly docContentService: DocContentService,
    private readonly openSearchService: OpenSearchService,
  ) {}

  async onModuleInit() {
    // 监听全文检索专用队列 (kh.doc.index.es.queue)，QoS 设为 2
    await this.rabbitMqService.consume<DocVectorMessage>(
      DOC_QUEUES.ES,
      async (data: DocVectorMessage, rawMsg: ConsumeMessage) => {
        await this.handleMessage(data, rawMsg)
      },
      { prefetch: 2 },
    )
    this.logger.log(`[EsConsumer] 监听队列 [${DOC_QUEUES.ES}] 启动成功`)
  }

  /**
   * 核心消费处理入口
   */
  private async handleMessage(data: DocVectorMessage, _rawMsg: ConsumeMessage) {
    const startTime = Date.now()
    const docCode = data.docCode
    const rawCount = data.chunks?.length || 0

    this.logger.log(
      `[EsConsumer] 📥 收到待全文检索任务: docCode=${docCode}, 原始块数=${rawCount}, taskId=${data.taskId}`,
    )

    // 1. 状态流转 -> processing
    await this.indexTaskService.markProcessing(docCode, DocIndexTypeEnum.ES)

    try {
      // 2. 从 MongoDB 获取文档的 Markdown 全文
      let markdownText = ''
      try {
        markdownText = await this.docContentService.getContentByCode(docCode)
      }
      catch {
        this.logger.warn(`[EsConsumer] 未在 MongoDB 找到文档 [${docCode}] 的全文，使用消息初始文本兜底`)
      }

      // 如果 MongoDB 中无正文，使用消息中的 content 兜底
      if (!markdownText && data.chunks?.length) {
        markdownText = data.chunks.map(c => c.content).join('\n\n')
      }

      const scope = data.chunks?.[0]?.scope || 'PUBLIC'
      const visibleDeptIds = data.chunks?.[0]?.visibleDeptIds || []

      // 3. 执行纯函数语义切块 (保持与向量完全对齐的切分粒度与 chunkIndex)
      let chunks: Chunk[] = []
      if (markdownText) {
        chunks = await splitMarkdownDocument(markdownText, {
          docId: data.docId,
          docCode: data.docCode,
          title: data.title,
          fileType: data.fileType,
          scope,
          visibleDeptIds,
        })
      }

      this.logger.log(
        `[EsConsumer] ✂️ 语义切块完毕: docCode=${docCode}, 正文字数=${markdownText.length}, 产出切块数=${chunks.length}`,
      )

      // 4. 调用解耦的 OpenSearch 全文检索领域门面服务 (批量写入倒排索引)
      const { chunkCount, costMs: esCostMs } = await this.openSearchService.indexDocumentChunks({
        docCode: data.docCode,
        docId: data.docId,
        title: data.title,
        scope,
        visibleDeptIds,
        chunks,
      })

      // 5. 状态流转 -> completed (持久化真实切块数与端到端耗时)
      const totalCostMs = Date.now() - startTime
      await this.indexTaskService.markCompleted(
        docCode,
        DocIndexTypeEnum.ES,
        chunkCount,
        totalCostMs,
      )

      this.logger.log(
        `[EsConsumer] 🎉 文档 [${docCode}] 全文检索入库成功: 切块数=${chunkCount}, 索引耗时=${esCostMs}ms, 总耗时=${totalCostMs}ms`,
      )
    }
    catch (err: any) {
      const totalCostMs = Date.now() - startTime
      this.logger.error(
        `[EsConsumer] ❌ 文档 [${docCode}] 全文检索处理失败: ${err.message}`,
        err.stack,
      )

      // 状态流转 -> failed
      await this.indexTaskService.markFailed(
        docCode,
        DocIndexTypeEnum.ES,
        err.message || 'ES indexing failed',
      )
    }
  }
}

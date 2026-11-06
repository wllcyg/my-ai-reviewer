import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger'
import { nanoid } from 'nanoid'
import { Public } from '~/modules/auth/decorators/public.decorator'
import { DocumentIndexTaskService } from '~/modules/document/services/document-index-task.service'
import { VectorService } from '~/shared/vector/vector.service'
import { DocumentPipelinePublisher } from './document-pipeline.publisher'
import { DOC_QUEUES } from './mq.constants'
import { RabbitMqService } from './rabbitmq.service'

class PublishTestDto {
  @ApiProperty({ required: false, description: '文档编码' })
  docCode?: string

  @ApiProperty({ required: false, description: '文档标题' })
  title?: string

  @ApiProperty({ required: false, description: '文件类型', example: 'pdf' })
  fileType?: string

  @ApiProperty({ required: false, description: '存储路径', example: 'test/sample.pdf' })
  storageKey?: string

  @ApiProperty({ required: false, description: '可见范围', example: 'PUBLIC' })
  visibleRange?: string
}

@ApiTags('消息队列(测试)')
@Public()
@Controller('test/mq')
export class MqController {
  constructor(
    private readonly publisher: DocumentPipelinePublisher,
    private readonly rabbitMqService: RabbitMqService,
    private readonly indexTaskService: DocumentIndexTaskService,
    private readonly vectorService: VectorService,
  ) {}

  @Get('search-vector')
  @ApiOperation({ summary: '测试向量检索 (直接调用 Cloudflare 真实检索并返回召回数据)' })
  async searchVectorTest(
    @Query('q') queryText: string,
    @Query('docCode') docCode?: string,
  ) {
    const q = queryText || '测试'
    const results = await this.vectorService.search(
      q,
      { uid: 1, roles: ['admin'] } as any,
      { topK: 5, docCode },
    )

    return {
      query: q,
      docCodeFilter: docCode || 'all',
      count: results.length,
      provider: this.vectorService.providerName,
      store: this.vectorService.storeName,
      matches: results.map(r => ({
        id: r.id,
        score: r.score,
        docCode: r.payload.docCode,
        title: r.payload.title,
        chunkIndex: r.payload.chunkIndex,
        content: r.payload.content,
        headingPath: r.payload.headingPath,
      })),
      timestamp: new Date().toISOString(),
    }
  }

  @Post('publish')
  @ApiOperation({ summary: '发布测试文档处理任务' })
  async publishTest(@Body() body: PublishTestDto) {
    const taskId = `task_${nanoid(16)}`
    const docCode = body.docCode || `doc_${nanoid(8)}`
    const fileId = `file_${nanoid(12)}`
    const timestamp = Date.now()

    const success = await this.publisher.sendDocProcessTask({
      taskId,
      docCode,
      docId: Math.floor(Math.random() * 10000),
      fileId,
      title: body.title || `测试文档_${timestamp}`,
      fileType: body.fileType || 'pdf',
      storageKey: body.storageKey || `test/${fileId}.pdf`,
      visibleRange: body.visibleRange || 'PUBLIC',
    })

    return {
      success,
      taskId,
      docCode,
      fileId,
      queue: DOC_QUEUES.VECTOR,
      message: success ? '✅ 任务已发布到 CloudAMQP' : '❌ 发布失败',
      timestamp: new Date().toISOString(),
    }
  }

  @Post('publish-vector')
  @ApiOperation({ summary: '向向量化专用通道发布测试任务 (doc.index.vector)' })
  async publishVectorTest(@Body() body: { docCode?: string, title?: string, chunkCount?: number }) {
    const docCode = body.docCode || `doc_vec_${nanoid(6)}`
    const count = body.chunkCount || 3
    const chunks = Array.from({ length: count }, (_, i) => ({
      chunkIndex: i,
      content: `这是第 ${i + 1} 块测试文本内容，用于测试 RabbitMQ 向量化专用通道的流通性。`,
      headingPath: `第一章 测试 > 第 ${i + 1} 节 详情`,
      scope: 'PUBLIC',
    }))

    // 1. 先初始化三路索引任务记录 (Vector, ES, Graph)
    await this.indexTaskService.initTasks(docCode, chunks.length)

    // 2. 投递向量专用通道
    const success = await this.publisher.sendVectorIndexTask({
      docCode,
      docId: 9999,
      title: body.title || '向量通道测试文档',
      fileType: 'md',
      chunks,
    })

    return {
      success,
      docCode,
      chunkCount: chunks.length,
      routingKey: 'doc.index.vector',
      message: success ? '✅ 任务已初始化入库，并已发布至 doc.index.vector 通道' : '❌ 发布失败',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('latest-tasks')
  @ApiOperation({ summary: '查看最新的任务执行流水记录' })
  async getLatestTasks(@Query('limit') limit?: number) {
    const tasks = await this.indexTaskService.getLatestTasks(Number(limit) || 20)
    return {
      count: tasks.length,
      tasks,
      timestamp: new Date().toISOString(),
    }
  }

  @Get('index-tasks/:docCode')
  @ApiOperation({ summary: '查询某文档在 doc_index_tasks 表中的三路处理状态' })
  async getIndexTasks(@Param('docCode') docCode: string) {
    const tasks = await this.indexTaskService.getTasksByDocCode(docCode)
    return {
      docCode,
      tasks,
      timestamp: new Date().toISOString(),
    }
  }

  @Get('stats')
  @ApiOperation({ summary: '查看队列连接状态' })
  async getStats() {
    const isConnected = this.rabbitMqService.isConnected()

    return {
      connected: isConnected,
      queue: DOC_QUEUES.VECTOR,
      status: isConnected ? 'healthy' : 'disconnected',
      message: isConnected
        ? '✅ RabbitMQ 连接正常（详细队列统计请访问 CloudAMQP 管理界面）'
        : '❌ RabbitMQ 未连接',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'MQ 健康检查' })
  async health() {
    const isConnected = this.rabbitMqService.isConnected()

    return {
      status: isConnected ? 'healthy' : 'unhealthy',
      service: 'CloudAMQP',
      connected: isConnected,
      timestamp: new Date().toISOString(),
    }
  }

  @Post('publish-batch')
  @ApiOperation({ summary: '批量发布测试任务' })
  async publishBatch(@Body() body: { count?: number }) {
    const count = Math.min(body.count || 5, 20) // 最多20条
    const results = []

    for (let i = 0; i < count; i++) {
      const taskId = `task_batch_${nanoid(12)}`
      const docCode = `doc_${nanoid(8)}`
      const fileId = `file_${nanoid(12)}`

      const success = await this.publisher.sendDocProcessTask({
        taskId,
        docCode,
        docId: 1000 + i,
        fileId,
        title: `批量测试文档 ${i + 1}/${count}`,
        fileType: 'pdf',
        storageKey: `test/batch/${fileId}.pdf`,
        visibleRange: 'PUBLIC',
      })

      results.push({
        index: i + 1,
        taskId,
        docCode,
        success,
      })

      // 避免发送过快，间隔50ms
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    const successCount = results.filter(r => r.success).length

    return {
      total: count,
      success: successCount,
      failed: count - successCount,
      results,
      message: `✅ 已发送 ${successCount}/${count} 条消息到 CloudAMQP`,
      timestamp: new Date().toISOString(),
    }
  }
}

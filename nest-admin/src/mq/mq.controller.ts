import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger'
import { nanoid } from 'nanoid'
import { Public } from '~/modules/auth/decorators/public.decorator'
import { DocumentPipelinePublisher } from './document-pipeline.publisher'
import { DOC_PROCESS_QUEUE } from './mq.constants'
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
  ) {}

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
      queue: DOC_PROCESS_QUEUE,
      message: success ? '✅ 任务已发布到 CloudAMQP' : '❌ 发布失败',
      timestamp: new Date().toISOString(),
    }
  }

  @Get('stats')
  @ApiOperation({ summary: '查看队列连接状态' })
  async getStats() {
    const isConnected = this.rabbitMqService.isConnected()

    return {
      connected: isConnected,
      queue: DOC_PROCESS_QUEUE,
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

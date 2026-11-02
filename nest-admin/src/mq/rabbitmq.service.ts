import type { ConfirmChannel } from 'amqplib'
import type { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager'
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import amqp from 'amqp-connection-manager'

import {
  DOC_PROCESS_DEAD_EXCHANGE,
  DOC_PROCESS_DEAD_QUEUE,
  DOC_PROCESS_DEAD_ROUTING_KEY,
  DOC_PROCESS_EXCHANGE,
  DOC_PROCESS_QUEUE,
  DOC_PROCESS_ROUTING_KEY,
} from './mq.constants'

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name)
  private connection: AmqpConnectionManager | null = null
  private channelWrapper: ChannelWrapper | null = null

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const mqUrl = this.configService.get<string>('RABBITMQ_URL') || process.env.RABBITMQ_URL

    if (!mqUrl) {
      this.logger.warn('未检测到 RABBITMQ_URL 环境变量，RabbitMQ 服务未激活')
      return
    }

    // 脱敏打印连接目标，便于定位是否读取到正确的 Broker
    const maskedUrl = mqUrl.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')
    this.logger.log(`正在连接 RabbitMQ 实例: ${maskedUrl}`)

    try {
      this.connection = amqp.connect([mqUrl], {
        heartbeatIntervalInSeconds: 10,
        reconnectTimeInSeconds: 5,
      })

      this.connection.on('connect', () => {
        this.logger.log('RabbitMQ Broker 物理连接已成功建立')
      })

      this.connection.on('connectFailed', (err) => {
        this.logger.error(`RabbitMQ 连接失败: ${err.err?.message || err.err || err}`)
      })

      this.connection.on('disconnect', (err) => {
        this.logger.warn(`RabbitMQ 连接断开，准备自动重连: ${err.err?.message || err}`)
      })

      this.channelWrapper = this.connection.createChannel({
        json: true,
        setup: async (channel: ConfirmChannel) => {
          await this.assertTopology(channel)
        },
      })

      // 15 秒连接超时保护（非阻塞设计：超时只打 warning，避免阻塞 Nest 进程正常启动）
      await Promise.race([
        this.channelWrapper.waitForConnect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('RabbitMQ 连接等待超时(15s)')), 15000),
        ),
      ])
      this.logger.log('RabbitMQ 信道与基础拓扑声明就绪')
    }
    catch (error: any) {
      this.logger.warn(`RabbitMQ 启动连接预检未就绪（后台将继续自动重连）: ${error.message}`)
    }
  }

  /**
   * 自动声明核心拓扑（交换机、队列与死信绑定，支持重启自愈）
   */
  private async assertTopology(channel: ConfirmChannel) {
    // 1. 声明死信交换机与死信队列（用于容纳多次消费失败的毒丸消息）
    await channel.assertExchange(DOC_PROCESS_DEAD_EXCHANGE, 'topic', { durable: true })
    await channel.assertQueue(DOC_PROCESS_DEAD_QUEUE, { durable: true })
    await channel.bindQueue(DOC_PROCESS_DEAD_QUEUE, DOC_PROCESS_DEAD_EXCHANGE, DOC_PROCESS_DEAD_ROUTING_KEY)

    // 2. 声明主业务 Topic 交换机
    await channel.assertExchange(DOC_PROCESS_EXCHANGE, 'topic', { durable: true })

    // 3. 声明 AI 处理队列（配置死信路由：当消息被拒绝或超时时自动落入死信队列）
    await channel.assertQueue(DOC_PROCESS_QUEUE, {
      durable: true,
      deadLetterExchange: DOC_PROCESS_DEAD_EXCHANGE,
      deadLetterRoutingKey: DOC_PROCESS_DEAD_ROUTING_KEY,
    })

    // 4. 将业务队列绑定到 Topic 交换机
    await channel.bindQueue(DOC_PROCESS_QUEUE, DOC_PROCESS_EXCHANGE, DOC_PROCESS_ROUTING_KEY)
  }

  /**
   * 基础消息发送（持久化投递）
   * @param exchange 目标交换机
   * @param routingKey 路由键
   * @param payload 消息载荷
   */
  async publish(exchange: string, routingKey: string, payload: unknown): Promise<boolean> {
    if (!this.channelWrapper) {
      this.logger.warn(`RabbitMQ 信道未初始化，消息投递失败: ${routingKey}`)
      return false
    }

    try {
      await this.channelWrapper.publish(exchange, routingKey, payload, {
        contentType: 'application/json',
        persistent: true, // 磁盘持久化，保证 MQ 节点重启消息不丢失
      })
      return true
    }
    catch (error) {
      this.logger.error(`RabbitMQ 消息发送异常 [${exchange} -> ${routingKey}]: ${error}`)
      return false
    }
  }

  /**
   * 检查 MQ 服务是否连接正常
   */
  isConnected(): boolean {
    return Boolean(this.connection?.isConnected())
  }

  async onModuleDestroy() {
    try {
      await this.channelWrapper?.close()
      await this.connection?.close()
      this.logger.log('RabbitMQ 连接与信道已安全关闭')
    }
    catch (error) {
      this.logger.error(`关闭 RabbitMQ 连接发生异常: ${error}`)
    }
  }
}

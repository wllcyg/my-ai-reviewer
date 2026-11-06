import type { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager'
import type { ConfirmChannel, ConsumeMessage } from 'amqplib'
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
  DOC_QUEUES,
  DOC_ROUTING_KEYS,
  DOC_TOPIC_EXCHANGE,
} from './mq.constants'

export interface ConsumerOptions {
  /** 消费者限流预取数量，默认 1 (严格削峰) */
  prefetch?: number
}

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name)
  private connection: AmqpConnectionManager | null = null
  private channelWrapper: ChannelWrapper | null = null
  private readonly consumerChannels: ChannelWrapper[] = []

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
    await channel.assertExchange(DOC_TOPIC_EXCHANGE, 'topic', { durable: true })

    // 3. 声明三路独立衍生业务队列 (均挂载死信路由)
    // 3.1 向量化写入专用队列 (Cloudflare Vectorize)
    await channel.assertQueue(DOC_QUEUES.INDEX_VECTOR, {
      durable: true,
      deadLetterExchange: DOC_PROCESS_DEAD_EXCHANGE,
      deadLetterRoutingKey: DOC_PROCESS_DEAD_ROUTING_KEY,
    })
    await channel.bindQueue(DOC_QUEUES.INDEX_VECTOR, DOC_TOPIC_EXCHANGE, DOC_ROUTING_KEYS.INDEX_VECTOR)

    // 3.2 Elasticsearch 全文倒排专用队列
    await channel.assertQueue(DOC_QUEUES.INDEX_ES, {
      durable: true,
      deadLetterExchange: DOC_PROCESS_DEAD_EXCHANGE,
      deadLetterRoutingKey: DOC_PROCESS_DEAD_ROUTING_KEY,
    })
    await channel.bindQueue(DOC_QUEUES.INDEX_ES, DOC_TOPIC_EXCHANGE, DOC_ROUTING_KEYS.INDEX_ES)

    // 3.3 知识图谱三元组抽取专用队列 (Neo4j)
    await channel.assertQueue(DOC_QUEUES.INDEX_GRAPH, {
      durable: true,
      deadLetterExchange: DOC_PROCESS_DEAD_EXCHANGE,
      deadLetterRoutingKey: DOC_PROCESS_DEAD_ROUTING_KEY,
    })
    await channel.bindQueue(DOC_QUEUES.INDEX_GRAPH, DOC_TOPIC_EXCHANGE, DOC_ROUTING_KEYS.INDEX_GRAPH)

    // 4. 声明旧 AI 处理队列（兼容老版本全量任务流）
    await channel.assertQueue(DOC_QUEUES.LEGACY_PROCESS, {
      durable: true,
      deadLetterExchange: DOC_PROCESS_DEAD_EXCHANGE,
      deadLetterRoutingKey: DOC_PROCESS_DEAD_ROUTING_KEY,
    })
    await channel.bindQueue(DOC_QUEUES.LEGACY_PROCESS, DOC_TOPIC_EXCHANGE, DOC_ROUTING_KEYS.START)

    this.logger.log(`[MQ Topology] 基础拓扑就绪: 1个Topic交换机 [${DOC_TOPIC_EXCHANGE}] ➔ 3个业务队列 [Vector, ES, Graph]`)
  }

  /**
   * 注册指定队列的消费者（带 QoS 限流、自愈重连、手动 ACK/NACK）
   * @param queueName 队列名 (如 DOC_QUEUES.INDEX_VECTOR)
   * @param onMessage 业务处理回调
   * @param options 消费者配置（如 prefetch 削峰）
   */
  async consume<T = any>(
    queueName: string,
    onMessage: (data: T, rawMsg: ConsumeMessage) => Promise<void>,
    options: ConsumerOptions = {},
  ): Promise<void> {
    if (!this.connection) {
      this.logger.warn(`RabbitMQ 连接实例尚未就绪，暂缓绑定队列消费者: ${queueName}`)
      return
    }

    const prefetch = options.prefetch ?? 1

    const consumerChannel = this.connection.createChannel({
      setup: async (channel: ConfirmChannel) => {
        // 设置消费者 QoS (防止瞬时大流量撑爆内存)
        await channel.prefetch(prefetch)

        await channel.consume(
          queueName,
          async (msg: ConsumeMessage | null) => {
            if (!msg)
              return

            let parsed: T
            try {
              parsed = JSON.parse(msg.content.toString()) as T
            }
            catch (parseErr) {
              this.logger.error(`[MQ Consumer] 消息反序列化失败，送入死信: ${parseErr}`)
              channel.nack(msg, false, false)
              return
            }

            try {
              await onMessage(parsed, msg)
              // 业务处理成功，手动签收
              channel.ack(msg)
            }
            catch (err: any) {
              this.logger.error(`[MQ Consumer] 队列 [${queueName}] 消息处理失败: ${err.message || err}`, err.stack)
              // 失败且不重回队列，交由 MQ 死信交换机流转排查
              channel.nack(msg, false, false)
            }
          },
          { noAck: false }, // 严格手动 ACK
        )

        this.logger.log(`[MQ Consumer] 已挂载消费者监听: 队列 [${queueName}] (QoS=${prefetch})`)
      },
    })

    this.consumerChannels.push(consumerChannel)
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
      for (const ch of this.consumerChannels) {
        await ch.close()
      }
      await this.channelWrapper?.close()
      await this.connection?.close()
      this.logger.log('RabbitMQ 连接与信道已安全关闭')
    }
    catch (error) {
      this.logger.error(`关闭 RabbitMQ 连接发生异常: ${error}`)
    }
  }
}

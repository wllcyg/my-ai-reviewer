import { Inject, Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { IVectorConfig, VectorConfig } from '~/config'
import { DEFAULT_EMBEDDING_BATCH_SIZE, DEFAULT_EMBEDDING_MODEL, DEFAULT_VECTOR_DIMENSION } from '../vector.constant'
import { IEmbeddingProvider } from '../vector.interface'
import { MockEmbeddingProvider } from './mock-embedding.provider'

/**
 * 通用 OpenAI 兼容协议文本向量化适配器
 * 支持任何兼容 OpenAI Embeddings API 的端点（Cloudflare Workers AI、OpenAI、Azure OpenAI、Ollama 等）
 * 当前默认模型：@cf/baai/bge-m3 (1024 维)
 */
@Injectable()
export class OpenAiEmbeddingProvider implements IEmbeddingProvider {
  readonly providerName = 'openai'
  readonly dimension: number
  private readonly model: string
  private readonly accountId: string
  private readonly apiToken: string
  private readonly baseUrl: string

  private readonly logger = new Logger(OpenAiEmbeddingProvider.name)

  constructor(
    @Inject(VectorConfig.KEY)
    private readonly config: IVectorConfig,
    private readonly mockFallback: MockEmbeddingProvider,
  ) {
    this.accountId = config.accountId
    this.apiToken = config.apiToken
    this.baseUrl = config.baseUrl || (this.accountId ? `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/v1` : '')
    this.model = config.embeddingModel || DEFAULT_EMBEDDING_MODEL
    this.dimension = config.embeddingDimension || DEFAULT_VECTOR_DIMENSION

    if (!this.apiToken || !this.accountId) {
      this.logger.warn(
        `[OpenAiEmbedding] 未检测到有效的 API Token 或 Account ID，已自动启用 Mock 确定性降级模式`,
      )
    }
    else {
      this.logger.log(
        `[OpenAiEmbedding] 成功初始化标准 OpenAI 协议向量服务: baseUrl=${this.baseUrl}, model=${this.model}, dimension=${this.dimension}`,
      )
    }
  }

  /**
   * 分批批量调用接口生成 Embeddings
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts.length)
      return []

    // 缺少 Token 凭据时自动优雅降级，保障开发/测试/CI 链路畅通
    if (!this.apiToken || !this.accountId) {
      return this.mockFallback.generateEmbeddings(texts)
    }

    const batchSize = DEFAULT_EMBEDDING_BATCH_SIZE
    const allEmbeddings: number[][] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const batchVectors = await this.callApiWithRetry(batch)
      allEmbeddings.push(...batchVectors)
    }

    return allEmbeddings
  }

  /**
   * 单批次请求 (优先采用标准 OpenAI Embeddings 规范)
   */
  private async callApiWithRetry(
    batch: string[],
    maxRetries = 2,
  ): Promise<number[][]> {
    // 1. 标准 OpenAI 兼容端点: {baseUrl}/embeddings
    const openaiUrl = `${this.baseUrl}/embeddings`
    // 2. Cloudflare 原生端点兜底: /ai/run/{model}
    const legacyUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`

    let attempt = 0
    while (attempt <= maxRetries) {
      try {
        // 首选 OpenAI 标准规范入参：{ model, input }
        const response = await axios.post(
          openaiUrl,
          {
            model: this.model,
            input: batch,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 15000,
          },
        )

        // 解析标准 OpenAI 返回结构: { data: [{ embedding: [...] }] }
        if (Array.isArray(response.data?.data)) {
          const vectors = response.data.data
            .map((item: any) => item.embedding)
            .filter((v: any) => Array.isArray(v))
          if (vectors.length === batch.length) {
            return vectors
          }
        }

        // 兼容原生返回结构: { result: { data: [...] } }
        const resultData = response.data?.result?.data || response.data?.result
        if (Array.isArray(resultData)) {
          return resultData
        }

        throw new Error(
          `OpenAI 协议响应格式异常: ${JSON.stringify(response.data)}`,
        )
      }
      catch (error: any) {
        // 尝试使用 Cloudflare 原生 legacy run 端点兜底一次
        try {
          const legacyResp = await axios.post(
            legacyUrl,
            { text: batch },
            {
              headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json',
              },
              timeout: 15000,
            },
          )
          const legacyData = legacyResp.data?.result?.data || legacyResp.data?.result
          if (Array.isArray(legacyData)) {
            return legacyData
          }
        }
        catch {
          // 忽略 legacy 失败，抛出主要异常进入重试
        }

        attempt++
        const isLast = attempt > maxRetries
        const errMsg = error.response?.data?.error?.message
          || error.response?.data?.errors?.[0]?.message
          || error.message
          || String(error)

        this.logger.warn(
          `[OpenAiEmbedding] 批次生成向量失败 (第 ${attempt} 次尝试): ${errMsg}`,
        )

        if (isLast) {
          this.logger.error(
            `[OpenAiEmbedding] 重试超过最大上限 (${maxRetries}次)，切换至本地 Mock 向量兜底`,
          )
          return this.mockFallback.generateEmbeddings(batch)
        }

        // 指数退避等待 500ms, 1000ms
        await new Promise(resolve => setTimeout(resolve, attempt * 500))
      }
    }

    return this.mockFallback.generateEmbeddings(batch)
  }
}


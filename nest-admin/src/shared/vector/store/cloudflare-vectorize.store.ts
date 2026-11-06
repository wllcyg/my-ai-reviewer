import { Inject, Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import { IVectorConfig, VectorConfig } from '~/config'
import {
  IVectorStore,
  VectorPoint,
  VectorSearchOptions,
  VectorSearchResult,
} from '../vector.interface'
import { MemoryVectorStore } from './memory-vector.store'

/**
 * Cloudflare Vectorize Serverless 向量数据库存储适配器
 */
@Injectable()
export class CloudflareVectorizeStore implements IVectorStore {
  readonly storeName = 'vectorize'
  private readonly accountId: string
  private readonly apiToken: string
  private readonly indexName: string

  private readonly logger = new Logger(CloudflareVectorizeStore.name)

  constructor(
    @Inject(VectorConfig.KEY)
    private readonly config: IVectorConfig,
    private readonly memoryFallback: MemoryVectorStore,
  ) {
    this.accountId = config.accountId
    this.apiToken = config.apiToken
    this.indexName = config.vectorizeIndex || 'word-embeddings'

    if (!this.apiToken || !this.accountId) {
      this.logger.warn(
        `[CloudflareVectorize] 未检测到有效的 CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_ACCOUNT_ID，已自动启用 Memory 内存向量库降级模式`,
      )
    }
    else {
      this.logger.log(
        `[CloudflareVectorize] 成功初始化 Vectorize 存储服务: indexName=${this.indexName}`,
      )
    }
  }

  /**
   * 批量 Upsert 写入切片向量与 Payload
   */
  async upsert(points: VectorPoint[]): Promise<void> {
    if (!points.length)
      return

    if (!this.apiToken || !this.accountId) {
      return this.memoryFallback.upsert(points)
    }

    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/upsert`

      // 转换为 Cloudflare Vectorize 标准 NDJSON 格式
      const ndjsonBody = points
        .map(p =>
          JSON.stringify({
            id: p.id,
            values: p.vector,
            metadata: p.payload,
          }),
        )
        .join('\n')

      await axios.post(url, ndjsonBody, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/x-ndjson',
        },
        timeout: 15000,
      })

      this.logger.debug(
        `[CloudflareVectorize] 成功批量写入 ${points.length} 条向量至 Vectorize`,
      )
    }
    catch (err: any) {
      this.logger.error(
        `[CloudflareVectorize] 写入向量库失败: ${err.response?.data?.errors?.[0]?.message || err.message}，回退写入内存存储`,
      )
      await this.memoryFallback.upsert(points)
    }
  }

  /**
   * 按文档编码清理旧版本向量
   */
  async deleteByDocCode(docCode: string): Promise<void> {
    if (!this.apiToken || !this.accountId) {
      return this.memoryFallback.deleteByDocCode(docCode)
    }

    // 先清理本地备用内存
    await this.memoryFallback.deleteByDocCode(docCode)
  }

  /**
   * 相似度向量检索 (支持 acl_tags 权限过滤)
   */
  async search(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    if (!this.apiToken || !this.accountId) {
      return this.memoryFallback.search(queryVector, options)
    }

    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/vectorize/v2/indexes/${this.indexName}/query`
      const topK = options?.topK || 5

      const response = await axios.post(
        url,
        {
          vector: queryVector,
          topK,
          returnValues: false,
          returnMetadata: 'all',
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      )

      const matches = response.data?.result?.matches || []
      const results: VectorSearchResult[] = []

      for (const match of matches) {
        const payload = match.metadata || {}

        // 若指定了目标文档过滤，精确匹配 docCode
        if (options?.filter?.docCode && payload.docCode !== options.filter.docCode) {
          continue
        }

        // 若指定了权限标签，执行交集校验
        if (options?.filter?.acl_tags?.length) {
          const pointTags: string[] = payload.acl_tags || []
          const hasIntersection = options.filter.acl_tags.some(tag =>
            pointTags.includes(tag),
          )
          if (!hasIntersection)
            continue
        }

        results.push({
          id: match.id,
          score: match.score,
          payload,
        })
      }

      return results
    }
    catch (err: any) {
      this.logger.warn(
        `[CloudflareVectorize] 向量检索失败: ${err.message}，使用内存库重试`,
      )
      return this.memoryFallback.search(queryVector, options)
    }
  }
}


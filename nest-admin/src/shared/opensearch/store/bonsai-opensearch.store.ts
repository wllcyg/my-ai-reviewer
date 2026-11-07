import { Client } from '@opensearch-project/opensearch'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { IOpenSearchConfig } from '~/config/opensearch.config'
import { opensearchRegToken } from '~/config/opensearch.config'
import {
  DEFAULT_INDEX_MAPPINGS,
  DEFAULT_OPENSEARCH_INDEX,
} from '../opensearch.constant'
import type {
  IOpenSearchStore,
  OpenSearchChunkDocument,
  OpenSearchSearchOptions,
  OpenSearchSearchResult,
} from '../opensearch.interface'
import { MockOpenSearchStore } from './mock-opensearch.store'

@Injectable()
export class BonsaiOpenSearchStore implements IOpenSearchStore, OnModuleInit {
  readonly storeName = 'bonsai'
  private readonly logger = new Logger(BonsaiOpenSearchStore.name)
  private client: Client | null = null
  private indexName: string = DEFAULT_OPENSEARCH_INDEX
  private autoCreateIndex = true
  private initialized = false

  constructor(
    private readonly configService: ConfigService,
    private readonly fallbackMockStore: MockOpenSearchStore,
  ) {
    const config = this.configService.get<IOpenSearchConfig>(opensearchRegToken)
    const nodeUrl = config?.nodeUrl || process.env.BONSAI_URL || ''
    this.indexName = config?.indexName || DEFAULT_OPENSEARCH_INDEX
    this.autoCreateIndex = config?.autoCreateIndex ?? true

    if (nodeUrl) {
      try {
        this.client = new Client({
          node: nodeUrl,
        })
        this.logger.log(`[BonsaiOpenSearchStore] 客户端初始化成功，目标索引: [${this.indexName}]`)
      }
      catch (err: any) {
        this.logger.error(`[BonsaiOpenSearchStore] 初始化客户端失败: ${err.message}`, err.stack)
        this.client = null
      }
    }
    else {
      this.logger.warn('[BonsaiOpenSearchStore] 未提供 BONSAI_URL，将降级使用 Mock 模式')
    }
  }

  async onModuleInit() {
    if (this.client && this.autoCreateIndex) {
      await this.ensureIndex()
    }
  }

  /**
   * 确保索引与 smartcn Mapping 结构存在
   */
  async ensureIndex(): Promise<void> {
    if (!this.client) {
      await this.fallbackMockStore.ensureIndex()
      return
    }

    try {
      const existsRes = await this.client.indices.exists({
        index: this.indexName,
      })

      // OpenSearch client 返回格式可能为 body: boolean 或 res: boolean
      const exists = typeof existsRes === 'boolean' ? existsRes : (existsRes.body ?? false)

      if (!exists) {
        this.logger.log(`[BonsaiOpenSearchStore] 索引 [${this.indexName}] 不存在，正在根据规划创建...`)
        await this.client.indices.create({
          index: this.indexName,
          body: DEFAULT_INDEX_MAPPINGS as any,
        })
        this.logger.log(`[BonsaiOpenSearchStore] ✅ 索引 [${this.indexName}] 创建成功 (shards: 1, analyzer: smartcn)`)
      }
      else {
        this.logger.log(`[BonsaiOpenSearchStore] 索引 [${this.indexName}] 已存在，跳过创建`)
      }
      this.initialized = true
    }
    catch (err: any) {
      this.logger.error(`[BonsaiOpenSearchStore] 确保索引存在时出错: ${err.message}`, err.stack)
    }
  }

  async ping(): Promise<boolean> {
    if (!this.client) {
      return this.fallbackMockStore.ping()
    }
    try {
      const res = await this.client.ping()
      return res.body ?? true
    }
    catch (err: any) {
      this.logger.error(`[BonsaiOpenSearchStore] Ping 失败: ${err.message}`)
      return false
    }
  }

  /**
   * 批量将切片文档写入/覆盖至 OpenSearch
   */
  async bulkIndex(docs: OpenSearchChunkDocument[]): Promise<void> {
    if (!docs.length) {
      return
    }

    if (!this.client) {
      this.logger.warn('[BonsaiOpenSearchStore] 无真实连接，降级写入 Mock 存储')
      await this.fallbackMockStore.bulkIndex(docs)
      return
    }

    try {
      // 组装 OpenSearch Bulk 批处理协议体
      const body: any[] = []
      for (const doc of docs) {
        body.push({
          index: {
            _index: this.indexName,
            _id: doc.id,
          },
        })
        body.push(doc)
      }

      const res = await this.client.bulk({
        refresh: true,
        body,
      })

      if (res.body?.errors) {
        this.logger.warn(`[BonsaiOpenSearchStore] 批量索引部分存在错误: ${JSON.stringify(res.body.items?.slice(0, 3))}`)
      }
      else {
        this.logger.log(`[BonsaiOpenSearchStore] ✅ 批量索引成功写入 ${docs.length} 个切片`)
      }
    }
    catch (err: any) {
      this.logger.error(`[BonsaiOpenSearchStore] Bulk 索引失败，降级写入 Mock: ${err.message}`, err.stack)
      await this.fallbackMockStore.bulkIndex(docs)
    }
  }

  /**
   * 执行 BM25 关键词检索 (带 multi_match 权重与 ACL tags 过滤)
   */
  async search(options: OpenSearchSearchOptions): Promise<OpenSearchSearchResult[]> {
    const { query, limit = 10, aclTags, docCode } = options

    if (!this.client) {
      return this.fallbackMockStore.search(options)
    }

    try {
      const mustClauses: any[] = []
      const filterClauses: any[] = []

      // 1. 关键词查询 (multi_match，带字段权重加成)
      if (query && query.trim()) {
        mustClauses.push({
          multi_match: {
            query: query.trim(),
            fields: ['title^3', 'headingPath^2', 'content^1'],
            type: 'best_fields',
          },
        })
      }
      else {
        mustClauses.push({ match_all: {} })
      }

      // 2. docCode 精确过滤 (可选)
      if (docCode) {
        filterClauses.push({
          term: { docCode },
        })
      }

      // 3. ACL 权限标签交集过滤 (用户拥有的任何一个标签命中即可)
      if (aclTags && aclTags.length > 0) {
        filterClauses.push({
          terms: { acl_tags: aclTags },
        })
      }

      const searchBody = {
        size: limit,
        query: {
          bool: {
            must: mustClauses,
            filter: filterClauses,
          },
        },
        highlight: {
          pre_tags: ['<em>'],
          post_tags: ['</em>'],
          fields: {
            title: {},
            headingPath: {},
            content: {
              fragment_size: 150,
              number_of_fragments: 3,
            },
          },
        },
      }

      const res = await this.client.search({
        index: this.indexName,
        body: searchBody,
      })

      const hits = res.body?.hits?.hits || []
      return hits.map((hit: any) => {
        const src = hit._source || {}
        return {
          id: hit._id,
          score: hit._score || 0,
          docCode: src.docCode,
          docId: src.docId,
          chunkIndex: src.chunkIndex,
          title: src.title,
          headingPath: src.headingPath,
          content: src.content,
          scope: src.scope,
          acl_tags: src.acl_tags || [],
          highlights: hit.highlight
            ? {
                title: hit.highlight.title,
                headingPath: hit.highlight.headingPath,
                content: hit.highlight.content,
              }
            : undefined,
        }
      })
    }
    catch (err: any) {
      this.logger.error(`[BonsaiOpenSearchStore] 检索失败，降级至 Mock 检索: ${err.message}`, err.stack)
      return this.fallbackMockStore.search(options)
    }
  }

  /**
   * 按文档编码删除所有切片
   */
  async deleteByDocCode(docCode: string): Promise<number> {
    if (!this.client) {
      return this.fallbackMockStore.deleteByDocCode(docCode)
    }

    try {
      const res = await this.client.deleteByQuery({
        index: this.indexName,
        refresh: true,
        body: {
          query: {
            term: { docCode },
          },
        },
      })
      const deleted = (res.body as any)?.deleted || 0
      this.logger.log(`[BonsaiOpenSearchStore] 删除文档切块完成: docCode=${docCode}, deleted=${deleted}`)
      return deleted
    }
    catch (err: any) {
      this.logger.error(`[BonsaiOpenSearchStore] 删除文档失败: ${err.message}`, err.stack)
      return this.fallbackMockStore.deleteByDocCode(docCode)
    }
  }
}

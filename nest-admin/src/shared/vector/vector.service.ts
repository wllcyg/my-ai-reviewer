import { Inject, Injectable, Logger } from '@nestjs/common'
import { EMBEDDING_PROVIDER_TOKEN, VECTOR_STORE_TOKEN } from './vector.constant'
import {
  IEmbeddingProvider,
  IndexDocChunksParams,
  IVectorStore,
  VectorPoint,
  VectorSearchResult,
} from './vector.interface'

/**
 * 向量领域统一门面服务 (Unified Facade)
 * 职责：
 * 1. 维护权限标签 (acl_tags) 的单一生成标准，保证写入与检索绝对一致；
 * 2. 调度活跃的 IEmbeddingProvider 执行批量向量计算；
 * 3. 调度活跃的 IVectorStore 执行确定性幂等写入与基于权限标签的检索召回。
 */
@Injectable()
export class VectorService {
  private readonly logger = new Logger(VectorService.name)

  constructor(
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(VECTOR_STORE_TOKEN)
    private readonly vectorStore: IVectorStore,
  ) {
    this.logger.log(
      `[VectorService] 门面服务初始化完毕: Provider=[${embeddingProvider.providerName}(dim:${embeddingProvider.dimension})], Store=[${vectorStore.storeName}]`,
    )
  }

  /** 当前启用的向量模型提供者标识 */
  get providerName(): string {
    return this.embeddingProvider.providerName
  }

  /** 当前启用的向量数据库实现标识 */
  get storeName(): string {
    return this.vectorStore.storeName
  }

  /**
   * 构造文档切块的权限标签数组 (Single Source of Truth)
   * 规则：
   * - PUBLIC: ['public', 'user:{createBy}']
   * - DEPT: ['dept:{id1}', 'dept:{id2}', 'user:{createBy}']
   * - PRIVATE: ['user:{createBy}']
   */
  buildDocAclTags(
    scope: string,
    visibleDeptIds: number[] = [],
    createBy?: number,
  ): string[] {
    const tags = new Set<string>()

    if (scope === 'PUBLIC') {
      tags.add('public')
    }
    else if (scope === 'DEPT' && Array.isArray(visibleDeptIds)) {
      for (const deptId of visibleDeptIds) {
        if (deptId) {
          tags.add(`dept:${deptId}`)
        }
      }
    }

    if (createBy) {
      tags.add(`user:${createBy}`)
    }

    return Array.from(tags)
  }

  /**
   * 构造当前登录用户的检索身份标签数组
   * 规则：
   * - 基础标签: ['public', 'user:{uid}']
   * - 所属部门及上级祖先链: ['dept:{deptId}', 'dept:{ancestorId1}', ...]
   */
  buildUserAclTags(user: IAuthUser, deptAncestorIds: number[] = []): string[] {
    const tags = new Set<string>(['public', `user:${user.uid}`])

    if (user.deptId) {
      tags.add(`dept:${user.deptId}`)
    }

    if (Array.isArray(deptAncestorIds)) {
      for (const ancId of deptAncestorIds) {
        if (ancId) {
          tags.add(`dept:${ancId}`)
        }
      }
    }

    return Array.from(tags)
  }

  /**
   * 执行完整的文档切片真实向量化入库流程
   */
  async indexDocumentChunks(
    params: IndexDocChunksParams,
  ): Promise<{ chunkCount: number, costMs: number }> {
    const startTime = Date.now()
    const { docCode, docId, title, scope, visibleDeptIds = [], createBy, chunks } = params

    if (!chunks.length) {
      this.logger.warn(`[VectorService] 文档 [${docCode}] 切块为空，跳过向量化`)
      return { chunkCount: 0, costMs: 0 }
    }

    // 1. 生成该文档切块的标准权限标签
    const aclTags = this.buildDocAclTags(scope, visibleDeptIds, createBy)

    // 2. 提取待向量化文本序列 (优先使用带标题面包屑的 embeddingText)
    const embeddingTexts = chunks.map(
      chunk => chunk.embeddingText || chunk.content,
    )

    this.logger.log(
      `[VectorService] 🚀 开始批量向量化: docCode=${docCode}, 切块数=${chunks.length}, provider=${this.embeddingProvider.providerName}`,
    )

    // 3. 批量生成稠密向量
    const vectors = await this.embeddingProvider.generateEmbeddings(embeddingTexts)

    if (vectors.length !== chunks.length) {
      throw new Error(
        `向量生成数量不匹配: 期望 ${chunks.length} 条，实际返回 ${vectors.length} 条`,
      )
    }

    // 4. 组装为标准的 VectorPoint 存储结构
    const points: VectorPoint[] = chunks.map((chunk, i) => {
      const chunkIndex = chunk.metadata?.chunkIndex ?? i
      const pointId = `${docCode}_${chunkIndex}`

      return {
        id: pointId,
        vector: vectors[i],
        payload: {
          docCode,
          docId,
          title,
          chunkIndex,
          headingPath: chunk.metadata?.headingPath ?? [],
          content: chunk.content,
          scope,
          visibleDeptIds,
          acl_tags: aclTags,
          charCount: chunk.metadata?.charCount ?? chunk.content.length,
          sectionIndex: chunk.metadata?.sectionIndex ?? 0,
        },
      }
    })

    // 5. 批量幂等 Upsert 写入向量库
    await this.vectorStore.upsert(points)

    const costMs = Date.now() - startTime
    this.logger.log(
      `[VectorService] ✅ 文档 [${docCode}] 向量化并持久化完成: 块数=${points.length}, 耗时=${costMs}ms, store=${this.vectorStore.storeName}`,
    )

    return { chunkCount: points.length, costMs }
  }

  /**
   * 向量语义检索 (全流程封装：自动计算 Query 向量与用户权限过滤标签)
   */
  async search(
    queryText: string,
    user: IAuthUser,
    options?: { topK?: number, deptAncestorIds?: number[], docCode?: string },
  ): Promise<VectorSearchResult[]> {
    if (!queryText.trim())
      return []

    // 1. 将查询词转换为向量
    const [queryVector] = await this.embeddingProvider.generateEmbeddings([queryText])
    if (!queryVector)
      return []

    // 2. 针对普通用户注入其身份标签（管理员不限）
    const isSuperOrAdmin = user.roles?.some(r => ['admin', 'super_admin'].includes(r))
    const aclTags = isSuperOrAdmin
      ? undefined
      : this.buildUserAclTags(user, options?.deptAncestorIds)

    // 3. 执行检索
    return this.vectorStore.search(queryVector, {
      topK: options?.topK || 5,
      filter: {
        acl_tags: aclTags,
        docCode: options?.docCode,
      },
    })
  }

  /**
   * 删除文档对应的所有切块向量
   */
  async deleteDocumentVectors(docCode: string): Promise<void> {
    await this.vectorStore.deleteByDocCode(docCode)
    this.logger.log(`[VectorService] 已删除文档 [${docCode}] 的关联向量索引`)
  }
}


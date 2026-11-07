import { Inject, Injectable, Logger } from '@nestjs/common'
import { OPENSEARCH_STORE_TOKEN } from './opensearch.constant'
import type {
  IndexEsDocChunksParams,
  IOpenSearchStore,
  OpenSearchChunkDocument,
  OpenSearchSearchOptions,
  OpenSearchSearchResult,
} from './opensearch.interface'

@Injectable()
export class OpenSearchService {
  private readonly logger = new Logger(OpenSearchService.name)

  constructor(
    @Inject(OPENSEARCH_STORE_TOKEN)
    private readonly store: IOpenSearchStore,
  ) {}

  get storeName(): string {
    return this.store.storeName
  }

  /**
   * 构造文档切片的安全访问标签数组
   * 规则与向量数据库 100% 镜像保持对齐：
   * - PUBLIC: ['public']
   * - PRIVATE: ['user:{createBy}']
   * - DEPT: ['dept:{deptId1}', 'dept:{deptId2}', ...]
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
    else if (scope === 'PRIVATE') {
      if (createBy) {
        tags.add(`user:${createBy}`)
      }
      else {
        tags.add('private')
      }
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
   * 执行切片批量全文倒排索引入库
   */
  async indexDocumentChunks(
    params: IndexEsDocChunksParams,
  ): Promise<{ chunkCount: number, costMs: number }> {
    const startTime = Date.now()
    const { docCode, docId, title, scope, visibleDeptIds = [], createBy, chunks } = params

    if (!chunks.length) {
      this.logger.warn(`[OpenSearchService] 文档 [${docCode}] 切块为空，跳过全文索引`)
      return { chunkCount: 0, costMs: 0 }
    }

    // 1. 生成 ACL 权限安全标签
    const aclTags = this.buildDocAclTags(scope, visibleDeptIds, createBy)

    // 2. 将纯函数切片组装为 OpenSearch 文档模型
    const nowIso = new Date().toISOString()
    const osDocs: OpenSearchChunkDocument[] = chunks.map((chunk, i) => {
      const chunkIndex = chunk.metadata?.chunkIndex ?? i
      const headingPath = Array.isArray(chunk.metadata?.headingPath)
        ? chunk.metadata.headingPath.join(' > ')
        : (chunk.metadata?.headingPath || '')

      return {
        // 保持与向量数据库 ID 规则 100% 相同，便于后续 RRF 倒数排名融合
        id: `${docCode}_${chunkIndex}`,
        docCode,
        docId,
        chunkIndex,
        title,
        headingPath,
        content: chunk.content,
        tokens: chunk.metadata?.charCount ?? chunk.content.length,
        scope,
        visibleDeptIds,
        acl_tags: aclTags,
        createdAt: nowIso,
      }
    })

    // 3. 执行 Bulk 批量写入
    await this.store.bulkIndex(osDocs)

    const costMs = Date.now() - startTime
    this.logger.log(
      `[OpenSearchService] ✅ 文档 [${docCode}] 全文索引入库完成: chunkCount=${osDocs.length}, 耗时=${costMs}ms, 驱动=${this.store.storeName}`,
    )

    return { chunkCount: osDocs.length, costMs }
  }

  /**
   * 执行 BM25 关键词检索
   */
  async search(options: OpenSearchSearchOptions): Promise<OpenSearchSearchResult[]> {
    return this.store.search(options)
  }

  /**
   * 删除文档对应的所有切块全文索引
   */
  async deleteDocumentChunks(docCode: string): Promise<number> {
    return this.store.deleteByDocCode(docCode)
  }

  /**
   * 服务连通性探测
   */
  async ping(): Promise<boolean> {
    return this.store.ping()
  }
}

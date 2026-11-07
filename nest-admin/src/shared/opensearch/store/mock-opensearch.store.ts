import { Injectable, Logger } from '@nestjs/common'
import type {
  IOpenSearchStore,
  OpenSearchChunkDocument,
  OpenSearchSearchOptions,
  OpenSearchSearchResult,
} from '../opensearch.interface'

@Injectable()
export class MockOpenSearchStore implements IOpenSearchStore {
  readonly storeName = 'mock'
  private readonly logger = new Logger(MockOpenSearchStore.name)
  private readonly documents = new Map<string, OpenSearchChunkDocument>()

  async ensureIndex(): Promise<void> {
    this.logger.debug('[MockOpenSearchStore] ensureIndex (noop)')
  }

  async ping(): Promise<boolean> {
    return true
  }

  async bulkIndex(docs: OpenSearchChunkDocument[]): Promise<void> {
    for (const doc of docs) {
      this.documents.set(doc.id, { ...doc })
    }
    this.logger.debug(
      `[MockOpenSearchStore] 批量索引完成: count=${docs.length}, 当前总数=${this.documents.size}`,
    )
  }

  async search(options: OpenSearchSearchOptions): Promise<OpenSearchSearchResult[]> {
    const { query, limit = 10, aclTags, docCode } = options
    const queryLower = (query || '').toLowerCase().trim()
    const terms = queryLower.split(/\s+/).filter(Boolean)

    const results: OpenSearchSearchResult[] = []

    for (const doc of this.documents.values()) {
      // 1. 文档编码过滤
      if (docCode && doc.docCode !== docCode) {
        continue
      }

      // 2. ACL 权限过滤
      if (aclTags && aclTags.length > 0) {
        const hasPermission = doc.acl_tags.some(tag => aclTags.includes(tag))
        if (!hasPermission) {
          continue
        }
      }

      // 3. 简单的伪 BM25 相关性得分计算
      const textToMatch = `${doc.title} ${doc.headingPath || ''} ${doc.content}`.toLowerCase()
      let score = 0

      if (terms.length === 0) {
        score = 1.0
      }
      else {
        for (const term of terms) {
          if (doc.title.toLowerCase().includes(term)) {
            score += 3.0
          }
          if (doc.headingPath && doc.headingPath.toLowerCase().includes(term)) {
            score += 2.0
          }
          if (doc.content.toLowerCase().includes(term)) {
            score += 1.0
          }
        }
      }

      if (score > 0) {
        results.push({
          id: doc.id,
          score,
          docCode: doc.docCode,
          docId: doc.docId,
          chunkIndex: doc.chunkIndex,
          title: doc.title,
          headingPath: doc.headingPath,
          content: doc.content,
          scope: doc.scope,
          acl_tags: doc.acl_tags,
          highlights: {
            content: [doc.content.slice(0, 150)],
          },
        })
      }
    }

    // 按得分倒排截断
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }

  async deleteByDocCode(docCode: string): Promise<number> {
    let deletedCount = 0
    for (const [id, doc] of this.documents.entries()) {
      if (doc.docCode === docCode) {
        this.documents.delete(id)
        deletedCount++
      }
    }
    this.logger.debug(
      `[MockOpenSearchStore] 删除文档切块完成: docCode=${docCode}, deleted=${deletedCount}`,
    )
    return deletedCount
  }

  /**
   * 用于测试重置
   */
  clear() {
    this.documents.clear()
  }
}


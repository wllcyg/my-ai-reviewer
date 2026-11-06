import { Injectable, Logger } from '@nestjs/common'
import {
  IVectorStore,
  VectorPoint,
  VectorSearchOptions,
  VectorSearchResult,
} from '../vector.interface'

/**
 * 内存型向量数据库存储适配器
 * 核心特性：
 * 1. 纯内存极速存储，零外部依赖，测试与离线环境开箱即用；
 * 2. 完整支持按确定性 ID 幂等 Upsert、按 docCode 删除；
 * 3. 完整支持余弦相似度（Cosine Similarity）与 acl_tags 权限标签交集过滤。
 */
@Injectable()
export class MemoryVectorStore implements IVectorStore {
  readonly storeName = 'memory'
  private readonly points = new Map<string, VectorPoint>()
  private readonly logger = new Logger(MemoryVectorStore.name)

  /**
   * 批量写入/更新切片向量
   */
  async upsert(points: VectorPoint[]): Promise<void> {
    for (const point of points) {
      this.points.set(point.id, point)
    }
    this.logger.debug(
      `[MemoryVectorStore] 成功写入/覆盖 ${points.length} 条向量，当前总存量: ${this.points.size}`,
    )
  }

  /**
   * 根据文档编码彻底清理旧向量
   */
  async deleteByDocCode(docCode: string): Promise<void> {
    let deletedCount = 0
    for (const [id, point] of this.points.entries()) {
      if (point.payload.docCode === docCode) {
        this.points.delete(id)
        deletedCount++
      }
    }
    this.logger.debug(
      `[MemoryVectorStore] 已清除文档 [${docCode}] 的 ${deletedCount} 条向量`,
    )
  }

  /**
   * 向量相似度检索 (支持基于 acl_tags 权限标签过滤)
   */
  async search(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    const topK = options?.topK || 5
    const filterTags = options?.filter?.acl_tags
    const targetDocCode = options?.filter?.docCode

    const results: VectorSearchResult[] = []

    for (const point of this.points.values()) {
      // 1. 文档编码精确过滤 (如有)
      if (targetDocCode && point.payload.docCode !== targetDocCode) {
        continue
      }

      // 2. 权限标签过滤：用户的标签集合与块的 acl_tags 必须有交集
      if (filterTags && filterTags.length > 0) {
        const pointTags = point.payload.acl_tags || []
        const hasIntersection = filterTags.some(tag => pointTags.includes(tag))
        if (!hasIntersection) {
          continue // 权限不满足，坚决排除
        }
      }

      // 3. 计算余弦相似度
      const score = this.calculateCosineSimilarity(queryVector, point.vector)
      results.push({
        id: point.id,
        score,
        payload: point.payload,
      })
    }

    // 按得分倒序排列，取 TopK
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  /** 获取当前存储点数量 (单测排查用) */
  size(): number {
    return this.points.size
  }

  /** 清空存储 (单测清理用) */
  clear(): void {
    this.points.clear()
  }

  /**
   * 计算两个浮点向量的余弦相似度
   */
  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA.length || !vecB.length || vecA.length !== vecB.length)
      return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i]
      normA += vecA[i] * vecA[i]
      normB += vecB[i] * vecB[i]
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    if (denominator === 0)
      return 0

    return Number((dotProduct / denominator).toFixed(6))
  }
}


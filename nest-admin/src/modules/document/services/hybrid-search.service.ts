import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, IsNull, Repository } from 'typeorm'

import { OpenSearchService } from '~/shared/opensearch/opensearch.service'
import { VectorService } from '~/shared/vector/vector.service'
import { DocumentEntity } from '../document.entity'
import {
  HitDocumentChunkDto,
  HitDocumentDto,
  HybridSearchDto,
  HybridSearchResponseDto,
} from '../dto/hybrid-search.dto'
import { ModelRerankerService } from '../rerank/model-reranker.service'
import type { CandidateChunk, RerankedChunk } from '../rerank/reranker.interface'
import { DocumentPermissionService } from './document-permission.service'

@Injectable()
export class HybridSearchService {
  private readonly logger = new Logger(HybridSearchService.name)

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly docRepo: Repository<DocumentEntity>,
    private readonly vectorService: VectorService,
    private readonly openSearchService: OpenSearchService,
    private readonly permissionService: DocumentPermissionService,
    private readonly reranker: ModelRerankerService,
  ) {}

  /**
   * 混合检索统一门面
   * 流程：
   * 1. 并行双路召回：ES 关键词 (BM25) + Vectorize 语义向量 (Dense Vector)
   * 2. 倒数排名融合 (RRF)：抹平量纲差异，生成统一候选切块集
   * 3. 二次精排 (Rerank)：基于多维交叉特征对 Top 候选切片进行精准赋分
   * 4. 文档级聚合与富化：汇聚切片到文档，注入元数据并按文档综合相关度排序返回
   */
  async search(
    dto: HybridSearchDto,
    user: IAuthUser,
  ): Promise<HybridSearchResponseDto> {
    const startTime = Date.now()
    const query = dto.query?.trim() || ''
    const limit = dto.limit || 10
    const topKPerRoute = dto.topKPerRoute || 20
    const enableRerank = dto.enableRerank !== false
    const vectorWeight = dto.vectorWeight ?? 1.0
    const esWeight = dto.esWeight ?? 0.8
    const kConstant = 60 // RRF 平滑常数

    if (!query) {
      return { items: [], total: 0, costMs: 0, query }
    }

    // 1. 构建检索人 ACL 标签（管理员不限）
    const isAdmin = this.permissionService.isAdmin(user)
    const aclTags = isAdmin ? undefined : this.vectorService.buildUserAclTags(user)

    // 2. 并行双路召回 (Promise.allSettled 具备强容错能力)
    const [vectorSettled, esSettled] = await Promise.allSettled([
      this.vectorService.search(query, user, {
        topK: topKPerRoute,
        docCode: dto.docCode,
      }),
      this.openSearchService.search({
        query,
        limit: topKPerRoute,
        aclTags,
        docCode: dto.docCode,
      }),
    ])

    const vectorHits = vectorSettled.status === 'fulfilled' ? vectorSettled.value : []
    const esHits = esSettled.status === 'fulfilled' ? esSettled.value : []

    if (vectorSettled.status === 'rejected') {
      this.logger.warn(`[HybridSearch] 向量检索路降级: ${vectorSettled.reason?.message}`)
    }
    if (esSettled.status === 'rejected') {
      this.logger.warn(`[HybridSearch] ES 全文检索路降级: ${esSettled.reason?.message}`)
    }

    this.logger.debug(
      `[HybridSearch] 召回结果统计: query="${query}", 向量召回=${vectorHits.length}条, ES召回=${esHits.length}条`,
    )

    // 3. 构建候选切块 Map 并应用 RRF 融合打分
    const candidateMap = new Map<string, CandidateChunk>()

    // 3.1 累加向量路得分与名次
    vectorHits.forEach((hit, index) => {
      const chunkId = hit.id
      const rank = index + 1
      const docCode = hit.payload?.docCode
      if (!docCode)
        return

      const headingPath = Array.isArray(hit.payload?.headingPath)
        ? hit.payload.headingPath.join(' > ')
        : (hit.payload?.headingPath || '')

      candidateMap.set(chunkId, {
        chunkId,
        docCode,
        docId: hit.payload?.docId,
        chunkIndex: hit.payload?.chunkIndex ?? 0,
        title: hit.payload?.title || '',
        headingPath,
        content: hit.payload?.content || '',
        vectorRank: rank,
        vectorScore: hit.score,
        rrfScore: vectorWeight / (kConstant + rank),
        matchedSources: ['VECTOR'],
      })
    })

    // 3.2 累加 ES 全文检索路得分与名次
    esHits.forEach((hit, index) => {
      const chunkId = hit.id
      const rank = index + 1
      const docCode = hit.docCode
      if (!docCode)
        return

      const existing = candidateMap.get(chunkId)
      const esScoreContribution = esWeight / (kConstant + rank)

      if (existing) {
        existing.esRank = rank
        existing.esScore = hit.score
        existing.rrfScore += esScoreContribution
        if (!existing.matchedSources.includes('ES')) {
          existing.matchedSources.push('ES')
        }
        if (hit.highlights) {
          existing.highlights = hit.highlights
        }
      }
      else {
        candidateMap.set(chunkId, {
          chunkId,
          docCode,
          docId: hit.docId,
          chunkIndex: hit.chunkIndex ?? 0,
          title: hit.title || '',
          headingPath: hit.headingPath || '',
          content: hit.content || '',
          esRank: rank,
          esScore: hit.score,
          rrfScore: esScoreContribution,
          matchedSources: ['ES'],
          highlights: hit.highlights,
        })
      }
    })

    const initialCandidates = Array.from(candidateMap.values())
    if (initialCandidates.length === 0) {
      return { items: [], total: 0, costMs: Date.now() - startTime, query }
    }

    // 4. 执行二次精排 (Rerank)
    let rankedChunks: RerankedChunk[]
    if (enableRerank) {
      rankedChunks = await this.reranker.rerank(query, initialCandidates)
    }
    else {
      rankedChunks = initialCandidates
        .sort((a, b) => b.rrfScore - a.rrfScore)
        .map(c => ({
          ...c,
          rerankScore: c.rrfScore,
          finalScore: Number(Math.min(c.rrfScore * 30, 1.0).toFixed(4)),
        }))
    }

    // 5. 将切片按文档维度归集
    const docChunksMap = new Map<string, RerankedChunk[]>()
    for (const chunk of rankedChunks) {
      const list = docChunksMap.get(chunk.docCode) || []
      list.push(chunk)
      docChunksMap.set(chunk.docCode, list)
    }

    const hitDocCodes = Array.from(docChunksMap.keys())
    if (hitDocCodes.length === 0) {
      return { items: [], total: 0, costMs: Date.now() - startTime, query }
    }

    // 6. 批量从 MySQL 加载文档完整实体信息
    const docEntities = await this.docRepo.find({
      where: {
        docCode: In(hitDocCodes),
        deletedAt: IsNull(),
      },
    })

    // 7. 安全权限二次校验与分类过滤
    const authorizedDocs = docEntities.filter((doc) => {
      if (dto.category && doc.category !== dto.category) {
        return false
      }
      return this.permissionService.canAccessDocument(doc, user)
    })

    // 8. 计算文档级聚合相关性得分并组装结果
    const hitDocItems: HitDocumentDto[] = []

    for (const doc of authorizedDocs) {
      const chunks = docChunksMap.get(doc.docCode) || []
      if (!chunks.length)
        continue

      // 最高切片得分
      const bestChunkScore = chunks[0].finalScore

      // 聚合所有切片的召回通路标记
      const sourceSet = new Set<'VECTOR' | 'ES'>()
      for (const ch of chunks) {
        for (const src of ch.matchedSources) {
          sourceSet.add(src)
        }
      }

      // 文档级得分：最高切片得分 + 额外相关切片密度微量增益 (至多增益 15%)
      const densityBoost = Math.min((chunks.length - 1) * 0.05, 0.15)
      const docScore = Number(Math.min(bestChunkScore * (1 + densityBoost), 1.0).toFixed(4))

      // 转换为展示用的切块证据列表 (保留前 3 个最具代表性的切片)
      const topEvidenceChunks: HitDocumentChunkDto[] = chunks.slice(0, 3).map(ch => ({
        chunkId: ch.chunkId,
        chunkIndex: ch.chunkIndex,
        headingPath: ch.headingPath,
        content: ch.content,
        score: ch.finalScore ?? Number((ch.rrfScore * 30).toFixed(4)),
        rerankScore: ch.rerankScore ?? ch.finalScore,
        matchedSources: ch.matchedSources,
        highlights: ch.highlights,
      }))

      hitDocItems.push({
        docCode: doc.docCode,
        title: doc.title,
        category: doc.category,
        scope: doc.scope,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        fileType: doc.fileType,
        status: doc.status,
        publicUrl: doc.publicUrl,
        reviewScore: doc.reviewScore,
        score: docScore,
        matchedSources: Array.from(sourceSet),
        chunks: topEvidenceChunks,
      })
    }

    // 按文档综合得分降序排列
    hitDocItems.sort((a, b) => b.score - a.score)

    // 切片返回前 limit 条
    const pagedItems = hitDocItems.slice(0, limit)
    const costMs = Date.now() - startTime

    return {
      items: pagedItems,
      total: hitDocItems.length,
      costMs,
      query,
    }
  }
}


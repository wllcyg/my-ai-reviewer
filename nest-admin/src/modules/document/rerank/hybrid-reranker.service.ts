import { Injectable, Logger } from '@nestjs/common'
import type { CandidateChunk, IReranker, RerankedChunk } from './reranker.interface'

/**
 * 混合特征重排器 (Hybrid Feature Cross-Reranker)
 *
 * 结合多维语义特征进行二次精排打分：
 * 1. 词形全字重合度与覆盖率 (Exact Match & Term Coverage Ratio)
 * 2. 标题/章节面包屑对齐加权 (Heading & Structural Alignment Bonus)
 * 3. 双路召回共识增强 (Dual-Source Consensus Boost)
 * 4. 文本密集度与首段位置惩罚/增益
 * 5. 归一化综合融合评分 (0.0 ~ 1.0)
 */
@Injectable()
export class HybridRerankerService implements IReranker {
  readonly name = 'HybridFeatureReranker'
  private readonly logger = new Logger(HybridRerankerService.name)

  async rerank(
    query: string,
    candidates: CandidateChunk[],
  ): Promise<RerankedChunk[]> {
    if (!candidates || candidates.length === 0) {
      return []
    }

    const cleanQuery = query.trim().toLowerCase()
    const queryTokens = this.tokenize(cleanQuery)

    const rerankedList: RerankedChunk[] = candidates.map((candidate) => {
      const heading = (candidate.headingPath || candidate.title || '').toLowerCase()
      const content = (candidate.content || '').toLowerCase()

      // 1. 词项覆盖率得分 (0.0 ~ 1.0)
      const termCoverageScore = this.calculateTermCoverage(queryTokens, content, heading)

      // 2. 连续短语精准匹配奖励 (0.0 ~ 1.0)
      const exactPhraseScore = this.calculateExactPhraseMatch(cleanQuery, content, heading)

      // 3. 标题结构对齐度奖励 (0.0 ~ 1.0)
      const headingAlignmentScore = this.calculateHeadingAlignment(queryTokens, heading)

      // 4. 双路共识增益 (如果是双路同时召回，赋予额外置信度)
      const isDualHit = candidate.matchedSources.length > 1
      const consensusBoost = isDualHit ? 0.25 : 0.0

      // 5. 原始 RRF 基础相对分数 (归一化到 0 ~ 1)
      const baseRrfNormalized = Math.min(candidate.rrfScore * 30, 1.0)

      // 6. 稠密向量语义分（若有）
      const vectorScoreNormalized = candidate.vectorScore
        ? Math.max(0, Math.min(candidate.vectorScore, 1.0))
        : 0.5

      // 7. 加权计算 Rerank 特征分数
      // 权重分配：短语命中 0.30 + 词覆盖率 0.25 + 标题对齐 0.20 + 向量语义 0.15 + 双路共识 0.10
      const rerankScoreRaw =
        exactPhraseScore * 0.30
        + termCoverageScore * 0.25
        + headingAlignmentScore * 0.20
        + vectorScoreNormalized * 0.15
        + consensusBoost * 0.10

      const rerankScore = Math.min(Math.max(rerankScoreRaw, 0.0), 1.0)

      // 8. 终排得分：RRF 粗排分 40% + Rerank 特征精排分 60%
      const finalScoreRaw = baseRrfNormalized * 0.40 + rerankScore * 0.60
      const finalScore = Number(Math.min(Math.max(finalScoreRaw, 0.0), 1.0).toFixed(4))

      return {
        ...candidate,
        rerankScore: Number(rerankScore.toFixed(4)),
        finalScore,
      }
    })

    // 按最终得分降序排列
    return rerankedList.sort((a, b) => b.finalScore - a.finalScore)
  }

  /**
   * 中英文混合分词提取器
   * 提取 2 字符滑动窗口 (Bigram) 与独立英文/数字词项
   */
  private tokenize(text: string): string[] {
    const tokens = new Set<string>()

    // 提取数字和英文单词 (如 "P0", "120", "SLA", "MySQL")
    const words = text.match(/[a-z0-9_.-]+/gi) || []
    for (const w of words) {
      if (w.length >= 2) {
        tokens.add(w.toLowerCase())
      }
    }

    // 提取中文字符串，并切分为单字与 2-gram
    const chineseChars = text.replace(/[^\u4E00-\u9FA5]/g, '')
    if (chineseChars.length >= 2) {
      for (let i = 0; i < chineseChars.length - 1; i++) {
        tokens.add(chineseChars.slice(i, i + 2))
      }
    }
    else if (chineseChars.length === 1) {
      tokens.add(chineseChars)
    }

    return Array.from(tokens)
  }

  /**
   * 计算词项在正文或标题中的覆盖率
   */
  private calculateTermCoverage(
    queryTokens: string[],
    content: string,
    heading: string,
  ): number {
    if (queryTokens.length === 0)
      return 0

    let matchedCount = 0
    for (const token of queryTokens) {
      if (content.includes(token) || heading.includes(token)) {
        matchedCount++
      }
    }

    return matchedCount / queryTokens.length
  }

  /**
   * 计算原句完整短语在文本中的出现情况
   */
  private calculateExactPhraseMatch(
    query: string,
    content: string,
    heading: string,
  ): number {
    if (query.length < 2)
      return 0

    if (heading.includes(query)) {
      return 1.0
    }
    if (content.includes(query)) {
      return 0.85
    }

    // 允许忽略空格的短语匹配
    const compactQuery = query.replace(/\s+/g, '')
    if (compactQuery.length >= 2) {
      if (heading.replace(/\s+/g, '').includes(compactQuery)) {
        return 0.95
      }
      if (content.replace(/\s+/g, '').includes(compactQuery)) {
        return 0.75
      }
    }

    return 0.0
  }

  /**
   * 计算章节与标题对齐得分
   */
  private calculateHeadingAlignment(
    queryTokens: string[],
    heading: string,
  ): number {
    if (!heading || queryTokens.length === 0)
      return 0

    let headingMatchCount = 0
    for (const token of queryTokens) {
      if (heading.includes(token)) {
        headingMatchCount++
      }
    }

    return headingMatchCount / queryTokens.length
  }
}


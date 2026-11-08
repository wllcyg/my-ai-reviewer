import { Inject, Injectable, Logger } from '@nestjs/common'
import axios, { AxiosInstance } from 'axios'
import { IVectorConfig, VectorConfig } from '~/config/vector.config'
import { HybridRerankerService } from './hybrid-reranker.service'
import type { CandidateChunk, IReranker, RerankedChunk } from './reranker.interface'

/**
 * 神经网络重排模型服务 (Neural Cross-Encoder Reranker)
 *
 * 支持主流 Cross-Encoder 重排协议：
 * 1. Cloudflare Workers AI (`@cf/baai/bge-reranker-base`, `@cf/baai/bge-reranker-large`)
 * 2. 通用 `/v1/rerank` 协议 (SiliconFlow / Jina / BGE / DashScope / Cohere / Xinference / vLLM)
 * 3. 熔断与优雅降级：在未配置 API Key、网络抖动或超时时自动回退到本地 HybridFeatureReranker
 */
@Injectable()
export class ModelRerankerService implements IReranker {
  readonly name = 'CrossEncoderModelReranker'
  private readonly logger = new Logger(ModelRerankerService.name)
  private readonly httpClient: AxiosInstance

  private readonly apiKey: string
  private readonly model: string
  private readonly baseUrl: string
  private readonly provider: string
  private readonly isCloudflare: boolean

  constructor(
    @Inject(VectorConfig.KEY)
    private readonly config: IVectorConfig,
    private readonly fallbackReranker: HybridRerankerService,
  ) {
    this.apiKey = config.rerankApiKey || config.apiToken || ''
    this.model = config.rerankModel || '@cf/baai/bge-reranker-base'
    this.provider = config.rerankProvider || (this.apiKey ? 'model' : 'local')

    // 自动判定是否为 Cloudflare Workers AI 端点
    this.isCloudflare =
      this.model.startsWith('@cf/')
      || (config.rerankBaseUrl && config.rerankBaseUrl.includes('cloudflare.com'))
      || (!config.rerankBaseUrl && Boolean(config.accountId))

    if (config.rerankBaseUrl) {
      this.baseUrl = config.rerankBaseUrl
    }
    else if (this.isCloudflare && config.accountId) {
      this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${this.model}`
    }
    else {
      this.baseUrl = ''
    }

    this.httpClient = axios.create({
      timeout: 6000, // 6s 超时熔断保护，防止检索阻塞
    })

    if (!this.apiKey || this.provider === 'local') {
      this.logger.log(`[ModelReranker] 未配置重排模型 API Key，已启用本地启发式混合特征重排`)
    }
    else {
      this.logger.log(
        `[ModelReranker] ✅ 成功装配神经网络重排模型: provider=${this.provider}, model=${this.model}, endpoint=${this.baseUrl}`,
      )
    }
  }

  async rerank(
    query: string,
    candidates: CandidateChunk[],
  ): Promise<RerankedChunk[]> {
    if (!candidates || candidates.length === 0) {
      return []
    }

    // 若未配置模型或显式指定 local，直接走本地高质量特征重排
    if (!this.apiKey || this.provider === 'local' || !this.baseUrl) {
      return this.fallbackReranker.rerank(query, candidates)
    }

    try {
      return await this.callModelRerank(query, candidates)
    }
    catch (error: any) {
      this.logger.warn(
        `[ModelReranker] ⚠️ 神经重排模型调用异常 (${error.message})，自动平滑降级至本地混合特征重排`,
      )
      return this.fallbackReranker.rerank(query, candidates)
    }
  }

  /**
   * 调用远端神经网络 Cross-Encoder 重排服务
   */
  private async callModelRerank(
    query: string,
    candidates: CandidateChunk[],
  ): Promise<RerankedChunk[]> {
    // 组装带上下文面包屑的候选切块文本
    const documents = candidates.map((c) => {
      if (c.headingPath) {
        return `[章节大纲: ${c.headingPath}]\n${c.content}`
      }
      return c.content
    })

    const scores: number[] = new Array(candidates.length).fill(0)

    if (this.isCloudflare) {
      // Cloudflare Workers AI 协议格式: { query, contexts: [{ text: ... }] }
      const payload = {
        query,
        contexts: documents.map(doc => ({ text: doc })),
      }

      const response = await this.httpClient.post(this.baseUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      let rawResults = response.data?.result
      if (!Array.isArray(rawResults)) {
        if (Array.isArray(response.data?.result?.results)) {
          rawResults = response.data.result.results
        }
        else if (Array.isArray(response.data?.results)) {
          rawResults = response.data.results
        }
        else {
          rawResults = []
        }
      }

      for (const item of rawResults) {
        const idx = typeof item.id === 'number' ? item.id : Number.parseInt(item.id, 10)
        if (!Number.isNaN(idx) && idx >= 0 && idx < candidates.length) {
          scores[idx] = this.normalizeScore(item.score)
        }
      }
    }
    else {
      // 标准 /v1/rerank 协议格式 (SiliconFlow, Jina, DashScope, BGE)
      const payload = {
        model: this.model,
        query,
        documents,
        top_n: candidates.length,
      }

      const response = await this.httpClient.post(this.baseUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      let rawResults = response.data?.results || response.data?.data || []
      if (!Array.isArray(rawResults)) {
        rawResults = []
      }

      for (const item of rawResults) {
        const idx = item.index ?? item.document_index
        const score = item.relevance_score ?? item.score ?? 0
        if (typeof idx === 'number' && idx >= 0 && idx < candidates.length) {
          scores[idx] = this.normalizeScore(score)
        }
      }
    }

    // 组装最终重排结果
    const rerankedList: RerankedChunk[] = candidates.map((candidate, i) => {
      const modelScore = scores[i]
      const baseRrfNormalized = Math.min(candidate.rrfScore * 30, 1.0)

      // 综合终排分数：模型语义相关度 70% + RRF 位次融合分 30%
      const finalScore = Number(
        Math.min(baseRrfNormalized * 0.30 + modelScore * 0.70, 1.0).toFixed(4),
      )

      return {
        ...candidate,
        rerankScore: Number(modelScore.toFixed(4)),
        finalScore,
      }
    })

    return rerankedList.sort((a, b) => b.finalScore - a.finalScore)
  }

  /**
   * 将 Cross-Encoder 模型输出的分数归一化至 [0.0, 1.0]
   * 兼容两类输出：
   * 1. 已经是概率或余弦值 [0, 1]
   * 2. Logits 原始未截断分（如 -10 到 +10），采用 Sigmoid 激活函数映射
   */
  private normalizeScore(score: number): number {
    if (typeof score !== 'number' || Number.isNaN(score)) {
      return 0
    }
    // 若已经在 [0, 1] 之间，直接返回
    if (score >= 0 && score <= 1) {
      return score
    }
    // 若为未归一化的 Logits 实数，应用标准 Sigmoid 函数: 1 / (1 + e^(-x))
    return 1 / (1 + Math.exp(-score))
  }
}


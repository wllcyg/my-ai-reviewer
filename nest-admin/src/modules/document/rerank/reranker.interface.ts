/**
 * 候选切块数据结构（进入 Rerank 阶段前）
 */
export interface CandidateChunk {
  chunkId: string
  docCode: string
  docId?: number
  chunkIndex: number
  title: string
  headingPath: string
  content: string
  vectorRank?: number
  vectorScore?: number
  esRank?: number
  esScore?: number
  /** RRF 融合分数 */
  rrfScore: number
  matchedSources: ('VECTOR' | 'ES')[]
  highlights?: {
    title?: string[]
    headingPath?: string[]
    content?: string[]
  }
}

/**
 * Rerank 重排完成后的切块数据结构
 */
export interface RerankedChunk extends CandidateChunk {
  /** Rerank 独立打分 (0.0 ~ 1.0) */
  rerankScore: number
  /** 最终综合相关性得分 (0.0 ~ 1.0) */
  finalScore: number
}

/**
 * Reranker 重排器统一接口契约
 */
export interface IReranker {
  readonly name: string

  /**
   * 对候选切片根据 Query 执行重排序打分
   * @param query 用户检索查询词
   * @param candidates 粗排/RRF 融合后的候选切片列表
   * @returns 排序并重新赋分后的切片列表
   */
  rerank(query: string, candidates: CandidateChunk[]): Promise<RerankedChunk[]>
}


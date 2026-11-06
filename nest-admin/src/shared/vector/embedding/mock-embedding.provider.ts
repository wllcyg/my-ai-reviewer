import { Injectable, Logger, Optional } from '@nestjs/common'
import { DEFAULT_VECTOR_DIMENSION } from '../vector.constant'
import { IEmbeddingProvider } from '../vector.interface'

/**
 * 本地确定性降级 / 单元测试嵌入提供者
 * 算法：基于文本字符哈希生成固定维度归一化向量，无需外网或 API 凭据
 */
@Injectable()
export class MockEmbeddingProvider implements IEmbeddingProvider {
  readonly providerName = 'mock'
  readonly dimension: number

  private readonly logger = new Logger(MockEmbeddingProvider.name)

  constructor(
    @Optional()
    dimension?: number,
  ) {
    this.dimension = typeof dimension === 'number' ? dimension : DEFAULT_VECTOR_DIMENSION
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts.length)
      return []

    return texts.map(text => this.embedSingle(text))
  }

  private embedSingle(text: string): number[] {
    const vec = new Array(this.dimension).fill(0)
    if (!text)
      return vec

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      const slot = (code * 31 + i) % this.dimension
      vec[slot] += (code % 100) / 100
    }

    // L2 归一化，保证向量模长为 1，满足余弦相似度计算标准
    let sumSq = 0
    for (let i = 0; i < this.dimension; i++) {
      sumSq += vec[i] * vec[i]
    }
    const norm = Math.sqrt(sumSq) || 1

    return vec.map(v => Number((v / norm).toFixed(6)))
  }
}


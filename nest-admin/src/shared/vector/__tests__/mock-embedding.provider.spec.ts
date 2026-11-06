import { MockEmbeddingProvider } from '../embedding/mock-embedding.provider'

describe('MockEmbeddingProvider', () => {
  let provider: MockEmbeddingProvider

  beforeEach(() => {
    provider = new MockEmbeddingProvider(1024)
  })

  it('向量维度应为指定的 1024', () => {
    expect(provider.dimension).toBe(1024)
    expect(provider.providerName).toBe('mock')
  })

  it('空文本列表应返回空数组', async () => {
    const result = await provider.generateEmbeddings([])
    expect(result).toEqual([])
  })

  it('相同文本多次向量化必定产出完全一致的结果 (确定性)', async () => {
    const text = '员工出差与报销管理办法'
    const [vec1] = await provider.generateEmbeddings([text])
    const [vec2] = await provider.generateEmbeddings([text])

    expect(vec1.length).toBe(1024)
    expect(vec2.length).toBe(1024)
    expect(vec1).toEqual(vec2)
  })

  it('向量模长应接近 1.0 (L2 归一化特性)', async () => {
    const [vec] = await provider.generateEmbeddings(['企业级知识库 RAG 向量检索'])
    const sumSq = vec.reduce((sum, v) => sum + v * v, 0)
    const norm = Math.sqrt(sumSq)

    expect(norm).toBeGreaterThan(0.99)
    expect(norm).toBeLessThan(1.01)
  })
})


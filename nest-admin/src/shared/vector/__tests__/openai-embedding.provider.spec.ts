import { MockEmbeddingProvider } from '../embedding/mock-embedding.provider'
import { OpenAiEmbeddingProvider } from '../embedding/openai-embedding.provider'

describe('OpenAiEmbeddingProvider', () => {
  let mockFallback: MockEmbeddingProvider

  beforeEach(() => {
    mockFallback = new MockEmbeddingProvider(1024)
  })

  it('未配置凭据时应自动优雅降级为 Mock', async () => {
    const provider = new OpenAiEmbeddingProvider(
      {
        accountId: '',
        apiToken: '',
        baseUrl: '',
        embeddingModel: '@cf/baai/bge-m3',
        embeddingDimension: 1024,
        vectorizeIndex: 'word-embeddings',
        embeddingProvider: 'openai',
        vectorStoreProvider: 'memory',
        rerankApiKey: '',
        rerankModel: '',
        rerankBaseUrl: '',
        rerankProvider: 'local',
        chatModel: '',
        chatApiKey: '',
        chatBaseUrl: '',
      },
      mockFallback,
    )

    expect(provider.providerName).toBe('openai')
    expect(provider.dimension).toBe(1024)

    const result = await provider.generateEmbeddings(['测试降级向量生成'])
    expect(result.length).toBe(1)
    expect(result[0].length).toBe(1024)
  })

  it('传入空数组直接返回空', async () => {
    const provider = new OpenAiEmbeddingProvider(
      {
        accountId: '',
        apiToken: '',
        baseUrl: '',
        embeddingModel: '@cf/baai/bge-m3',
        embeddingDimension: 1024,
        vectorizeIndex: 'word-embeddings',
        embeddingProvider: 'openai',
        vectorStoreProvider: 'memory',
        rerankApiKey: '',
        rerankModel: '',
        rerankBaseUrl: '',
        rerankProvider: 'local',
        chatModel: '',
        chatApiKey: '',
        chatBaseUrl: '',
      },
      mockFallback,
    )

    const result = await provider.generateEmbeddings([])
    expect(result).toEqual([])
  })
})


import axios from 'axios'
import { HybridRerankerService } from '../hybrid-reranker.service'
import { ModelRerankerService } from '../model-reranker.service'
import type { CandidateChunk } from '../reranker.interface'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('ModelRerankerService', () => {
  let fallbackReranker: HybridRerankerService
  let candidates: CandidateChunk[]

  beforeEach(() => {
    fallbackReranker = new HybridRerankerService()
    candidates = [
      {
        chunkId: 'doc1_0',
        docCode: 'doc1',
        chunkIndex: 0,
        title: '差旅规范',
        headingPath: '第1章',
        content: '差旅基本原则',
        rrfScore: 0.015,
        matchedSources: ['VECTOR'],
      },
      {
        chunkId: 'doc1_1',
        docCode: 'doc1',
        chunkIndex: 1,
        title: '差旅规范',
        headingPath: '第2章 > 房费',
        content: '一类城市房费标准为每天500元',
        rrfScore: 0.014,
        matchedSources: ['ES'],
      },
    ]
  })

  it('未配置 API Key 时应自动降级至本地混合特征重排', async () => {
    const service = new ModelRerankerService(
      {
        accountId: '',
        apiToken: '',
        baseUrl: '',
        embeddingModel: '',
        embeddingDimension: 1024,
        vectorizeIndex: '',
        embeddingProvider: 'mock',
        vectorStoreProvider: 'memory',
        rerankApiKey: '',
        rerankModel: '',
        rerankBaseUrl: '',
        rerankProvider: 'local',
        chatModel: '',
      },
      fallbackReranker,
    )

    const result = await service.rerank('房费标准 500元', candidates)
    expect(result.length).toBe(2)
    expect(result[0].chunkId).toBe('doc1_1')
    expect(result[0].rerankScore).toBeGreaterThan(0)
  })

  it('Cloudflare Workers AI 重排成功时应返回模型计算的高精分数', async () => {
    const mockPost = jest.fn().mockResolvedValue({
      data: {
        result: [
          { id: 0, score: 0.12 },
          { id: 1, score: 0.95 },
        ],
        success: true,
      },
    })
    mockedAxios.create.mockReturnValue({
      post: mockPost,
    } as any)

    const service = new ModelRerankerService(
      {
        accountId: 'test_account_123',
        apiToken: 'test_token',
        baseUrl: '',
        embeddingModel: '',
        embeddingDimension: 1024,
        vectorizeIndex: '',
        embeddingProvider: 'cloudflare',
        vectorStoreProvider: 'vectorize',
        rerankApiKey: 'test_token',
        rerankModel: '@cf/baai/bge-reranker-base',
        rerankBaseUrl: '',
        rerankProvider: 'model',
        chatModel: '',
      },
      fallbackReranker,
    )

    const result = await service.rerank('房费 500元', candidates)

    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(result.length).toBe(2)
    expect(result[0].chunkId).toBe('doc1_1')
    expect(result[0].rerankScore).toBe(0.95)
    expect(result[0].finalScore).toBeGreaterThan(result[1].finalScore)
  })

  it('模型接口网络异常超时时，应优雅熔断降级至本地特征重排，保证不抛出异常', async () => {
    const mockPost = jest.fn().mockRejectedValue(new Error('Cloudflare network timeout'))
    mockedAxios.create.mockReturnValue({
      post: mockPost,
    } as any)

    const service = new ModelRerankerService(
      {
        accountId: 'test_account_123',
        apiToken: 'test_token',
        baseUrl: '',
        embeddingModel: '',
        embeddingDimension: 1024,
        vectorizeIndex: '',
        embeddingProvider: 'cloudflare',
        vectorStoreProvider: 'vectorize',
        rerankApiKey: 'test_token',
        rerankModel: '@cf/baai/bge-reranker-base',
        rerankBaseUrl: '',
        rerankProvider: 'model',
        chatModel: '',
      },
      fallbackReranker,
    )

    // 不应抛出异常，而是优雅降级
    const result = await service.rerank('房费 500元', candidates)

    expect(result.length).toBe(2)
    expect(result[0].chunkId).toBe('doc1_1')
    expect(result[0].finalScore).toBeGreaterThan(0)
  })
})


import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { OpenSearchService } from '~/shared/opensearch/opensearch.service'
import { VectorService } from '~/shared/vector/vector.service'
import { DocumentScopeEnum, DocumentStatusEnum } from '../document.constant'
import { DocumentEntity } from '../document.entity'
import { HybridRerankerService } from '../rerank/hybrid-reranker.service'
import { ModelRerankerService } from '../rerank/model-reranker.service'
import { DocumentPermissionService } from './document-permission.service'
import { HybridSearchService } from './hybrid-search.service'

describe('HybridSearchService', () => {
  let service: HybridSearchService
  let mockDocRepo: Partial<Record<keyof Repository<DocumentEntity>, jest.Mock>>
  let mockVectorService: Partial<Record<keyof VectorService, jest.Mock>>
  let mockOpenSearchService: Partial<Record<keyof OpenSearchService, jest.Mock>>
  let mockPermissionService: Partial<Record<keyof DocumentPermissionService, jest.Mock>>
  let reranker: ModelRerankerService

  const mockUser: IAuthUser = {
    uid: 1,
    roles: ['user'],
    deptId: 10,
  } as any

  beforeEach(async () => {
    mockDocRepo = {
      find: jest.fn(),
    }

    mockVectorService = {
      buildUserAclTags: jest.fn().mockReturnValue(['public', 'user:1', 'dept:10']),
      search: jest.fn().mockResolvedValue([]),
    }

    mockOpenSearchService = {
      search: jest.fn().mockResolvedValue([]),
    }

    mockPermissionService = {
      isAdmin: jest.fn().mockReturnValue(false),
      canAccessDocument: jest.fn().mockReturnValue(true),
    }

    const localReranker = new HybridRerankerService()
    reranker = new ModelRerankerService(
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
        chatApiKey: '',
        chatBaseUrl: '',
        chatModel: '',
      },
      localReranker,
    )

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HybridSearchService,
        {
          provide: getRepositoryToken(DocumentEntity),
          useValue: mockDocRepo,
        },
        {
          provide: VectorService,
          useValue: mockVectorService,
        },
        {
          provide: OpenSearchService,
          useValue: mockOpenSearchService,
        },
        {
          provide: DocumentPermissionService,
          useValue: mockPermissionService,
        },
        {
          provide: ModelRerankerService,
          useValue: reranker,
        },
      ],
    }).compile()

    service = module.get<HybridSearchService>(HybridSearchService)
  })

  it('空查询词应快速返回空结果', async () => {
    const result = await service.search({ query: '' }, mockUser)
    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
    expect(mockVectorService.search).not.toHaveBeenCalled()
  })

  it('双路均命中切块时，应正确计算 RRF、Rerank 并聚合成文档级返回', async () => {
    // 向量路命中切块 doc_A_0
    mockVectorService.search = jest.fn().mockResolvedValue([
      {
        id: 'doc_A_0',
        score: 0.88,
        payload: {
          docCode: 'doc_A',
          chunkIndex: 0,
          title: '企业差旅规范',
          headingPath: ['第一章', '房费报销限额'],
          content: '一类城市住宿标准为每天500元，凭发票实报实销。',
        },
      },
    ])

    // ES 路命中切块 doc_A_0 和 doc_B_0
    mockOpenSearchService.search = jest.fn().mockResolvedValue([
      {
        id: 'doc_A_0',
        score: 12.5,
        docCode: 'doc_A',
        chunkIndex: 0,
        title: '企业差旅规范',
        headingPath: '第一章 > 房费报销限额',
        content: '一类城市住宿标准为每天500元，凭发票实报实销。',
        highlights: {
          content: ['一类城市<em>住宿标准</em>为每天500元'],
        },
      },
      {
        id: 'doc_B_0',
        score: 8.2,
        docCode: 'doc_B',
        chunkIndex: 0,
        title: '考勤作息细则',
        headingPath: '第二章 > 考勤规定',
        content: '员工因公外出须提前在OA系统发起外出申请。',
      },
    ])

    // Mock 数据库文档实体
    mockDocRepo.find = jest.fn().mockResolvedValue([
      {
        docCode: 'doc_A',
        title: '企业差旅规范',
        category: '财务制度',
        scope: DocumentScopeEnum.PUBLIC,
        fileName: 'travel.md',
        fileSize: 1024,
        fileType: 'md',
        status: DocumentStatusEnum.PUBLISHED,
        publicUrl: 'https://cdn.example.com/travel.md',
      },
      {
        docCode: 'doc_B',
        title: '考勤作息细则',
        category: '行政制度',
        scope: DocumentScopeEnum.PUBLIC,
        fileName: 'attendance.md',
        fileSize: 2048,
        fileType: 'md',
        status: DocumentStatusEnum.PUBLISHED,
        publicUrl: 'https://cdn.example.com/attendance.md',
      },
    ])

    const result = await service.search({ query: '住宿标准 500元' }, mockUser)

    expect(result.items.length).toBe(2)
    // doc_A 双路命中且关键词精准匹配，得分应第一
    expect(result.items[0].docCode).toBe('doc_A')
    expect(result.items[0].matchedSources).toContain('VECTOR')
    expect(result.items[0].matchedSources).toContain('ES')
    expect(result.items[0].chunks[0].highlights?.content).toBeDefined()
    expect(result.items[0].score).toBeGreaterThan(result.items[1].score)
  })

  it('单路服务发生异常时，应具备容错降级能力，不中断检索', async () => {
    // 向量路异常拒绝
    mockVectorService.search = jest.fn().mockRejectedValue(new Error('Vectorize network timeout'))

    // ES 路正常返回
    mockOpenSearchService.search = jest.fn().mockResolvedValue([
      {
        id: 'doc_A_0',
        score: 10.0,
        docCode: 'doc_A',
        chunkIndex: 0,
        title: '数据安全保护规范',
        headingPath: '第四章 > P0漏洞响应',
        content: '发生P0级安全事件时，安全应急响应团队必须在15分钟内响应。',
      },
    ])

    mockDocRepo.find = jest.fn().mockResolvedValue([
      {
        docCode: 'doc_A',
        title: '数据安全保护规范',
        category: '安全合规',
        scope: DocumentScopeEnum.PUBLIC,
        fileName: 'security.md',
        fileSize: 5000,
        fileType: 'md',
        status: DocumentStatusEnum.PUBLISHED,
      },
    ])

    const result = await service.search({ query: 'P0 15分钟' }, mockUser)

    expect(result.items.length).toBe(1)
    expect(result.items[0].docCode).toBe('doc_A')
    expect(result.items[0].matchedSources).toEqual(['ES'])
  })

  it('权限不合规的文档应被安全过滤剔除', async () => {
    mockVectorService.search = jest.fn().mockResolvedValue([
      {
        id: 'doc_secret_0',
        score: 0.95,
        payload: {
          docCode: 'doc_secret',
          chunkIndex: 0,
          title: '高管绝密薪酬',
          headingPath: ['薪资'],
          content: '核心机密内容',
        },
      },
    ])

    mockDocRepo.find = jest.fn().mockResolvedValue([
      {
        docCode: 'doc_secret',
        title: '高管绝密薪酬',
        category: '保密',
        scope: DocumentScopeEnum.PRIVATE,
        status: DocumentStatusEnum.PUBLISHED,
      },
    ])

    // 用户无权访问该绝密文档
    mockPermissionService.canAccessDocument = jest.fn().mockReturnValue(false)

    const result = await service.search({ query: '薪酬' }, mockUser)
    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
  })
})

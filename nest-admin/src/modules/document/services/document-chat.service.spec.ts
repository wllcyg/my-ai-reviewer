import { PassThrough } from 'node:stream'
import { Test, TestingModule } from '@nestjs/testing'
import { VectorConfig } from '~/config/vector.config'
import { DocumentChatService } from './document-chat.service'
import { HybridSearchService } from './hybrid-search.service'

jest.mock('ai', () => ({
  createUIMessageStream: jest.fn(({ execute, onFinish }) => {
    return { execute, onFinish }
  }),
  pipeUIMessageStreamToResponse: jest.fn(async ({ response, stream }) => {
    const mockWriter = {
      write: jest.fn((chunk) => {
        response.write(JSON.stringify(chunk) + '\n')
      }),
      merge: jest.fn(),
    }
    if (stream && stream.execute) {
      await stream.execute({ writer: mockWriter })
    }
    if (stream && stream.onFinish) {
      await stream.onFinish({
        responseMessage: { parts: [{ type: 'text', text: '完成回答' }] },
      })
    }
    response.end?.()
  }),
}))

jest.mock('@ai-sdk/langchain', () => ({
  toUIMessageStream: jest.fn(() => ({})),
}))

describe('DocumentChatService', () => {
  let service: DocumentChatService
  let mockHybridSearchService: Partial<Record<keyof HybridSearchService, jest.Mock>>

  const mockUser: IAuthUser = {
    uid: 1,
    roles: ['user'],
    deptId: 10,
  } as any

  beforeEach(async () => {
    delete process.env.DEEPSEEK_API_KEY
    mockHybridSearchService = {
      search: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        costMs: 10,
        query: 'test',
      }),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentChatService,
        {
          provide: HybridSearchService,
          useValue: mockHybridSearchService,
        },
        {
          provide: VectorConfig.KEY,
          useValue: {
            accountId: '',
            apiToken: '',
            chatModel: '@cf/meta/llama-3.1-8b-instruct',
            chatApiKey: '',
            chatBaseUrl: '',
          },
        },
      ],
    }).compile()

    service = module.get<DocumentChatService>(DocumentChatService)
  })

  it('检索未命中任何文档时，应礼貌提示并不抛出异常', async () => {
    mockHybridSearchService.search = jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      costMs: 5,
      query: '未知的火星规章',
    })

    const result = await service.chat({ query: '未知的火星规章' }, mockUser)

    expect(result.citations).toEqual([])
    expect(result.answer).toContain('未检索到')
  })

  it('命中切块但在离线/无Token环境时，应优雅降级为本地合成回答并携带完整溯源出处', async () => {
    mockHybridSearchService.search = jest.fn().mockResolvedValue({
      items: [
        {
          docCode: 'doc_travel',
          title: '集团差旅报销制度',
          chunks: [
            {
              chunkId: 'doc_travel_1',
              chunkIndex: 1,
              headingPath: '第三章 > 3.2 房费标准',
              content: '一类城市住宿标准为每天 500 元。',
              score: 0.95,
              rerankScore: 0.92,
            },
          ],
        },
      ],
      total: 1,
      costMs: 15,
      query: '房费标准',
    })

    const result = await service.chat({ query: '房费标准' }, mockUser)

    expect(result.citations.length).toBe(1)
    expect(result.citations[0].docCode).toBe('doc_travel')
    expect(result.citations[0].headingPath).toBe('第三章 > 3.2 房费标准')
    expect(result.answer).toContain('集团差旅报销制度')
    expect(result.answer).toContain('500 元')
  })

  it('成功构建标准的 LangChain DynamicStructuredTool 工具对象', async () => {
    const tool = service.createSearchTool(mockUser)
    expect(tool.name).toBe('search_enterprise_knowledge')
    expect(tool.description).toContain('检索企业内部规章制度')

    mockHybridSearchService.search = jest.fn().mockResolvedValue({
      items: [{ docCode: 'doc_tool_test', title: '测试文档' }],
      total: 1,
    })

    const toolResult = await tool.invoke({ query: '住宿限额' })
    expect(toolResult).toContain('doc_tool_test')
  })

  it('streamChat 流式问答应正确写入 UI Stream 事件帧', async () => {
    mockHybridSearchService.search = jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      costMs: 5,
      query: '测试流式问题',
    })

    const chunks: string[] = []
    const mockRes: any = new PassThrough()
    mockRes.writeHead = jest.fn()
    mockRes.flushHeaders = jest.fn()
    mockRes.on('data', (d: Buffer) => chunks.push(d.toString()))

    await service.streamChat({ query: '测试流式问题' }, mockUser, mockRes)
    const output = chunks.join('')
    expect(output).toContain('start')
    expect(output).toContain('retrieve')
  })
})



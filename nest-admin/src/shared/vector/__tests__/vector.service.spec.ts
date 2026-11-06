import { MockEmbeddingProvider } from '../embedding/mock-embedding.provider'
import { MemoryVectorStore } from '../store/memory-vector.store'
import { VectorService } from '../vector.service'

describe('VectorService', () => {
  let service: VectorService
  let embeddingProvider: MockEmbeddingProvider
  let vectorStore: MemoryVectorStore

  beforeEach(() => {
    embeddingProvider = new MockEmbeddingProvider(128)
    vectorStore = new MemoryVectorStore()
    service = new VectorService(embeddingProvider, vectorStore)
  })

  describe('权限标签生成 (buildDocAclTags & buildUserAclTags)', () => {
    it('公开文档 (PUBLIC) 生成 public 与创建者所有权标签', () => {
      const tags = service.buildDocAclTags('PUBLIC', [], 10)
      expect(tags).toContain('public')
      expect(tags).toContain('user:10')
    })

    it('部门文档 (DEPT) 正确包含所有指定部门 ID 与创建者', () => {
      const tags = service.buildDocAclTags('DEPT', [101, 102], 10)
      expect(tags).toContain('dept:101')
      expect(tags).toContain('dept:102')
      expect(tags).toContain('user:10')
      expect(tags).not.toContain('public')
    })

    it('私密文档 (PRIVATE) 仅包含创建者标签', () => {
      const tags = service.buildDocAclTags('PRIVATE', [], 10)
      expect(tags).toEqual(['user:10'])
    })

    it('用户身份标签应包含 public、个人 UID 与部门祖先链', () => {
      const user: IAuthUser = { uid: 8, deptId: 7 } as any
      const deptAncestors = [1, 3] // 公司(1) -> 技术部(3) -> 后端组(7)
      const userTags = service.buildUserAclTags(user, deptAncestors)

      expect(userTags).toContain('public')
      expect(userTags).toContain('user:8')
      expect(userTags).toContain('dept:7')
      expect(userTags).toContain('dept:1')
      expect(userTags).toContain('dept:3')
    })
  })

  describe('文档切块完整入库 (indexDocumentChunks)', () => {
    it('成功转换切块为向量点并写入底层存储', async () => {
      const mockChunks = [
        {
          id: '1-0',
          content: '第一章 正文',
          embeddingText: '# 第一章 > 正文',
          metadata: {
            docId: 1,
            docCode: 'doc_test',
            title: '测试文档',
            chunkIndex: 0,
            headingPath: ['第一章'],
            charCount: 10,
          } as any,
        },
        {
          id: '1-1',
          content: '第二章 正文',
          embeddingText: '# 第二章 > 正文',
          metadata: {
            docId: 1,
            docCode: 'doc_test',
            title: '测试文档',
            chunkIndex: 1,
            headingPath: ['第二章'],
            charCount: 10,
          } as any,
        },
      ]

      const result = await service.indexDocumentChunks({
        docCode: 'doc_test',
        docId: 1,
        title: '测试文档',
        scope: 'PUBLIC',
        chunks: mockChunks,
        createBy: 5,
      })

      expect(result.chunkCount).toBe(2)
      expect(result.costMs).toBeGreaterThanOrEqual(0)
      expect(vectorStore.size()).toBe(2)
    })
  })

  describe('检索接口封装 (search)', () => {
    it('执行端到端语义检索并返回匹配结果', async () => {
      // 预先写入两个测试切块
      await service.indexDocumentChunks({
        docCode: 'doc_travel',
        docId: 100,
        title: '员工出差与报销管理办法',
        scope: 'PUBLIC',
        chunks: [
          {
            id: '100-0',
            content: '出差住宿补贴标准：一线城市每晚不超过500元。',
            embeddingText: '# 报销管理 > 住宿标准：一线城市每晚不超过500元。',
            metadata: { chunkIndex: 0, headingPath: ['报销管理'] } as any,
          },
        ],
      })

      const normalUser: IAuthUser = { uid: 99, deptId: 2, roles: ['common_user'] } as any
      const searchResults = await service.search('出差住宿补贴多少钱', normalUser, { topK: 3 })

      expect(searchResults.length).toBe(1)
      expect(searchResults[0].payload.docCode).toBe('doc_travel')
      expect(searchResults[0].payload.content).toContain('500元')
    })
  })
})


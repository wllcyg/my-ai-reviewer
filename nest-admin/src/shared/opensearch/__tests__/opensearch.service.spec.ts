import { MockOpenSearchStore } from '../store/mock-opensearch.store'
import { OpenSearchService } from '../opensearch.service'
import type { Chunk } from '~/modules/document/splitter/markdown-splitter.interface'

describe('OpenSearchService', () => {
  let service: OpenSearchService
  let mockStore: MockOpenSearchStore

  beforeEach(() => {
    mockStore = new MockOpenSearchStore()
    service = new OpenSearchService(mockStore)
  })

  describe('ACL Tags Building', () => {
    it('should build public tags', () => {
      const tags = service.buildDocAclTags('PUBLIC')
      expect(tags).toEqual(['public'])
    })

    it('should build dept tags', () => {
      const tags = service.buildDocAclTags('DEPT', [10, 20], 5)
      expect(tags).toContain('dept:10')
      expect(tags).toContain('dept:20')
      expect(tags).toContain('user:5')
    })

    it('should build private tags', () => {
      const tags = service.buildDocAclTags('PRIVATE', [], 8)
      expect(tags).toEqual(['user:8'])
    })

    it('should build user access tags with ancestor depts', () => {
      const user = { uid: 99, deptId: 10 } as any
      const userTags = service.buildUserAclTags(user, [1, 5])
      expect(userTags).toContain('public')
      expect(userTags).toContain('user:99')
      expect(userTags).toContain('dept:10')
      expect(userTags).toContain('dept:1')
      expect(userTags).toContain('dept:5')
    })
  })

  describe('indexDocumentChunks', () => {
    it('should index chunks with aligned IDs and search correctly', async () => {
      const chunks: Chunk[] = [
        {
          id: 'chunk-1',
          content: '本节介绍 Elasticsearch 倒排索引原理。',
          embeddingText: 'ES原理 本节介绍 Elasticsearch 倒排索引原理。',
          metadata: {
            chunkIndex: 0,
            headingPath: ['第一章 搜索引擎', '1.1 倒排索引'],
            charCount: 25,
            docId: 100,
            docCode: 'doc_es_1',
            title: '搜索引擎原理',
            category: 'tech',
            fileName: 'es.md',
            fileType: 'md',
            scope: 'PUBLIC',
            visibleDeptIds: [],
            sectionIndex: 0,
            prevId: null,
            nextId: null,
            contentHash: 'hash1',
            chunkHash: 'hash2',
          },
        },
      ]

      const res = await service.indexDocumentChunks({
        docCode: 'doc_es_1',
        docId: 100,
        title: '搜索引擎原理',
        scope: 'PUBLIC',
        chunks,
      })

      expect(res.chunkCount).toBe(1)
      expect(res.costMs).toBeGreaterThanOrEqual(0)

      const searchRes = await service.search({
        query: '倒排索引',
      })
      expect(searchRes.length).toBe(1)
      expect(searchRes[0].id).toBe('doc_es_1_0')
      expect(searchRes[0].headingPath).toBe('第一章 搜索引擎 > 1.1 倒排索引')
    })
  })
})


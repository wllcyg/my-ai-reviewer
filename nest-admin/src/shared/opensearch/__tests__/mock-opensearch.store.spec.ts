import { MockOpenSearchStore } from '../store/mock-opensearch.store'
import type { OpenSearchChunkDocument } from '../opensearch.interface'

describe('MockOpenSearchStore', () => {
  let store: MockOpenSearchStore

  beforeEach(() => {
    store = new MockOpenSearchStore()
  })

  it('should ping successfully', async () => {
    expect(await store.ping()).toBe(true)
  })

  it('should bulk index documents and search with keyword matching', async () => {
    const docs: OpenSearchChunkDocument[] = [
      {
        id: 'doc_1_0',
        docCode: 'doc_1',
        docId: 1,
        chunkIndex: 0,
        title: '知识库架构设计规范',
        headingPath: '第一章 架构总览',
        content: '知识库采用 OpenSearch 作为全文检索引擎，提供 BM25 关键词检索。',
        tokens: 30,
        scope: 'PUBLIC',
        acl_tags: ['public'],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'doc_1_1',
        docCode: 'doc_1',
        docId: 1,
        chunkIndex: 1,
        title: '知识库架构设计规范',
        headingPath: '第二章 向量检索',
        content: '向量数据库采用 Cloudflare Vectorize，支持 1024 维度的稠密向量比对。',
        tokens: 35,
        scope: 'DEPT',
        acl_tags: ['dept:10'],
        createdAt: new Date().toISOString(),
      },
    ]

    await store.bulkIndex(docs)

    // 1. 关键词命中
    const res1 = await store.search({
      query: 'OpenSearch',
      limit: 5,
    })
    expect(res1.length).toBe(1)
    expect(res1[0].id).toBe('doc_1_0')
    expect(res1[0].docCode).toBe('doc_1')

    // 2. ACL 过滤 - 无权限访问 dept:10
    const res2 = await store.search({
      query: 'Vectorize',
      aclTags: ['public'],
    })
    expect(res2.length).toBe(0)

    // 3. ACL 过滤 - 带 dept:10 权限
    const res3 = await store.search({
      query: 'Vectorize',
      aclTags: ['public', 'dept:10'],
    })
    expect(res3.length).toBe(1)
    expect(res3[0].id).toBe('doc_1_1')
  })

  it('should delete documents by docCode', async () => {
    const docs: OpenSearchChunkDocument[] = [
      {
        id: 'doc_del_0',
        docCode: 'doc_del',
        docId: 2,
        chunkIndex: 0,
        title: '待删除文档',
        content: '测试删除',
        scope: 'PUBLIC',
        acl_tags: ['public'],
        createdAt: new Date().toISOString(),
      },
    ]

    await store.bulkIndex(docs)
    const countBefore = await store.search({ query: '删除' })
    expect(countBefore.length).toBe(1)

    const deleted = await store.deleteByDocCode('doc_del')
    expect(deleted).toBe(1)

    const countAfter = await store.search({ query: '删除' })
    expect(countAfter.length).toBe(0)
  })
})


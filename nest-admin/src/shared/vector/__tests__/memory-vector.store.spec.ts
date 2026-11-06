import { MemoryVectorStore } from '../store/memory-vector.store'
import { VectorPoint } from '../vector.interface'

describe('MemoryVectorStore', () => {
  let store: MemoryVectorStore

  beforeEach(() => {
    store = new MemoryVectorStore()
  })

  it('批量 upsert 写入并支持按 ID 覆盖', async () => {
    const point1: VectorPoint = {
      id: 'doc_1_0',
      vector: [1, 0, 0],
      payload: {
        docCode: 'doc_1',
        docId: 1,
        title: '文档一',
        chunkIndex: 0,
        headingPath: [],
        content: '内容一',
        scope: 'PUBLIC',
        visibleDeptIds: [],
        acl_tags: ['public'],
      },
    }

    await store.upsert([point1])
    expect(store.size()).toBe(1)

    // 覆盖更新相同 ID
    const updatedPoint1 = { ...point1, vector: [0, 1, 0] }
    await store.upsert([updatedPoint1])
    expect(store.size()).toBe(1)
  })

  it('按 docCode 删除特定文档关联的所有向量', async () => {
    const points: VectorPoint[] = [
      {
        id: 'doc_a_0',
        vector: [1, 0],
        payload: { docCode: 'doc_a' } as any,
      },
      {
        id: 'doc_a_1',
        vector: [0, 1],
        payload: { docCode: 'doc_a' } as any,
      },
      {
        id: 'doc_b_0',
        vector: [1, 1],
        payload: { docCode: 'doc_b' } as any,
      },
    ]

    await store.upsert(points)
    expect(store.size()).toBe(3)

    await store.deleteByDocCode('doc_a')
    expect(store.size()).toBe(1)
  })

  it('相似度检索应严格执行 acl_tags 权限交集过滤', async () => {
    const publicPoint: VectorPoint = {
      id: 'p1',
      vector: [1, 0, 0],
      payload: {
        docCode: 'd1',
        title: '公开文档',
        acl_tags: ['public', 'user:1'],
      } as any,
    }

    const deptPoint: VectorPoint = {
      id: 'p2',
      vector: [0.9, 0.1, 0],
      payload: {
        docCode: 'd2',
        title: '技术部绝密文档',
        acl_tags: ['dept:101', 'user:1'],
      } as any,
    }

    await store.upsert([publicPoint, deptPoint])

    // 用户 A：仅拥有 public 标签
    const resultsUserA = await store.search([1, 0, 0], {
      topK: 10,
      filter: { acl_tags: ['public', 'user:99'] },
    })
    expect(resultsUserA.length).toBe(1)
    expect(resultsUserA[0].id).toBe('p1')

    // 用户 B：属于技术部 dept:101
    const resultsUserB = await store.search([1, 0, 0], {
      topK: 10,
      filter: { acl_tags: ['public', 'dept:101', 'user:88'] },
    })
    expect(resultsUserB.length).toBe(2)
  })
})


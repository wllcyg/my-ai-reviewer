import { HybridRerankerService } from '../hybrid-reranker.service'
import type { CandidateChunk } from '../reranker.interface'

describe('HybridRerankerService', () => {
  let reranker: HybridRerankerService

  beforeEach(() => {
    reranker = new HybridRerankerService()
  })

  it('空候选列表应返回空数组', async () => {
    const result = await reranker.rerank('差旅标准', [])
    expect(result).toEqual([])
  })

  it('精准匹配完整短语与包含关键词的切片应排在前面', async () => {
    const candidates: CandidateChunk[] = [
      {
        chunkId: 'doc1_0',
        docCode: 'doc1',
        chunkIndex: 0,
        title: '差旅报销管理制度',
        headingPath: '第一章 > 总则',
        content: '本制度为了规范员工的差旅支出行为，强化成本意识。',
        rrfScore: 0.016,
        matchedSources: ['VECTOR'],
      },
      {
        chunkId: 'doc1_1',
        docCode: 'doc1',
        chunkIndex: 1,
        title: '差旅报销管理制度',
        headingPath: '第三章 > 3.2 房费与住宿报销标准',
        content: '一类城市（北京、上海、深圳）住宿限额为每人每天 500 元标准。',
        rrfScore: 0.015,
        matchedSources: ['ES', 'VECTOR'],
      },
      {
        chunkId: 'doc2_0',
        docCode: 'doc2',
        chunkIndex: 0,
        title: '代码发布规范',
        headingPath: '第二章 > 发布流程',
        content: '所有微服务在灰度发布阶段，应按照 5% 到 20% 比例进行流量切分。',
        rrfScore: 0.014,
        matchedSources: ['ES'],
      },
    ]

    const result = await reranker.rerank('住宿报销标准', candidates)

    expect(result.length).toBe(3)
    // 第二个切块命中标题短语 "住宿报销标准" 且为双路召回，得分应最高并排第一
    expect(result[0].chunkId).toBe('doc1_1')
    expect(result[0].finalScore).toBeGreaterThan(result[1].finalScore)
    expect(result[0].finalScore).toBeGreaterThan(result[2].finalScore)
    expect(result[0].rerankScore).toBeGreaterThan(0.5)
  })

  it('双路共识命中的切块应获得共识增强分', async () => {
    const candidates: CandidateChunk[] = [
      {
        chunkId: 'chunk_single',
        docCode: 'doc1',
        chunkIndex: 0,
        title: '安全制度',
        headingPath: '第1章',
        content: '数据安全保护规范',
        rrfScore: 0.015,
        matchedSources: ['VECTOR'],
      },
      {
        chunkId: 'chunk_dual',
        docCode: 'doc1',
        chunkIndex: 1,
        title: '安全制度',
        headingPath: '第1章',
        content: '数据安全保护规范',
        rrfScore: 0.015,
        matchedSources: ['VECTOR', 'ES'],
      },
    ]

    const result = await reranker.rerank('数据安全', candidates)
    expect(result[0].chunkId).toBe('chunk_dual')
    expect(result[0].finalScore).toBeGreaterThan(result[1].finalScore)
  })
})


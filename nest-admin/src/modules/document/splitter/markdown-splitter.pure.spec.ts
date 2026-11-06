import {
  type DocumentInputMeta,
  DEFAULT_SPLITTER_CONFIG,
} from './markdown-splitter.interface'
import { splitMarkdownDocument } from './markdown-splitter.pure'

describe('MarkdownSplitterPure (RAG 切块纯函数单元测试)', () => {
  const baseDocMeta: DocumentInputMeta = {
    docId: 1001,
    docCode: 'doc_test_1001',
    title: '知识库工程规范',
    category: '技术规范',
    fileName: 'standard.md',
    fileType: 'md',
    scope: 'PUBLIC',
    visibleDeptIds: [101, 102],
  }

  it('1. 边界情况：空文档或仅含空白时，不产出任何 chunk，返回空数组', async () => {
    const res1 = await splitMarkdownDocument('', baseDocMeta)
    const res2 = await splitMarkdownDocument('   \n\n\t  ', baseDocMeta)
    const res3 = await splitMarkdownDocument('---\ntitle: 空文档\n---\n', baseDocMeta)

    expect(res1).toEqual([])
    expect(res2).toEqual([])
    expect(res3).toEqual([])
  })

  it('2. 边界情况：无任何标题的文档，整体作为单一章节处理，生成完整的 metadata 与链表', async () => {
    const text = '这是一篇没有使用任何 Markdown 标题标记的文章。它只有纯正文，讨论软件工程的演进历程与架构沉淀。'
    const chunks = await splitMarkdownDocument(text, baseDocMeta)

    expect(chunks.length).toBe(1)
    expect(chunks[0].id).toBe('1001-0')
    expect(chunks[0].metadata.headingPath).toEqual(['知识库工程规范'])
    expect(chunks[0].metadata.prevId).toBeNull()
    expect(chunks[0].metadata.nextId).toBeNull()
    expect(chunks[0].embeddingText).toContain('知识库工程规范\n\n')
  })

  it('3. 边界情况：代码块内的 "#" 注释绝对不能被误识别为章节标题', async () => {
    const text = `
# 第一章 开发入门

以下是 TypeScript 代码示例：

\`\`\`typescript
// 这是代码注释
# 这里的井号是 Python 或 Shell 的注释，绝对不能当成 Markdown 标题
def add(a, b):
    return a + b
\`\`\`

代码块后的一段总结说明文字。
`.trim()

    const chunks = await splitMarkdownDocument(text, baseDocMeta)

    // 代码块内的 '#' 不会切断章节
    expect(chunks.length).toBe(1)
    expect(chunks[0].metadata.headingPath).toEqual(['第一章 开发入门'])
    expect(chunks[0].content).toContain('# 这里的井号是 Python 或 Shell 的注释')
    expect(chunks[0].content).toContain('```typescript')
  })

  it('4. 边界情况：标题层级跳跃 (# 直接跳到 ###)，标题栈能够正常压入，不报错', async () => {
    const text = `
# 一级大纲

大纲前言介绍说明。

### 三级跳跃小节

直接跳过了二级标题，这里是三级小节的正文详细阐述，字数足够多以避免被过短合并逻辑触发。这里补充一些细节内容，确保满足最低长度阈值。
`.trim()

    const chunks = await splitMarkdownDocument(text, baseDocMeta, { minChunkSize: 20 })

    expect(chunks.length).toBeGreaterThanOrEqual(2)
    // 第二个小节的 headingPath 应按实际出现的层级记录
    const subChunk = chunks.find(c => c.content.includes('三级跳跃小节'))
    expect(subChunk).toBeDefined()
    expect(subChunk?.metadata.headingPath).toEqual(['一级大纲', '三级跳跃小节'])
  })

  it('5. 边界情况：超长代码块或表格，不被强行切断，标记 oversized: true', async () => {
    const longCodeLines = Array.from({ length: 60 }, (_, i) => `  const line_${i} = "data_payload_${i}";`).join('\n')
    const oversizedCodeBlock = `\`\`\`typescript\n${longCodeLines}\n\`\`\``

    const text = `
# 附录 代码速查表

${oversizedCodeBlock}
`.trim()

    const chunks = await splitMarkdownDocument(text, baseDocMeta, {
      maxChunkSize: 400, // 设小以触发超长判断
    })

    const codeChunk = chunks.find(c => c.content.includes('data_payload_0'))
    expect(codeChunk).toBeDefined()
    expect(codeChunk?.metadata.oversized).toBe(true)
    // 必须完整包含首尾围栏标记，未被中间腰斩
    expect(codeChunk?.content.startsWith('# 附录 代码速查表') || codeChunk?.content.startsWith('```')).toBeTruthy()
    expect(codeChunk?.content.endsWith('```')).toBeTruthy()
  })

  it('6. 边界情况：标题重复（同名章节），靠 chunkIndex 与全局 id 唯一区分', async () => {
    const text = `
# 模块 A
### 使用说明
模块 A 的使用步骤与注意细节。这一段内容编写得相对充实完整。

# 模块 B
### 使用说明
模块 B 的使用步骤与注意细节。这一段内容同样编写得相对充实完整。
`.trim()

    const chunks = await splitMarkdownDocument(text, baseDocMeta, { minChunkSize: 10 })

    expect(chunks.length).toBeGreaterThanOrEqual(2)
    const ids = chunks.map(c => c.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(chunks.length) // 全局 id 绝对唯一
    expect(chunks[0].id).toBe('1001-0')
    expect(chunks[1].id).toBe('1001-1')
  })

  it('7. 边界情况：保留 HTML 标签与 Markdown 图片链接的 alt 文本', async () => {
    const text = `
# 架构拓扑

<div class="note">请仔细阅读以下图解</div>

![系统架构拓扑图说明](https://cdn.example.com/arch.png)

架构包含接入网关与核心微服务集群。
`.trim()

    const chunks = await splitMarkdownDocument(text, baseDocMeta)

    expect(chunks.length).toBe(1)
    expect(chunks[0].content).toContain('<div class="note">')
    expect(chunks[0].content).toContain('![系统架构拓扑图说明](https://cdn.example.com/arch.png)')
  })

  it('8. 幂等性与链表完整性校验：相同输入必定得到完全一致的输出，且双向链表首尾为 null 中间连续', async () => {
    const text = `
# 第一章 系统设计
这是关于系统设计的初始章节，主要介绍微服务架构与单体架构的选择权衡。

## 1.1 模块拆分
详细说明文档模块、审批模块、权限模块的拆分策略。

## 1.2 异步消息
介绍 RabbitMQ 消息总线的设计方案，包含交换机与死信队列的配置说明。
`.trim()

    const run1 = await splitMarkdownDocument(text, baseDocMeta, { minChunkSize: 10 })
    const run2 = await splitMarkdownDocument(text, baseDocMeta, { minChunkSize: 10 })

    // 幂等性：严格相等
    expect(run1).toEqual(run2)

    // 链表指针校验
    expect(run1.length).toBeGreaterThan(1)
    expect(run1[0].metadata.prevId).toBeNull()
    expect(run1[run1.length - 1].metadata.nextId).toBeNull()

    for (let i = 0; i < run1.length - 1; i++) {
      expect(run1[i].metadata.nextId).toBe(run1[i + 1].id)
      expect(run1[i + 1].metadata.prevId).toBe(run1[i].id)
    }
  })

  it('9. 过长章节二次切分：超过 maxChunkSize 时调用 RecursiveCharacterTextSplitter 切分并带 sectionIndex', async () => {
    // 构造一段超长中文文本 (> 900 字)
    const paragraphs = Array.from({ length: 15 }, (_, i) =>
      `【第${i + 1}段】在分布式系统研发中，数据一致性与可用性的权衡是极其关键的工程考量。通过引入消息总线与异步重试机制，能够有效降低主链路延迟，提升服务吞吐。`,
    ).join('\n\n')

    const longText = `# 超长综合论述\n\n${paragraphs}`

    const chunks = await splitMarkdownDocument(longText, baseDocMeta, {
      maxChunkSize: 500,
      chunkSize: 400,
      chunkOverlap: 50,
    })

    expect(chunks.length).toBeGreaterThan(1)
    // 属于同一章节的子块，继承相同的 headingPath
    chunks.forEach((chunk, idx) => {
      expect(chunk.metadata.headingPath).toEqual(['超长综合论述'])
      expect(chunk.metadata.sectionIndex).toBe(idx)
      expect(chunk.embeddingText.startsWith('知识库工程规范 > 超长综合论述\n\n')).toBe(true)
    })
  })
})


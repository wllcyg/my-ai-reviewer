import * as crypto from 'node:crypto'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import {
  type Chunk,
  DEFAULT_SPLITTER_CONFIG,
  type DocumentInputMeta,
  type MarkdownSplitterConfig,
} from './markdown-splitter.interface'

interface ProtectedBlock {
  placeholder: string
  raw: string
  isOversized: boolean
}

interface RawSection {
  headingPath: string[]
  content: string
  isOversized?: boolean
}

/**
 * 计算字符串的 SHA-256 哈希值
 */
function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex')
}

/**
 * 保护特殊块（围栏代码块与 Markdown 表格），防止被标题正则误匹配或二次切分切断
 */
function protectSpecialBlocks(
  text: string,
  maxChunkSize: number,
): { protectedText: string; blocks: Map<string, ProtectedBlock> } {
  const blocks = new Map<string, ProtectedBlock>()
  let counter = 0

  // 1. 保护围栏代码块 (``` 或 ~~~)
  const codeBlockRegex = /(?:```[\s\S]*?```|~~~[\s\S]*?~~~)/g
  let protectedText = text.replace(codeBlockRegex, (match) => {
    const placeholder = `<<<PROTECTED_CODE_BLOCK_${counter++}>>>`
    blocks.set(placeholder, {
      placeholder,
      raw: match,
      isOversized: match.length > maxChunkSize,
    })
    return `\n\n${placeholder}\n\n`
  })

  // 2. 保护 Markdown 表格 (至少包含表头行与分割行如 |---|---|)
  const tableRegex = /(?:^[ \t]*\|.+?\|[ \t]*\n[ \t]*\|(?:[-: ]+\|)+[ \t]*(?:\n[ \t]*\|.+?\|[ \t]*)*)/gm
  protectedText = protectedText.replace(tableRegex, (match) => {
    const placeholder = `<<<PROTECTED_TABLE_BLOCK_${counter++}>>>`
    blocks.set(placeholder, {
      placeholder,
      raw: match,
      isOversized: match.length > maxChunkSize,
    })
    return `\n\n${placeholder}\n\n`
  })

  return { protectedText, blocks }
}

/**
 * 还原占位符为原始代码块或表格
 */
function restoreSpecialBlocks(
  text: string,
  blocks: Map<string, ProtectedBlock>,
): string {
  let restored = text
  for (const [placeholder, block] of blocks.entries()) {
    if (restored.includes(placeholder)) {
      restored = restored.split(placeholder).join(block.raw)
    }
  }
  return restored
}

/**
 * 按标题层级 (# ~ ###) 切分 Markdown 章节，并维护层级路径栈
 */
function splitByHeadings(
  text: string,
  docTitle: string,
  maxHeadingLevel: number,
): RawSection[] {
  const lines = text.split('\n')
  const sections: RawSection[] = []

  // 标题栈：记录当前深度与标题文本
  const headingStack: { level: number; title: string }[] = []
  let currentLines: string[] = []

  const flushCurrentSection = () => {
    const sectionContent = currentLines.join('\n').trim()
    if (sectionContent) {
      const headingPath = headingStack.length > 0
        ? headingStack.map(h => h.title)
        : [docTitle || '正文']
      sections.push({
        headingPath: [...headingPath],
        content: sectionContent,
      })
    }
    currentLines = []
  }

  // 动态构造匹配 1 ~ maxHeadingLevel 级标题的正则
  const headingRegex = new RegExp(`^(#{1,${maxHeadingLevel}})\\s+(.+)$`)

  for (const line of lines) {
    const match = line.trim().match(headingRegex)
    if (match) {
      // 遇到新标题行，先结束当前章节
      flushCurrentSection()

      const level = match[1].length
      const title = match[2].trim()

      // 维护标题栈：遇到当前级别，弹出所有同级或更深层级
      while (
        headingStack.length > 0
        && headingStack[headingStack.length - 1].level >= level
      ) {
        headingStack.pop()
      }
      headingStack.push({ level, title })

      // 标题行本身保留在正文开头
      currentLines.push(line)
    }
    else {
      currentLines.push(line)
    }
  }

  // 刷出最后一个章节
  flushCurrentSection()

  return sections
}

/**
 * 阶段四：合并过短章节 (< minChunkSize)
 * 条件：必须在同一父标题路径下，且合并后不超过 maxChunkSize
 */
function mergeShortSections(
  sections: RawSection[],
  minChunkSize: number,
  maxChunkSize: number,
): RawSection[] {
  if (sections.length <= 1) {
    return sections
  }

  const merged: RawSection[] = []

  for (let i = 0; i < sections.length; i++) {
    const current = sections[i]

    // 若当前章节过短，尝试向同一父路径下的前一个章节合并
    if (current.content.length < minChunkSize && merged.length > 0) {
      const prev = merged[merged.length - 1]
      const prevParent = prev.headingPath.slice(0, -1).join(' > ')
      const currParent = current.headingPath.slice(0, -1).join(' > ')

      // 只有父级路径一致且合并后不超长，才允许合并
      if (
        prevParent === currParent
        && prev.content.length + current.content.length + 2 <= maxChunkSize
      ) {
        prev.content = `${prev.content}\n\n${current.content}`
        // 若两个章节不同子标题合并，headingPath 回退为父标题路径
        if (prevParent) {
          prev.headingPath = current.headingPath.slice(0, -1)
        }
        continue
      }
    }

    merged.push({ ...current })
  }

  return merged
}

/**
 * 核心纯函数：将 Markdown 文本切分为生产级 RAG 检索 Chunk[]
 *
 * @param content Markdown 文本原文
 * @param docMeta 文档元数据（来源于 doc_documents 表）
 * @param userConfig 自定义切块参数（可选）
 */
export async function splitMarkdownDocument(
  content: string,
  docMeta: DocumentInputMeta,
  userConfig?: MarkdownSplitterConfig,
): Promise<Chunk[]> {
  const config = { ...DEFAULT_SPLITTER_CONFIG, ...userConfig }

  // 1. 预处理
  let normalized = (content || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  // 剥离 front-matter (--- ... ---)
  normalized = normalized.replace(/^---[\s\S]*?---\n?/m, '').trim()

  // 连续 3 个以上换行压缩为 1 个空行 (即 \n\n)
  normalized = normalized.replace(/\n{3,}/g, '\n\n')

  // 计算全文 SHA-256 哈希
  const contentHash = sha256(normalized)

  // 边界检查：若去除空白后无实际正文内容，直接返回空
  if (!normalized) {
    return []
  }

  const defaultTitle = docMeta.title || docMeta.fileName || '文档正文'

  // 2. 保护特殊块（围栏代码块、表格）
  const { protectedText, blocks } = protectSpecialBlocks(
    normalized,
    config.maxChunkSize,
  )

  // 3. 按标题层级切分
  const rawSections = splitByHeadings(
    protectedText,
    defaultTitle,
    config.headingLevels,
  )

  // 4. 合并过短章节 (同一父标题下)
  const mergedSections = mergeShortSections(
    rawSections,
    config.minChunkSize,
    config.maxChunkSize,
  )

  // 5. 过长章节二次切分 (使用 RecursiveCharacterTextSplitter)
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
    separators: config.separators,
  })

  interface ProcessedPiece {
    headingPath: string[]
    content: string
    sectionIndex: number
    oversized: boolean
  }

  const finalPieces: ProcessedPiece[] = []

  for (const section of mergedSections) {
    // 还原当前章节文本，用于评估真实字数与 oversized 状态
    const restoredText = restoreSpecialBlocks(section.content, blocks).trim()
    if (!restoredText) {
      continue
    }

    // 判断该章节是否由单个超长代码块/表格组成
    let isSingleOversizedBlock = false
    for (const block of blocks.values()) {
      if (block.isOversized && section.content.includes(block.placeholder)) {
        isSingleOversizedBlock = true
        break
      }
    }

    // 若章节超长且非受保护的超长大块，采用 RecursiveCharacterTextSplitter 进行二次细切
    if (restoredText.length > config.maxChunkSize && !isSingleOversizedBlock) {
      const subTexts = await textSplitter.splitText(restoredText)
      subTexts.forEach((sub, idx) => {
        const trimmed = sub.trim()
        if (trimmed) {
          finalPieces.push({
            headingPath: section.headingPath,
            content: trimmed,
            sectionIndex: idx,
            oversized: false,
          })
        }
      })
    }
    else {
      finalPieces.push({
        headingPath: section.headingPath,
        content: restoredText,
        sectionIndex: 0,
        oversized: isSingleOversizedBlock || restoredText.length > config.maxChunkSize,
      })
    }
  }

  // 6. 构造输出数据结构与前后相邻双向指针链表 (prevId / nextId)
  const total = finalPieces.length
  const chunks: Chunk[] = []

  for (let i = 0; i < total; i++) {
    const piece = finalPieces[i]
    const chunkId = `${docMeta.docId}-${i}`
    const prevId = i === 0 ? null : `${docMeta.docId}-${i - 1}`
    const nextId = i === total - 1 ? null : `${docMeta.docId}-${i + 1}`

    // 格式化 embeddingText 标题路径前缀：{title} > {h1} > {h2}
    const pathNodes = [docMeta.title, ...piece.headingPath]
      .filter(Boolean)
      .filter((item, idx, arr) => idx === 0 || item !== arr[idx - 1]) // 消除相邻重复标题节点
    const breadcrumb = pathNodes.join(' > ')

    const embeddingText = config.includeTitleInEmbedding && breadcrumb
      ? `${breadcrumb}\n\n${piece.content}`
      : piece.content

    chunks.push({
      id: chunkId,
      content: piece.content,
      embeddingText,
      metadata: {
        docId: docMeta.docId,
        docCode: docMeta.docCode,
        title: docMeta.title,
        category: docMeta.category || '通用',
        fileName: docMeta.fileName || '',
        fileType: docMeta.fileType || 'md',
        scope: docMeta.scope || 'PUBLIC',
        visibleDeptIds: docMeta.visibleDeptIds || [],
        headingPath: piece.headingPath,
        chunkIndex: i,
        sectionIndex: piece.sectionIndex,
        prevId,
        nextId,
        charCount: piece.content.length,
        oversized: piece.oversized ? true : undefined,
        contentHash,
        chunkHash: sha256(piece.content),
      },
    })
  }

  return chunks
}


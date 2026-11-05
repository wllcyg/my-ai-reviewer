import path from 'node:path'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { IDocParser } from '../parser.interface'

/**
 * 纯文本 (.txt) 与 原生 Markdown (.md) 解析策略
 * 特性：
 * 1. 自动嗅探 UTF-16 / GBK / UTF-8 编码，彻底解决 Windows 记事本中文乱码
 * 2. 区分 .md 与 .txt：.md 保持原汁原味，.txt 自动进行排版保真与轻量结构化
 * 3. 智能段落规整，避免 CommonMark 换行塌陷
 */
@Injectable()
export class TextParserStrategy implements IDocParser {
  private readonly logger = new Logger(TextParserStrategy.name)
  readonly supportedExtensions = ['.txt', '.md', '.markdown']

  async parse(buffer: Buffer, filename?: string): Promise<string> {
    // 1. 智能编码识别与解码（BOM 检测 → UTF-8 → GBK 兜底）
    // Fix Bug1: BOM 剥离与编码检测统一在 decodeBuffer 内部处理，避免 UTF-16 乱码
    const rawText = this.decodeBuffer(buffer)

    // 2. 统一全文本换行符，规范化空白字符
    // Fix Bug1: BOM 已在 decodeBuffer 内剥离，此处只做换行符规范化
    const normalizedText = rawText
      .replace(/\r\n/g, '\n') // 统一 Windows 换行符
      .replace(/\r/g, '\n')

    // 3. 如果原本就是 Markdown 文件，原样保留其既有语法结构
    const isMarkdown = filename && /\.(?:md|markdown)$/i.test(filename)
    if (isMarkdown) {
      return normalizedText.trim()
    }

    // Fix Bug6: 防御空文件——在注入文件名标题之前检测，避免下游 RAG / LLM 收到无意义内容
    if (!normalizedText.trim()) {
      throw new BadRequestException('文件内容为空，无法解析')
    }

    // 4. 针对纯 TXT 进行结构化与排版保真增强
    return this.formatTxtToMarkdown(normalizedText, filename)
  }

  /**
   * 字符编码自适应解码：支持 UTF-16 LE/BE BOM、UTF-8 BOM、GBK，零外部依赖
   * Fix Bug1: 统一在此处完成 BOM 检测与剥离，覆盖 UTF-16 LE/BE 场景
   */
  private decodeBuffer(buffer: Buffer): string {
    // 检测 UTF-16 LE BOM (FF FE)
    if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
      this.logger.debug('检测到 UTF-16 LE BOM，使用 utf-16le 解码')
      return new TextDecoder('utf-16le').decode(buffer).replace(/^\uFEFF/, '')
    }

    // 检测 UTF-16 BE BOM (FE FF)
    if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
      this.logger.debug('检测到 UTF-16 BE BOM，使用 utf-16be 解码')
      return new TextDecoder('utf-16be').decode(buffer).replace(/^\uFEFF/, '')
    }

    try {
      // 启用 fatal 模式：一旦遇到非法的 UTF-8 字节序，立即抛出 TypeError，从而触发 GBK 兜底
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
      // UTF-8 BOM (EF BB BF) 在此处剥离，位置更准确
      return utf8Decoder.decode(buffer).replace(/^\uFEFF/, '')
    }
    catch {
      this.logger.debug('检测到非标准 UTF-8 文本流，自动切换为 GBK 编码解码')
      return new TextDecoder('gbk').decode(buffer)
    }
  }

  /**
   * 将 TXT 格式化为适合渲染与 RAG 的标准化 Markdown
   */
  private formatTxtToMarkdown(text: string, filename?: string): string {
    const lines = text.split('\n')
    const resultLines: string[] = []

    // (1) 提取干净的主标题（若原文本首行没有 Markdown 标题，自动补充文件名作为大标题）
    if (filename) {
      const cleanTitle = path.basename(filename, path.extname(filename)).trim()
      const firstNonEmpty = lines.find(l => l.trim().length > 0) || ''
      // Fix Bug3: 使用 .trim().startsWith('#') 避免前置缩进导致漏判、重复注入标题
      if (!firstNonEmpty.trim().startsWith('#')) {
        resultLines.push(`# ${cleanTitle}\n`)
      }
    }

    // (2) 常见中文与数字章节模式正则：如 "第一章"、"一、"、"1.1"、"【xxx】"
    // Fix Bug4: level1Pattern 限定常见枚举字（一二三…十），避免任意中文+顿号误识别
    const level1Pattern = /^(?:第[一二三四五六七八九十百0-9]+[章节卷篇部]|[一二三四五六七八九十][、.])\s*[\u4E00-\u9FA5A-Za-z].{0,48}$/
    // Fix Bug2: level2Pattern 末尾改为 \d+（至少 1 位），且限制行长，避免金额/小数误识为标题
    const level2Pattern = /^(?:(?:\d+\.){1,2}\d+|（[一二三四五六七八九十0-9]+）)\s*[\u4E00-\u9FA5A-Za-z].{0,48}$/
    const bracketHeaderPattern = /^【([^】]+)】(.*)$/

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i]
      const trimmed = rawLine.trim()

      if (!trimmed) {
        // 空行直接保留
        resultLines.push('')
        continue
      }

      // 若已经自带 Markdown 标题语法 (# xxx)，直接原样保留
      if (/^#{1,6}\s/.test(trimmed)) {
        resultLines.push(trimmed)
        continue
      }

      // 启发式标题增强：识别类似 "第一章 概述" 或 "一、制度总则"
      if (level1Pattern.test(trimmed)) {
        resultLines.push(`## ${trimmed}`)
        continue
      }

      // 启发式标题增强：识别类似 "1.1 报销流程" 或 "（一）基本原则"
      if (level2Pattern.test(trimmed)) {
        resultLines.push(`### ${trimmed}`)
        continue
      }

      // 启发式标题增强：识别类似 "【重要提示】请在出差前报备"
      const bracketMatch = trimmed.match(bracketHeaderPattern)
      if (bracketMatch) {
        const tag = bracketMatch[1]
        const rest = bracketMatch[2].trim()
        resultLines.push(`### 【${tag}】`)
        if (rest) {
          resultLines.push(`${rest}  `)
        }
        continue
      }

      // Fix Bug5: 普通段落使用 trimmed 而非 rawLine，避免 ≥4 空格前缀意外触发 Markdown 代码块
      // 若原行有前置缩进且缩进 ≥ 4 空格，视为预格式内容，包裹为代码块行
      if (rawLine.match(/^ {4,}/)) {
        resultLines.push(`    ${trimmed}`)
      }
      else {
        // 普通段落：行末追加两个空格触发 Markdown 硬换行，保持排版保真
        resultLines.push(`${trimmed}  `)
      }
    }

    return resultLines.join('\n').trim()
  }
}


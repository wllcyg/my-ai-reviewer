import path from 'node:path'
import { Injectable, Logger } from '@nestjs/common'
import { IDocParser } from '../parser.interface'

/**
 * 纯文本 (.txt) 与 原生 Markdown (.md) 解析策略
 * 特性：
 * 1. 自动嗅探 GBK / UTF-8 编码，彻底解决 Windows 记事本中文乱码
 * 2. 区分 .md 与 .txt：.md 保持原汁原味，.txt 自动进行排版保真与轻量结构化
 * 3. 智能段落规整，避免 CommonMark 换行塌陷
 */
@Injectable()
export class TextParserStrategy implements IDocParser {
  private readonly logger = new Logger(TextParserStrategy.name)
  readonly supportedExtensions = ['.txt', '.md', '.markdown']

  async parse(buffer: Buffer, filename?: string): Promise<string> {
    // 1. 智能编码识别与解码（优先 UTF-8，遇错回退到 GBK）
    const rawText = this.decodeBuffer(buffer)

    // 2. 统一全文本换行符，规范化空白字符
    const normalizedText = rawText
      .replace(/^\uFEFF/, '') // 剥离 UTF-8 BOM
      .replace(/\r\n/g, '\n') // 统一 Windows 换行符
      .replace(/\r/g, '\n')

    // 3. 如果原本就是 Markdown 文件，原样保留其既有语法结构
    const isMarkdown = filename && /\.(?:md|markdown)$/i.test(filename)
    if (isMarkdown) {
      return normalizedText.trim()
    }

    // 4. 针对纯 TXT 进行结构化与排版保真增强
    return this.formatTxtToMarkdown(normalizedText, filename)
  }

  /**
   * 字符编码自适应解码：利用 Node 原生 TextDecoder 零依赖实现 GBK/UTF-8 识别
   */
  private decodeBuffer(buffer: Buffer): string {
    try {
      // 启用 fatal 模式：一旦遇到非法的 UTF-8 字节序，立即抛出 TypeError，从而触发 GBK 兜底
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true })
      return utf8Decoder.decode(buffer)
    }
    catch {
      this.logger.debug('检测到非标准 UTF-8 文本流，自动切换为 GBK 编码解码')
      const gbkDecoder = new TextDecoder('gbk')
      return gbkDecoder.decode(buffer)
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
      if (!firstNonEmpty.startsWith('#')) {
        resultLines.push(`# ${cleanTitle}\n`)
      }
    }

    // (2) 常见中文与数字章节模式正则：如 "第一章"、"一、"、"1.1"、"【xxx】"
    const level1Pattern = /^(?:第[一二三四五六七八九十百0-9]+[章节卷篇部]|[\u4E00-\u9FA5]{1,2}、)\s*(.*)$/
    const level2Pattern = /^(?:(?:\d+\.){1,2}\d*|（[一二三四五六七八九十0-9]+）)\s*(.*)$/
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

      // 普通段落行：在 Markdown 中，普通行尾若不加两个空格或双换行会被折叠到同一行
      // 保持原始排版保真：在非空文本行末尾增加两个空格触发 Markdown 硬换行
      resultLines.push(`${rawLine}  `)
    }

    return resultLines.join('\n').trim()
  }
}


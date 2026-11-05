import path from 'node:path'
import { BadRequestException, Logger } from '@nestjs/common'
import { IDocParser } from '../parser.interface'
import {
  checkFileSize,
  OFFICE_MAX_FILE_SIZES,
  postprocessMarkdown,
  validateZipMagicNumber,
} from '../parser.utils'

/**
 * Office 文档解析策略抽象基类（基于模板方法模式）
 *
 * 统一规范所有 OOXML (docx / xlsx / pptx) 文档的解析生命周期：
 * 1. 文件头魔数与大小校验 (validate)
 * 2. 核心文本提取 (extract) -> 由具体子类实现，与三方解析库解耦
 * 3. Markdown 后处理与空文件防御 (postprocess)
 * 4. 大标题智能注入 (decorateTitle)
 */
export abstract class BaseOfficeStrategy implements IDocParser {
  protected readonly logger: Logger

  abstract readonly supportedExtensions: string[]
  abstract readonly formatName: string
  protected maxSizeBytes: number = OFFICE_MAX_FILE_SIZES.DOCX

  constructor(loggerContext: string) {
    this.logger = new Logger(loggerContext)
  }

  /**
   * 模板方法：定义不可变的标准解析流水线
   */
  async parse(buffer: Buffer, filename?: string): Promise<string> {
    this.logger.debug(
      `[${this.formatName}Parser] 收到解析请求: filename=${filename || 'unknown'}, size=${buffer?.length || 0} bytes`,
    )

    // 1. 基础校验（文件大小与 ZIP 魔数）
    this.validate(buffer, filename)

    // 2. 调用核心提取（具体解析库由子类实现）
    let rawMarkdown = ''
    try {
      rawMarkdown = await this.extract(buffer, filename)
    }
    catch (error: any) {
      this.logger.error(`[${this.formatName}Parser] 解析失败: ${error.message}`, error.stack)
      throw new BadRequestException(
        `${this.formatName} 文档解析失败: ${error.message || '文件损坏或受密码保护'}`,
      )
    }

    // 3. 后处理规范化与空结果检查
    const cleaned = postprocessMarkdown(rawMarkdown)
    if (!cleaned) {
      throw new BadRequestException(
        `${this.formatName} 文档内容为空，或仅包含无法提取的纯图片/扫描内容`,
      )
    }

    // 4. 标题智能补充
    return this.decorateTitle(cleaned, filename)
  }

  /**
   * 基础校验：大小与 ZIP 魔数
   */
  protected validate(buffer: Buffer, _filename?: string): void {
    checkFileSize(buffer, this.maxSizeBytes, this.formatName)
    validateZipMagicNumber(buffer, this.formatName)
  }

  /**
   * 优雅大标题补充：若全文首行没有一级大标题 (# xxx) 且提供了文件名，则自动注入文件名作为最高级主标题
   */
  protected decorateTitle(markdown: string, filename?: string): string {
    if (!filename) return markdown

    const cleanTitle = path.basename(filename, path.extname(filename)).trim()
    const firstLine = markdown.split('\n').find(l => l.trim().length > 0) || ''

    // 仅当首个非空行不是一级标题（如 '# 标题'）时注入
    if (!/^#\s/.test(firstLine.trim())) {
      return `# ${cleanTitle}\n\n${markdown}`
    }

    return markdown
  }

  /**
   * 核心文本提取逻辑（由子类负责对接具体的第三方库）
   * @param buffer 待解析的二进制文件
   * @param filename 可选的原始文件名
   * @returns 提取出的原始 Markdown 字符串
   */
  protected abstract extract(buffer: Buffer, filename?: string): Promise<string>
}


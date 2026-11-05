import { Injectable, Logger } from '@nestjs/common'
import { IDocParser } from '../parser.interface'

/**
 * PDF 文档解析策略骨架 (待填充具体提取逻辑)
 */
@Injectable()
export class PdfParserStrategy implements IDocParser {
  private readonly logger = new Logger(PdfParserStrategy.name)
  readonly supportedExtensions = ['.pdf']

  async parse(buffer: Buffer, filename?: string): Promise<string> {
    this.logger.debug(`[PdfParser] 接收到 PDF 解析请求: filename=${filename || 'unknown'}, size=${buffer.length}`)
    
    // TODO: 后续填充 pdf-parse 提取页面并转为标准 Markdown
    return `# 文档解析预览 (${filename || 'PDF文档'})\n\n[待填充: PDF 文本提取内容]`
  }
}


import { Injectable, Logger } from '@nestjs/common'
import { IDocParser } from '../parser.interface'

/**
 * Word 文档解析策略骨架 (待填充 mammoth 结构化转换逻辑)
 */
@Injectable()
export class WordParserStrategy implements IDocParser {
  private readonly logger = new Logger(WordParserStrategy.name)
  readonly supportedExtensions = ['.docx', '.doc']

  async parse(buffer: Buffer, filename?: string): Promise<string> {
    this.logger.debug(`[WordParser] 接收到 Word 解析请求: filename=${filename || 'unknown'}, size=${buffer.length}`)

    // TODO: 后续填充 mammoth 转换为标题、段落与 Markdown 表格
    return `# 文档解析预览 (${filename || 'Word文档'})\n\n[待填充: Word 文档提取内容]`
  }
}


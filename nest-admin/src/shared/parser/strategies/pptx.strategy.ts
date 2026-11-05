import { Injectable, Logger } from '@nestjs/common'
import { IDocParser } from '../parser.interface'

/**
 * PPT 演示文稿解析策略骨架 (待填充幻灯片文本框提取逻辑)
 */
@Injectable()
export class PptxParserStrategy implements IDocParser {
  private readonly logger = new Logger(PptxParserStrategy.name)
  readonly supportedExtensions = ['.pptx', '.ppt']

  async parse(buffer: Buffer, filename?: string): Promise<string> {
    this.logger.debug(`[PptxParser] 接收到 PPT 解析请求: filename=${filename || 'unknown'}, size=${buffer.length}`)

    // TODO: 后续填充幻灯片分段提取并拼接为 Markdown
    return `# 幻灯片解析预览 (${filename || 'PPT演示文稿'})\n\n[待填充: PPT 文本提取内容]`
  }
}


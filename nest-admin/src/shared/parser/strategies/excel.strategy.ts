import { Injectable, Logger } from '@nestjs/common'
import { IDocParser } from '../parser.interface'

/**
 * Excel 电子表格解析策略骨架 (待填充 Sheet 转换为 Markdown 表格逻辑)
 */
@Injectable()
export class ExcelParserStrategy implements IDocParser {
  private readonly logger = new Logger(ExcelParserStrategy.name)
  readonly supportedExtensions = ['.xlsx', '.xls', '.csv']

  async parse(buffer: Buffer, filename?: string): Promise<string> {
    this.logger.debug(`[ExcelParser] 接收到 Excel 解析请求: filename=${filename || 'unknown'}, size=${buffer.length}`)

    // TODO: 后续填充 xlsx (SheetJS) 遍历 Sheet 拼接为 Markdown 表格
    return `# 表格解析预览 (${filename || 'Excel工作表'})\n\n[待填充: Excel 表格提取内容]`
  }
}


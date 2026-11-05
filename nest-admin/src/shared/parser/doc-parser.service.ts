import path from 'node:path'
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { IDocParser } from './parser.interface'
import { ExcelParserStrategy } from './strategies/excel.strategy'
import { PdfParserStrategy } from './strategies/pdf.strategy'
import { PptxParserStrategy } from './strategies/pptx.strategy'
import { TextParserStrategy } from './strategies/text.strategy'
import { WordParserStrategy } from './strategies/word.strategy'

@Injectable()
export class DocParserService implements OnModuleInit {
  private readonly logger = new Logger(DocParserService.name)

  /**
   * 格式映射字典：将小写扩展名（如 '.xlsx'）映射到对应的解析策略实例
   */
  private readonly parserRegistry = new Map<string, IDocParser>()

  constructor(
    private readonly textStrategy: TextParserStrategy,
    private readonly pdfStrategy: PdfParserStrategy,
    private readonly excelStrategy: ExcelParserStrategy,
    private readonly wordStrategy: WordParserStrategy,
    private readonly pptxStrategy: PptxParserStrategy,
  ) {}

  onModuleInit() {
    this.registerStrategies([
      this.textStrategy,
      this.pdfStrategy,
      this.excelStrategy,
      this.wordStrategy,
      this.pptxStrategy,
    ])
  }

  /**
   * 注册解析策略，自动根据策略支持的扩展名列表完成路由映射
   */
  private registerStrategies(strategies: IDocParser[]) {
    for (const strategy of strategies) {
      for (const ext of strategy.supportedExtensions) {
        const normalizedExt = ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
        this.parserRegistry.set(normalizedExt, strategy)
      }
    }
    this.logger.log(`[DocParser] 文档解析引擎初始化就绪，已注册格式: ${Array.from(this.parserRegistry.keys()).join(', ')}`)
  }

  /**
   * 规范化并推导扩展名
   * @param fileTypeOrName 文件名（如 'report.xlsx'）或文件扩展名（如 'xlsx' 或 '.pdf'）
   */
  private extractExtension(fileTypeOrName: string): string {
    if (!fileTypeOrName) return ''
    const clean = fileTypeOrName.trim().toLowerCase()
    const ext = path.extname(clean)
    if (ext) return ext
    return clean.startsWith('.') ? clean : `.${clean}`
  }

  /**
   * 🌟 核心分发入口：自动根据格式调用对应的解析策略
   * @param buffer 待解析文件的二进制 Buffer
   * @param fileTypeOrName 文件后缀（如 'pdf'）或完整文件名（如 '2026预算.xlsx'）
   * @param originalFilename 可选的原始文件名，用于排版标题与日志
   * @returns 标准 Markdown 格式全文字符串
   */
  async parseToMarkdown(
    buffer: Buffer,
    fileTypeOrName: string,
    originalFilename?: string,
  ): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('待解析的文件内容为空 (0 bytes)')
    }

    const ext = this.extractExtension(fileTypeOrName)

    // 0. 拦截旧版二进制 Office 格式并给出指引
    if (ext === '.doc' || ext === '.xls' || ext === '.ppt') {
      throw new BadRequestException(
        `检测到旧版 Office 格式 [${ext}]，系统暂不支持，请将其另存为 .docx / .xlsx / .pptx 新版格式后重新上传`,
      )
    }

    const parser = this.parserRegistry.get(ext)

    if (!parser) {
      this.logger.warn(`未找到格式 [${ext}] 的专用解析策略，尝试以纯文本编码回退解析`)
      try {
        return await this.textStrategy.parse(buffer)
      }
      catch {
        throw new BadRequestException(`暂不支持对文件格式 [${ext}] 进行内容解析提取`)
      }
    }

    const filename = originalFilename || fileTypeOrName
    this.logger.log(`[DocParser] 自动路由到解析策略 [${parser.constructor.name}] -> 正在解析: ${filename}`)

    try {
      return await parser.parse(buffer, filename)
    }
    catch (error: any) {
      this.logger.error(`[DocParser] 解析失败: [${filename}]: ${error.message}`, error.stack)
      throw new BadRequestException(`文档解析失败: ${error.message || '格式异常或文件损坏'}`)
    }
  }

  /**
   * 检查是否支持某格式的解析
   */
  isSupported(fileTypeOrName: string): boolean {
    const ext = this.extractExtension(fileTypeOrName)
    return this.parserRegistry.has(ext)
  }
}


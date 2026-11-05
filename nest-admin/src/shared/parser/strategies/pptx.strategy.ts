import { Injectable } from '@nestjs/common'
import { OfficeParser } from 'officeparser'
import { OFFICE_MAX_FILE_SIZES } from '../parser.utils'
import { BaseOfficeStrategy } from './base-office.strategy'

/**
 * PPT 演示文稿 (.pptx) 解析策略
 * 基于 BaseOfficeStrategy 生命周期管道：
 * 1. 结构化提取每页幻灯片文本框、层级大纲与内容
 * 2. 严格执行 50MB 大小限制与 OOXML ZIP 魔数验证（旧版 .ppt 统一由分发层拦截）
 */
@Injectable()
export class PptxParserStrategy extends BaseOfficeStrategy {
  readonly supportedExtensions = ['.pptx']
  readonly formatName = 'PPTX'
  protected readonly maxSizeBytes = OFFICE_MAX_FILE_SIZES.PPTX

  constructor() {
    super(PptxParserStrategy.name)
  }

  /**
   * 核心幻灯片提取与 Markdown 转换
   */
  protected async extract(buffer: Buffer): Promise<string> {
    const ast = await OfficeParser.parseOffice(buffer, {
      ocr: false,
      fileType: 'pptx',
    })

    const conversion = await ast.to('md')

    return conversion?.value || ''
  }
}

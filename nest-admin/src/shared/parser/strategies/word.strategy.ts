import { Injectable } from '@nestjs/common'
import { OfficeParser } from 'officeparser'
import { OFFICE_MAX_FILE_SIZES } from '../parser.utils'
import { BaseOfficeStrategy } from './base-office.strategy'

/**
 * Word 文档 (.docx) 解析策略
 * 继承 BaseOfficeStrategy 统一生命周期管道
 * 仅负责具体的 DOCX 提取逻辑，方便后续随时无缝替换底层解析库
 */
@Injectable()
export class WordParserStrategy extends BaseOfficeStrategy {
  readonly supportedExtensions = ['.docx']
  readonly formatName = 'Word'
  protected readonly maxSizeBytes = OFFICE_MAX_FILE_SIZES.DOCX

  constructor() {
    super(WordParserStrategy.name)
  }

  /**
   * 🌟 核心提取：如果未来更换为 mammoth / MinerU / 自研服务，只需修改此方法内部几行代码即可
   */
  protected async extract(buffer: Buffer): Promise<string> {
    const ast = await OfficeParser.parseOffice(buffer, {
      ocr: false,
      fileType: 'docx',
    })

    const conversion = await ast.to('md')
    return conversion?.value || ''
  }
}

import { Injectable } from '@nestjs/common'
import { OfficeGenerator, OfficeParser } from 'officeparser'
import {
  checkFileSize,
  OFFICE_MAX_FILE_SIZES,
  truncateLargeMarkdownTables,
  validateZipMagicNumber,
} from '../parser.utils'
import { BaseOfficeStrategy } from './base-office.strategy'

/**
 * Excel 电子表格 (.xlsx / .csv) 解析策略
 * 基于 BaseOfficeStrategy 生命周期管道：
 * 1. 自动对齐多工作表（Sheet）结构：各 Sheet 带独立二级标题，空 Sheet 友好标注
 * 2. 具备超大表格（超过 500 行）独立智能截断与保护能力
 * 3. 严格执行 20MB 大小限制与 OOXML ZIP 魔数验证（.csv 豁免 ZIP 魔数）
 */
@Injectable()
export class ExcelParserStrategy extends BaseOfficeStrategy {
  readonly supportedExtensions = ['.xlsx', '.csv']
  readonly formatName = 'Excel'
  protected readonly maxSizeBytes = OFFICE_MAX_FILE_SIZES.XLSX

  constructor() {
    super(ExcelParserStrategy.name)
  }

  /**
   * 差异化校验：.xlsx 严格校验 ZIP 魔数，纯文本 .csv 豁免
   */
  protected override validate(buffer: Buffer, filename?: string): void {
    checkFileSize(buffer, this.maxSizeBytes, this.formatName)

    const isCsv = filename && /\.csv$/i.test(filename)
    if (!isCsv) {
      validateZipMagicNumber(buffer, this.formatName)
    }
  }

  /**
   * 核心表格提取与 Markdown 转换（支持多工作表 Sheet 独立命名与渲染）
   */
  protected async extract(buffer: Buffer, filename?: string): Promise<string> {
    const isCsv = filename && /\.csv$/i.test(filename)

    // 显式指定 fileType（避免纯文本 CSV 缺少魔数导致 officeparser 自动探针失败）
    const ast = await OfficeParser.parseOffice(buffer, {
      ocr: false,
      fileType: isCsv ? 'csv' : 'xlsx',
    })

    // 1. 若 AST 中包含 Sheet 节点，逐个工作表提取，并赋予明确的二级标题
    const sheetNodes = ast.content?.filter(node => node.type === 'sheet') || []

    if (sheetNodes.length > 0) {
      const sheetOutputs: string[] = []

      for (let i = 0; i < sheetNodes.length; i++) {
        const sheetNode = sheetNodes[i]
        const meta = sheetNode.metadata as any
        const sheetName = meta?.sheetName || `工作表 ${i + 1}`

        // 生成该单个工作表的 Markdown 表格
        const singleSheetAst = {
          type: ast.type,
          metadata: ast.metadata || {},
          content: [sheetNode],
        }

        const res = await OfficeGenerator.generate(singleSheetAst as any, 'md', {
          mdConfig: { fallbackToHtml: false },
        })

        // 清理 officeparser 默认注入的单行 --- 分隔符
        const rawTable = (res.value || '').replace(/^---\s*$/gm, '').trim()

        if (rawTable) {
          // 对当前 Sheet 进行独立的超长表格（500行）安全截断保护
          const safeTable = truncateLargeMarkdownTables(rawTable, 500)
          sheetOutputs.push(`## 工作表：${sheetName}\n\n${safeTable}`)
        }
        else {
          // 实施文档规范：空 Sheet 不输出表格，明确标注空状态
          sheetOutputs.push(`## 工作表：${sheetName}\n\n*(此工作表为空)*`)
        }
      }

      return sheetOutputs.join('\n\n---\n\n')
    }

    // 2. 兜底逻辑（如 .csv 或未识别出 Sheet 结构的单表）
    const conversion = await ast.to('md', {
      mdConfig: {
        fallbackToHtml: false,
      },
    })

    return truncateLargeMarkdownTables(conversion?.value || '', 500)
  }
}

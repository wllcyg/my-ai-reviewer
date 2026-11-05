import { BadRequestException } from '@nestjs/common'

/**
 * 常见 Office 文档大小上限（字节）
 */
export const OFFICE_MAX_FILE_SIZES = {
  DOCX: 20 * 1024 * 1024, // 20 MB
  XLSX: 20 * 1024 * 1024, // 20 MB
  PPTX: 50 * 1024 * 1024, // 50 MB
  TXT: 5 * 1024 * 1024, // 5 MB
}

/**
 * 校验 OOXML (docx / xlsx / pptx) 文件头魔数
 * ZIP 归档魔数为 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
 */
export function validateZipMagicNumber(buffer: Buffer, formatName = 'Office'): void {
  if (
    !buffer
    || buffer.length < 4
    || buffer[0] !== 0x50
    || buffer[1] !== 0x4B
    || buffer[2] !== 0x03
    || buffer[3] !== 0x04
  ) {
    throw new BadRequestException(
      `[${formatName}] 文件格式非法或已损坏：未检测到合法的 ZIP/OOXML 文件头，请勿直接修改扩展名`,
    )
  }
}

/**
 * 校验文件大小限制
 */
export function checkFileSize(buffer: Buffer, maxBytes: number, formatName: string): void {
  if (buffer.length > maxBytes) {
    const maxMb = Math.floor(maxBytes / (1024 * 1024))
    const currentMb = (buffer.length / (1024 * 1024)).toFixed(1)
    throw new BadRequestException(
      `[${formatName}] 文件大小 (${currentMb}MB) 超过上限 (${maxMb}MB)`,
    )
  }
}

/**
 * 针对 Markdown 中的超大表格进行安全截断，防止超长表格冲垮上下文或检索
 * @param markdown 原始 Markdown 文本
 * @param maxRows 允许保留的最大表格行数（默认 500 行）
 */
export function truncateLargeMarkdownTables(markdown: string, maxRows = 500): string {
  if (!markdown) return ''

  const lines = markdown.split('\n')
  const result: string[] = []
  let tableRowCount = 0
  let isInsideTable = false
  let isTruncatedForCurrentTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|')

    if (isTableRow) {
      if (!isInsideTable) {
        isInsideTable = true
        tableRowCount = 0
        isTruncatedForCurrentTable = false
      }

      tableRowCount++

      // 表头 1 行 + 分隔符 1 行 + 数据行最多 maxRows 行
      if (tableRowCount <= maxRows + 2) {
        result.push(line)
      }
      else if (!isTruncatedForCurrentTable) {
        isTruncatedForCurrentTable = true
        result.push(
          `| ... | *(已自动截断超长表格，仅展示前 ${maxRows} 行数据)* |`,
        )
      }
    }
    else {
      isInsideTable = false
      result.push(line)
    }
  }

  return result.join('\n')
}

/**
 * 检查是否为旧版二进制 Office 格式（.doc, .xls, .ppt）
 */
export function isLegacyOfficeFormat(ext: string): boolean {
  const cleanExt = ext.toLowerCase().startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
  return ['.doc', '.xls', '.ppt'].includes(cleanExt)
}

/**
 * Markdown 后处理规范化：
 * 1. 剥离 BOM
 * 2. 统一 CRLF/CR 为 LF
 * 3. 压缩连续多余空行（3 个及以上空行合并为 2 个）
 * 4. 清理首尾空白
 */
export function postprocessMarkdown(markdown: string): string {
  if (!markdown) return ''

  return markdown
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}


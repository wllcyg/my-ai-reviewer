/**
 * 文档格式策略解析器统一契约接口
 */
export interface IDocParser {
  /**
   * 当前策略所支持的文件扩展名列表（统一小写且包含前导点，例如 ['.pdf'] 或 ['.xlsx', '.xls', '.csv']）
   */
  readonly supportedExtensions: string[]

  /**
   * 执行解析，将文件二进制 Buffer 转换为标准化 Markdown 字符串
   * @param buffer 文件的二进制数据
   * @param filename 可选的原始文件名，便于策略提取标题或上下文
   */
  parse(buffer: Buffer, filename?: string): Promise<string>
}


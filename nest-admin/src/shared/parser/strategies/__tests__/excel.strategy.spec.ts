import { Test } from '@nestjs/testing'
import { OfficeGenerator, OfficeParser } from 'officeparser'
import { ExcelParserStrategy } from '../excel.strategy'

describe('ExcelParserStrategy', () => {
  let strategy: ExcelParserStrategy
  const validZipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00])

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ExcelParserStrategy],
    }).compile()

    strategy = module.get<ExcelParserStrategy>(ExcelParserStrategy)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('基础规则与防护', () => {
    it('支持的扩展名应包含 .xlsx 和 .csv', () => {
      expect(strategy.supportedExtensions).toEqual(['.xlsx', '.csv'])
    })

    it('.xlsx 文件缺失 ZIP 魔数时应抛出 BadRequestException', async () => {
      const fakeBuffer = Buffer.from('not-a-zip')
      await expect(strategy.parse(fakeBuffer, 'data.xlsx')).rejects.toThrow(
        '未检测到合法的 ZIP/OOXML 文件头',
      )
    })

    it('.csv 文件应豁免 ZIP 魔数校验', async () => {
      jest.spyOn(OfficeParser, 'parseOffice').mockResolvedValue({
        to: jest.fn().mockResolvedValue({
          value: '| 姓名 | 年龄 |\n| --- | --- |\n| 张三 | 25 |',
        }),
      } as any)

      const csvBuffer = Buffer.from('姓名,年龄\n张三,25', 'utf-8')
      const result = await strategy.parse(csvBuffer, 'users.csv')

      expect(result).toContain('张三')
    })

    it('超过 20MB 上限时应直接拦截', async () => {
      const hugeBuffer = {
        length: 21 * 1024 * 1024,
      } as Buffer

      await expect(strategy.parse(hugeBuffer, 'big.xlsx')).rejects.toThrow('超过上限')
    })
  })

  describe('多工作表 (Multi-Sheet) 结构化处理', () => {
    it('多个 Sheet 应各自生成二级标题，空 Sheet 友好标注且不输出表格', async () => {
      const mockAst = {
        type: 'xlsx',
        content: [
          {
            type: 'sheet',
            metadata: { sheetName: '2026收入预算' },
          },
          {
            type: 'sheet',
            metadata: { sheetName: '空白备忘录' },
          },
        ],
      }

      jest.spyOn(OfficeParser, 'parseOffice').mockResolvedValue(mockAst as any)
      jest
        .spyOn(OfficeGenerator, 'generate')
        .mockImplementation(async (astObj: any) => {
          const sheetName = astObj.content[0]?.metadata?.sheetName
          if (sheetName === '2026收入预算') {
            return { value: '| 月份 | 金额 |\n| --- | --- |\n| 1月 | 100万 |' } as any
          }
          return { value: '' } as any // 空白 sheet
        })

      const result = await strategy.parse(validZipHeader, '财务报表.xlsx')

      expect(result).toContain('# 财务报表')
      expect(result).toContain('## 工作表：2026收入预算')
      expect(result).toContain('| 1月 | 100万 |')
      expect(result).toContain('## 工作表：空白备忘录')
      expect(result).toContain('*(此工作表为空)*')
    })
  })

  describe('超大表格截断保护', () => {
    it('超过 500 行的表格应自动截断并添加提示行', async () => {
      // 构造 600 行的表格 Markdown
      const tableLines = ['| ID | Value |', '| --- | --- |']
      for (let i = 1; i <= 600; i++) {
        tableLines.push(`| ${i} | val_${i} |`)
      }
      const rawTableMd = tableLines.join('\n')

      jest.spyOn(OfficeParser, 'parseOffice').mockResolvedValue({
        to: jest.fn().mockResolvedValue({
          value: rawTableMd,
        }),
      } as any)

      const result = await strategy.parse(validZipHeader, 'large-table.xlsx')

      // 应包含前 500 行数据
      expect(result).toContain('| 500 | val_500 |')
      // 不应包含第 501 行
      expect(result).not.toContain('| 501 | val_501 |')
      // 应包含截断提示
      expect(result).toContain('已自动截断超长表格，仅展示前 500 行数据')
    })
  })

  describe('空结果防御与标题注入', () => {
    it('表格内容为空时应抛出 BadRequestException', async () => {
      jest.spyOn(OfficeParser, 'parseOffice').mockResolvedValue({
        to: jest.fn().mockResolvedValue({
          value: '   \n\n  ',
        }),
      } as any)

      await expect(strategy.parse(validZipHeader, 'empty.xlsx')).rejects.toThrow(
        'Excel 文档内容为空',
      )
    })

    it('无一级标题时应自动补充文件名标题', async () => {
      jest.spyOn(OfficeParser, 'parseOffice').mockResolvedValue({
        to: jest.fn().mockResolvedValue({
          value: '| 部门 | 预算 |\n| --- | --- |\n| 研发部 | 100万 |',
        }),
      } as any)

      const result = await strategy.parse(validZipHeader, '2026预算表.xlsx')

      expect(result).toContain('# 2026预算表')
      expect(result).toContain('研发部')
    })
  })
})

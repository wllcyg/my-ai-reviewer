import { BadRequestException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DocParserService } from '../doc-parser.service'
import { ExcelParserStrategy } from '../strategies/excel.strategy'
import { PdfParserStrategy } from '../strategies/pdf.strategy'
import { PptxParserStrategy } from '../strategies/pptx.strategy'
import { TextParserStrategy } from '../strategies/text.strategy'
import { WordParserStrategy } from '../strategies/word.strategy'

describe('DocParserService (集成路由与安全拦截)', () => {
  let service: DocParserService
  let wordStrategy: WordParserStrategy
  let excelStrategy: ExcelParserStrategy
  let pptxStrategy: PptxParserStrategy
  let textStrategy: TextParserStrategy

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DocParserService,
        TextParserStrategy,
        PdfParserStrategy,
        ExcelParserStrategy,
        WordParserStrategy,
        PptxParserStrategy,
      ],
    }).compile()

    service = module.get<DocParserService>(DocParserService)
    wordStrategy = module.get<WordParserStrategy>(WordParserStrategy)
    excelStrategy = module.get<ExcelParserStrategy>(ExcelParserStrategy)
    pptxStrategy = module.get<PptxParserStrategy>(PptxParserStrategy)
    textStrategy = module.get<TextParserStrategy>(TextParserStrategy)

    service.onModuleInit()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('传入空 buffer 时应抛出 BadRequestException', async () => {
    await expect(service.parseToMarkdown(Buffer.alloc(0), 'file.txt')).rejects.toThrow(
      '待解析的文件内容为空',
    )
  })

  describe('旧版二进制 Office 格式拦截', () => {
    it('上传 .doc 格式应明确抛错提示转存为 .docx', async () => {
      const buf = Buffer.from('dummy')
      await expect(service.parseToMarkdown(buf, 'contract.doc')).rejects.toThrow(
        '检测到旧版 Office 格式 [.doc]，系统暂不支持，请将其另存为 .docx',
      )
    })

    it('上传 .xls 格式应明确抛错提示转存为 .xlsx', async () => {
      const buf = Buffer.from('dummy')
      await expect(service.parseToMarkdown(buf, 'finance.xls')).rejects.toThrow(
        '检测到旧版 Office 格式 [.xls]，系统暂不支持，请将其另存为',
      )
    })

    it('上传 .ppt 格式应明确抛错提示转存为 .pptx', async () => {
      const buf = Buffer.from('dummy')
      await expect(service.parseToMarkdown(buf, 'presentation.ppt')).rejects.toThrow(
        '检测到旧版 Office 格式 [.ppt]，系统暂不支持，请将其另存为',
      )
    })
  })

  describe('策略路由分发', () => {
    it('.docx 文件应准确路由到 WordParserStrategy', async () => {
      const buf = Buffer.from([0x50, 0x4B, 0x03, 0x04])
      const spy = jest
        .spyOn(wordStrategy, 'parse')
        .mockResolvedValue('# Word 内容')

      const result = await service.parseToMarkdown(buf, 'manual.docx')

      expect(spy).toHaveBeenCalledWith(buf, 'manual.docx')
      expect(result).toBe('# Word 内容')
    })

    it('.xlsx 文件应准确路由到 ExcelParserStrategy', async () => {
      const buf = Buffer.from([0x50, 0x4B, 0x03, 0x04])
      const spy = jest
        .spyOn(excelStrategy, 'parse')
        .mockResolvedValue('# 表格内容')

      const result = await service.parseToMarkdown(buf, 'finance.xlsx')

      expect(spy).toHaveBeenCalledWith(buf, 'finance.xlsx')
      expect(result).toBe('# 表格内容')
    })

    it('.csv 文件应准确路由到 ExcelParserStrategy', async () => {
      const buf = Buffer.from('a,b,c')
      const spy = jest
        .spyOn(excelStrategy, 'parse')
        .mockResolvedValue('# CSV 表格内容')

      const result = await service.parseToMarkdown(buf, 'data.csv')

      expect(spy).toHaveBeenCalledWith(buf, 'data.csv')
      expect(result).toBe('# CSV 表格内容')
    })

    it('.pptx 文件应准确路由到 PptxParserStrategy', async () => {
      const buf = Buffer.from([0x50, 0x4B, 0x03, 0x04])
      const spy = jest
        .spyOn(pptxStrategy, 'parse')
        .mockResolvedValue('# PPT 幻灯片')

      const result = await service.parseToMarkdown(buf, 'pitch.pptx')

      expect(spy).toHaveBeenCalledWith(buf, 'pitch.pptx')
      expect(result).toBe('# PPT 幻灯片')
    })

    it('.txt 文件应准确路由到 TextParserStrategy', async () => {
      const buf = Buffer.from('你好世界', 'utf-8')
      const result = await service.parseToMarkdown(buf, 'note.txt')

      expect(result).toContain('你好世界')
    })
  })
})


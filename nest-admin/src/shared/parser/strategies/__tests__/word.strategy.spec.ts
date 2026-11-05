import { BadRequestException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { OfficeParser } from 'officeparser'
import { WordParserStrategy } from '../word.strategy'

describe('WordParserStrategy', () => {
  let strategy: WordParserStrategy

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [WordParserStrategy],
    }).compile()

    strategy = module.get<WordParserStrategy>(WordParserStrategy)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('基础规则与防护', () => {
    it('支持的扩展名应仅为 .docx（不含已废弃的二进制 .doc）', () => {
      expect(strategy.supportedExtensions).toEqual(['.docx'])
    })

    it('当文件缺少合法 ZIP 魔数时（如普通文本冒充 .docx），应抛出 BadRequestException', async () => {
      const fakeDocxBuffer = Buffer.from('这是一个假的 docx 内容，并不是 zip 格式')

      await expect(
        strategy.parse(fakeDocxBuffer, 'fake.docx'),
      ).rejects.toThrow('未检测到合法的 ZIP/OOXML 文件头')
    })

    it('当文件超过 20MB 上限时，应直接拦截并抛出 BadRequestException', async () => {
      // 构造 > 20MB 的 mock buffer
      const hugeBuffer = {
        length: 21 * 1024 * 1024,
      } as Buffer

      await expect(
        strategy.parse(hugeBuffer, 'huge.docx'),
      ).rejects.toThrow('超过上限')
    })
  })

  describe('解析流程与 Markdown 转换', () => {
    const validZipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00])

    it('当解析成功且首行无标题时，应自动补充文件名作为主标题', async () => {
      jest.spyOn(OfficeParser, 'parseOffice').mockResolvedValue({
        to: jest.fn().mockResolvedValue({
          value: '这是正文第一段。\n\n这是正文第二段。',
        }),
      } as any)

      const result = await strategy.parse(validZipHeader, '员工出差管理办法.docx')

      expect(result).toContain('# 员工出差管理办法')
      expect(result).toContain('这是正文第一段。')
    })

    it('当原文档已自带一级标题时，不应重复补充文件名标题', async () => {
      jest.spyOn(OfficeParser, 'parseOffice').mockResolvedValue({
        to: jest.fn().mockResolvedValue({
          value: '# 原有主标题\n\n正文内容说明。',
        }),
      } as any)

      const result = await strategy.parse(validZipHeader, '员工手册.docx')

      // 仅应有一个 # 原有主标题，不应有 # 员工手册
      expect(result).toContain('# 原有主标题')
      expect(result).not.toContain('# 员工手册')
    })

    it('应压缩连续 3 个以上的空行，且清理多余首尾空白', async () => {
      jest.spyOn(OfficeParser, 'parseOffice').mockResolvedValue({
        to: jest.fn().mockResolvedValue({
          value: '# 标题\n\n\n\n\n中间段落。\n\n\n\n结尾段落。\n\n',
        }),
      } as any)

      const result = await strategy.parse(validZipHeader, 'test.docx')

      // 不应包含 3 个连续换行
      expect(result).not.toContain('\n\n\n')
    })

    it('当文档内容为空时，应抛出 BadRequestException', async () => {
      jest.spyOn(OfficeParser, 'parseOffice').mockResolvedValue({
        to: jest.fn().mockResolvedValue({
          value: '   \n\n   \n',
        }),
      } as any)

      await expect(
        strategy.parse(validZipHeader, 'empty.docx'),
      ).rejects.toThrow('Word 文档内容为空')
    })

    it('当底层 officeparser 解析抛错时，应包装为可读的 BadRequestException', async () => {
      jest.spyOn(OfficeParser, 'parseOffice').mockRejectedValue(new Error('Password protected document'))

      await expect(
        strategy.parse(validZipHeader, 'encrypted.docx'),
      ).rejects.toThrow('Word 文档解析失败: Password protected document')
    })
  })
})


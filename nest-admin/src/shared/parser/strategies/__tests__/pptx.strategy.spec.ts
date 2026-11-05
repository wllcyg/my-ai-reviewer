import { Test } from '@nestjs/testing'
import { OfficeParser } from 'officeparser'
import { PptxParserStrategy } from '../pptx.strategy'

describe('PptxParserStrategy', () => {
  let strategy: PptxParserStrategy
  const validZipHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00])

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PptxParserStrategy],
    }).compile()

    strategy = module.get<PptxParserStrategy>(PptxParserStrategy)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('基础规则与防护', () => {
    it('支持的扩展名应仅为 .pptx（不含旧版 .ppt）', () => {
      expect(strategy.supportedExtensions).toEqual(['.pptx'])
    })

    it('文件缺少 ZIP 魔数时应拦截', async () => {
      const fakeBuffer = Buffer.from('not-a-pptx')
      await expect(strategy.parse(fakeBuffer, 'slides.pptx')).rejects.toThrow(
        '未检测到合法的 ZIP/OOXML 文件头',
      )
    })

    it('超过 50MB 上限时应直接拦截', async () => {
      const hugeBuffer = {
        length: 51 * 1024 * 1024,
      } as Buffer

      await expect(strategy.parse(hugeBuffer, 'big.pptx')).rejects.toThrow('超过上限')
    })
  })

  describe('幻灯片内容提取与 Markdown 转换', () => {
    it('应正确提取幻灯片大纲并注入主标题', async () => {
      jest.spyOn(OfficeParser, 'parseOffice').mockResolvedValue({
        to: jest.fn().mockResolvedValue({
          value: '## 幻灯片 1: 概述\n\n项目背景介绍。\n\n## 幻灯片 2: 方案\n\n核心架构图。',
        }),
      } as any)

      const result = await strategy.parse(validZipHeader, '季度汇报.pptx')

      expect(result).toContain('# 季度汇报')
      expect(result).toContain('## 幻灯片 1: 概述')
      expect(result).toContain('项目背景介绍。')
    })

    it('内容为空时应抛出 BadRequestException', async () => {
      jest.spyOn(OfficeParser, 'parseOffice').mockResolvedValue({
        to: jest.fn().mockResolvedValue({
          value: '   \n\n  ',
        }),
      } as any)

      await expect(strategy.parse(validZipHeader, 'blank.pptx')).rejects.toThrow(
        'PPTX 文档内容为空',
      )
    })
  })
})

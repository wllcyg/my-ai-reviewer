import path from 'node:path'
import { readFileSync } from 'node:fs'
import { Test } from '@nestjs/testing'
import { TextParserStrategy } from '../text.strategy'

/** 读取 fixtures 目录下的测试文件为 Buffer */
function fixture(name: string): Buffer {
  return readFileSync(path.join(__dirname, 'fixtures', name))
}

describe('TextParserStrategy', () => {
  let parser: TextParserStrategy

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TextParserStrategy],
    }).compile()
    parser = module.get(TextParserStrategy)
  })

  // ────────────────────────────────────────────────────────────
  // 编码识别
  // ────────────────────────────────────────────────────────────
  describe('编码自适应解码', () => {
    it('应正确解码标准 UTF-8 文件', async () => {
      const buf = fixture('01-normal-chapters.txt')
      const result = await parser.parse(buf, '01-normal-chapters.txt')
      expect(result).toContain('第一章')
      expect(result).toContain('总则')
    })

    it('应正确解码 UTF-8 with BOM 文件（Bug1 修复验证）', async () => {
      const buf = fixture('09-utf8-bom.txt')
      const result = await parser.parse(buf, '09-utf8-bom.txt')
      // BOM 字符 \uFEFF 不应出现在输出中
      expect(result).not.toContain('\uFEFF')
      expect(result).toContain('第一章')
    })

    it('应正确解码 UTF-16 LE with BOM 文件（Bug1 修复验证）', async () => {
      const buf = fixture('06-utf16le.txt')
      const result = await parser.parse(buf, '06-utf16le.txt')
      expect(result).not.toContain('\uFEFF')
      expect(result).toContain('第一章')
      expect(result).toContain('编码测试')
    })

    it('应正确解码 UTF-16 BE with BOM 文件（Bug1 修复验证）', async () => {
      const buf = fixture('07-utf16be.txt')
      const result = await parser.parse(buf, '07-utf16be.txt')
      expect(result).not.toContain('\uFEFF')
      expect(result).toContain('第一章')
    })

    it('应正确解码 GBK 编码文件（无 BOM）', async () => {
      const buf = fixture('05-gbk.txt')
      const result = await parser.parse(buf, '05-gbk.txt')
      expect(result).toContain('第一章')
      expect(result).toContain('GBK 编码')
    })
  })

  // ────────────────────────────────────────────────────────────
  // 章节标题识别
  // ────────────────────────────────────────────────────────────
  describe('启发式章节标题识别', () => {
    it('应将 "第X章" 升级为 ## 二级标题', async () => {
      const buf = fixture('01-normal-chapters.txt')
      const result = await parser.parse(buf, '01-normal-chapters.txt')
      expect(result).toContain('## 第一章 总则')
      expect(result).toContain('## 第二章 适用范围')
    })

    it('应将 "一、" 升级为 ## 二级标题', async () => {
      const buf = fixture('01-normal-chapters.txt')
      const result = await parser.parse(buf, '01-normal-chapters.txt')
      expect(result).toContain('## 一、基本原则')
    })

    it('应将 "1.1 " 格式升级为 ### 三级标题', async () => {
      const buf = fixture('01-normal-chapters.txt')
      const result = await parser.parse(buf, '01-normal-chapters.txt')
      expect(result).toContain('### 1.1 报销流程')
    })

    it('应将 "（一）" 格式升级为 ### 三级标题', async () => {
      const buf = fixture('01-normal-chapters.txt')
      const result = await parser.parse(buf, '01-normal-chapters.txt')
      expect(result).toContain('### （一）基本原则')
    })

    it('应将【xxx】语法拆分为标题 + 正文', async () => {
      const buf = fixture('01-normal-chapters.txt')
      const result = await parser.parse(buf, '01-normal-chapters.txt')
      expect(result).toContain('### 【重要提示】')
      expect(result).toContain('请务必在出差前进行报备')
    })
  })

  // ────────────────────────────────────────────────────────────
  // Bug2: 金额 / 小数不应误识为标题
  // ────────────────────────────────────────────────────────────
  describe('Bug2 修复：金额与小数不误识为章节标题', () => {
    it('含小数的正文行不应被升级为标题', async () => {
      const buf = fixture('02-decimal-and-enum-false-positive.txt')
      const result = await parser.parse(buf, '02-decimal-and-enum-false-positive.txt')
      // 3.14159 不应变成 ### 标题
      expect(result).not.toMatch(/^### 3\.14159/m)
      // 100.00 不应变成 ### 标题
      expect(result).not.toMatch(/^### 100\.00/m)
    })

    it('金额行 "2000.00 元" 不应被识别为章节标题', async () => {
      const buf = fixture('02-decimal-and-enum-false-positive.txt')
      const result = await parser.parse(buf, '02-decimal-and-enum-false-positive.txt')
      expect(result).not.toMatch(/^###.*2000\.00/m)
    })

    it('合法章节编号 "1.1" 仍应被正确识别为标题', async () => {
      const buf = fixture('02-decimal-and-enum-false-positive.txt')
      const result = await parser.parse(buf, '02-decimal-and-enum-false-positive.txt')
      expect(result).toContain('### 1.1 现金及现金等价物')
    })
  })

  // ────────────────────────────────────────────────────────────
  // Bug3: 首行有前置缩进的标题不应重复注入文件名
  // ────────────────────────────────────────────────────────────
  describe('Bug3 修复：有缩进的首行标题不重复注入文件名', () => {
    it('文件首行为缩进的 # 标题时，不应额外注入文件名标题', async () => {
      const buf = fixture('04-indented-heading-no-duplicate.txt')
      const result = await parser.parse(buf, '04-indented-heading-no-duplicate.txt')
      // 不应同时出现两个 h1 标题
      const h1Matches = result.match(/^# /gm) || []
      expect(h1Matches.length).toBeLessThanOrEqual(1)
    })
  })

  // ────────────────────────────────────────────────────────────
  // Bug4: 任意中文+顿号不应误识为标题
  // ────────────────────────────────────────────────────────────
  describe('Bug4 修复：任意中文+顿号不误识为章节标题', () => {
    it('"如、果..." 句式不应被识别为章节标题', async () => {
      const buf = fixture('02-decimal-and-enum-false-positive.txt')
      const result = await parser.parse(buf, '02-decimal-and-enum-false-positive.txt')
      expect(result).not.toMatch(/^## 如、/m)
    })

    it('"甲、乙、" 枚举正文不应被识别为章节标题', async () => {
      const buf = fixture('02-decimal-and-enum-false-positive.txt')
      const result = await parser.parse(buf, '02-decimal-and-enum-false-positive.txt')
      expect(result).not.toMatch(/^## 甲、/m)
      expect(result).not.toMatch(/^## 乙、/m)
    })
  })

  // ────────────────────────────────────────────────────────────
  // Bug5: 缩进处理
  // ────────────────────────────────────────────────────────────
  describe('Bug5 修复：4 空格缩进保留代码块语义，不触发意外代码块', () => {
    it('≥4 空格缩进的行应保持预格式内容，而非触发意外代码块渲染', async () => {
      const buf = fixture('03-indented-content.txt')
      const result = await parser.parse(buf, '03-indented-content.txt')
      // 不应把带前置空格的普通段落变成 Markdown 代码块（即行首不多余保留大量前置空格）
      // 至少能找到 "这是有 4 个空格缩进" 的 trimmed 文本
      expect(result).toContain('这是有 4 个空格缩进的段落')
    })

    it('<4 空格缩进的普通段落应按正常段落处理', async () => {
      const buf = fixture('03-indented-content.txt')
      const result = await parser.parse(buf, '03-indented-content.txt')
      expect(result).toContain('这是 3 个空格缩进')
    })
  })

  // ────────────────────────────────────────────────────────────
  // Bug6: 空文件防御
  // ────────────────────────────────────────────────────────────
  describe('Bug6 修复：空文件应抛出 BadRequestException', () => {
    it('完全空文件（0 字节）应抛出异常', async () => {
      const buf = fixture('08-empty.txt')
      await expect(parser.parse(buf, '08-empty.txt')).rejects.toThrow('文件内容为空，无法解析')
    })

    it('仅含空白行的文件应抛出异常', async () => {
      const buf = Buffer.from('   \n\n   \n', 'utf-8')
      await expect(parser.parse(buf, 'whitespace-only.txt')).rejects.toThrow('文件内容为空，无法解析')
    })
  })

  // ────────────────────────────────────────────────────────────
  // .md 文件原样保留
  // ────────────────────────────────────────────────────────────
  describe('.md / .markdown 文件原样保留', () => {
    it('.md 文件应原样输出，不做结构化增强', async () => {
      const mdContent = '# 我的文档\n\n这是**粗体**内容。\n\n- 列表项1\n- 列表项2\n'
      const buf = Buffer.from(mdContent, 'utf-8')
      const result = await parser.parse(buf, 'readme.md')
      expect(result).toContain('**粗体**')
      expect(result).toContain('- 列表项1')
      // 不应额外注入文件名标题
      expect(result).not.toContain('# readme')
    })

    it('.markdown 扩展名也应原样保留', async () => {
      const mdContent = '# Title\n\nSome content.\n'
      const buf = Buffer.from(mdContent, 'utf-8')
      const result = await parser.parse(buf, 'doc.markdown')
      expect(result).toBe('# Title\n\nSome content.')
    })
  })

  // ────────────────────────────────────────────────────────────
  // supportedExtensions
  // ────────────────────────────────────────────────────────────
  describe('supportedExtensions', () => {
    it('应支持 .txt / .md / .markdown', () => {
      expect(parser.supportedExtensions).toEqual(
        expect.arrayContaining(['.txt', '.md', '.markdown']),
      )
    })
  })
})


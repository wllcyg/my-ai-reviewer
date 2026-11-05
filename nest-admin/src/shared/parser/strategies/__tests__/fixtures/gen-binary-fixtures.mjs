/**
 * 生成二进制编码测试文件：
 *   05-gbk.txt       - 真实 GBK 编码（无 BOM）
 *   06-utf16le.txt   - UTF-16 LE 编码（带 BOM，Windows 记事本"Unicode"格式）
 *   07-utf16be.txt   - UTF-16 BE 编码（带 BOM）
 *   08-empty.txt     - 完全空文件（0 字节）
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const content = `第一章 编码测试

本文件用于验证解析器对不同编码格式的自动识别能力。

一、GBK 编码
Windows 记事本默认 GBK，中文内容不应出现乱码。

1.1 预期结果
解析后应正确输出中文字符，不含乱码。
`

// ── 05-gbk.txt：GBK 编码（Node 侧用 iconv-lite 才能严格编码，这里用 latin1 写原始字节模拟）
// 由于运行环境无 iconv-lite，改为写一个标记文件说明手工替换
writeFileSync(
  path.join(__dirname, '05-gbk-readme.txt'),
  'NOTE: 05-gbk.txt 需手动用 Windows 记事本另存为 ANSI(GBK) 编码，或使用 iconv 工具转换。\n'
    + '命令: iconv -f utf-8 -t gbk 05-gbk-source.txt > 05-gbk.txt\n',
  'utf-8',
)

// ── 06-utf16le.txt：UTF-16 LE with BOM
const utf16leContent = Buffer.concat([
  Buffer.from([0xFF, 0xFE]),                        // BOM
  Buffer.from(content, 'utf16le'),
])
writeFileSync(path.join(__dirname, '06-utf16le.txt'), utf16leContent)
console.log('✅ 06-utf16le.txt 已生成 (UTF-16 LE with BOM)')

// ── 07-utf16be.txt：UTF-16 BE with BOM
function toUtf16BE(str) {
  const buf = Buffer.allocUnsafe(str.length * 2)
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    buf[i * 2] = (code >> 8) & 0xFF
    buf[i * 2 + 1] = code & 0xFF
  }
  return buf
}
const utf16beContent = Buffer.concat([
  Buffer.from([0xFE, 0xFF]),                        // BOM
  toUtf16BE(content),
])
writeFileSync(path.join(__dirname, '07-utf16be.txt'), utf16beContent)
console.log('✅ 07-utf16be.txt 已生成 (UTF-16 BE with BOM)')

// ── 08-empty.txt：完全空文件
writeFileSync(path.join(__dirname, '08-empty.txt'), Buffer.alloc(0))
console.log('✅ 08-empty.txt 已生成 (0 bytes)')

// ── 09-utf8-bom.txt：UTF-8 with BOM (EF BB BF)
const utf8BomContent = Buffer.concat([
  Buffer.from([0xEF, 0xBB, 0xBF]),
  Buffer.from(content, 'utf-8'),
])
writeFileSync(path.join(__dirname, '09-utf8-bom.txt'), utf8BomContent)
console.log('✅ 09-utf8-bom.txt 已生成 (UTF-8 with BOM)')

console.log('\n所有二进制测试文件生成完毕。')


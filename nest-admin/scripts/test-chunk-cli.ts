/**
 * Markdown RAG 切块 CLI 调试与人工走查工具
 *
 * 使用方法:
 *   npx tsx scripts/test-chunk-cli.ts <markdown文件路径> [输出json文件路径]
 *
 * 示例:
 *   npx tsx scripts/test-chunk-cli.ts README.md
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { splitMarkdownDocument } from '../src/modules/document/splitter/markdown-splitter.pure'

async function runCli() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error('❌ 请提供 Markdown 文件路径！')
    console.log('用法: npx tsx scripts/test-chunk-cli.ts <file.md> [output.json]')
    process.exit(1)
  }

  const inputPath = path.resolve(process.cwd(), args[0])
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ 文件不存在: ${inputPath}`)
    process.exit(1)
  }

  const content = fs.readFileSync(inputPath, 'utf-8')
  const fileName = path.basename(inputPath)
  const title = path.basename(inputPath, path.extname(inputPath))

  console.log(`\n📄 正在解析 Markdown 文件: ${fileName} (${content.length} 字符)...`)

  const startTime = Date.now()
  const chunks = await splitMarkdownDocument(content, {
    docId: 9999,
    docCode: 'doc_cli_demo',
    title,
    fileName,
    fileType: 'md',
    scope: 'PUBLIC',
    visibleDeptIds: [],
  })
  const cost = Date.now() - startTime

  console.log(`✅ 切块完成！共切出 ${chunks.length} 个语义切片，耗时 ${cost}ms\n`)

  // 简要打印前 3 个 chunk 概览
  chunks.slice(0, 3).forEach((chunk, i) => {
    console.log(`--- [Chunk #${i}] ID: ${chunk.id} (${chunk.metadata.charCount} 字) ---`)
    console.log(`路径: ${chunk.metadata.headingPath.join(' > ')}`)
    console.log(`Oversized: ${chunk.metadata.oversized ? 'YES' : 'NO'}`)
    console.log(`正文摘要:\n${chunk.content.slice(0, 150)}...\n`)
  })

  if (chunks.length > 3) {
    console.log(`... 剩余 ${chunks.length - 3} 个切块已省略 ...\n`)
  }

  // 若指定输出文件，或默认输出到 .temp-chunks.json
  const outputPath = args[1]
    ? path.resolve(process.cwd(), args[1])
    : path.resolve(process.cwd(), 'chunk-output.json')

  fs.writeFileSync(outputPath, JSON.stringify(chunks, null, 2), 'utf-8')
  console.log(`💾 完整结果已保存到: ${outputPath}\n`)
}

runCli().catch((err) => {
  console.error('切块运行失败:', err)
  process.exit(1)
})


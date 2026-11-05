import { Global, Module } from '@nestjs/common'
import { DocParserService } from './doc-parser.service'
import { ExcelParserStrategy } from './strategies/excel.strategy'
import { PdfParserStrategy } from './strategies/pdf.strategy'
import { PptxParserStrategy } from './strategies/pptx.strategy'
import { TextParserStrategy } from './strategies/text.strategy'
import { WordParserStrategy } from './strategies/word.strategy'

const strategies = [
  TextParserStrategy,
  PdfParserStrategy,
  ExcelParserStrategy,
  WordParserStrategy,
  PptxParserStrategy,
]

@Global()
@Module({
  providers: [...strategies, DocParserService],
  exports: [DocParserService],
})
export class ParserModule {}


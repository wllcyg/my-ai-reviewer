import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

export class UpdateDocContentDto {
  @ApiProperty({ description: 'Markdown 全文内容' })
  @IsString()
  @IsNotEmpty({ message: 'Markdown 内容不能为空' })
  markdownContent: string
}


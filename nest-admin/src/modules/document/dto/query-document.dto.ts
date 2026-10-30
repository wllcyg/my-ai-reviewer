import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

import { PagerDto } from '~/common/dto/pager.dto'

export class QueryDocumentDto extends PagerDto {
  @ApiPropertyOptional({ description: '搜索关键字 (匹配标题或文件名)' })
  @IsOptional()
  @IsString()
  keyword?: string

  @ApiPropertyOptional({ description: '文档分类' })
  @IsOptional()
  @IsString()
  category?: string

  @ApiPropertyOptional({ description: '文档状态', enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsString()
  status?: string

  @ApiPropertyOptional({ description: '审批状态', enum: ['INIT', 'AI_REVIEWING', 'MANUAL_REVIEWING', 'APPROVED', 'REJECTED'] })
  @IsOptional()
  @IsString()
  reviewStatus?: string

  @ApiPropertyOptional({ description: '向量化状态', enum: ['unprocessed', 'processing', 'completed', 'failed'] })
  @IsOptional()
  @IsString()
  vectorStatus?: string

  @ApiPropertyOptional({ description: '可见范围', enum: ['PUBLIC', 'DEPT', 'PRIVATE'] })
  @IsOptional()
  @IsString()
  scope?: string
}

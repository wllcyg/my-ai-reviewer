import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

import { PagerDto } from '~/common/dto/pager.dto'
import {
  DocumentScopeEnum,
  DocumentStatusEnum,
  ReviewStatusEnum,
  VectorStatusEnum,
} from '../document.constant'

export class QueryDocumentDto extends PagerDto {
  @ApiPropertyOptional({ description: '搜索关键字 (匹配标题或文件名)' })
  @IsOptional()
  @IsString()
  keyword?: string

  @ApiPropertyOptional({ description: '文档分类' })
  @IsOptional()
  @IsString()
  category?: string

  @ApiPropertyOptional({ description: '文档生命周期状态', enum: DocumentStatusEnum })
  @IsOptional()
  @IsString()
  status?: string

  @ApiPropertyOptional({ description: '审批状态', enum: ReviewStatusEnum })
  @IsOptional()
  @IsString()
  reviewStatus?: string

  @ApiPropertyOptional({ description: '向量化状态', enum: VectorStatusEnum })
  @IsOptional()
  @IsString()
  vectorStatus?: string

  @ApiPropertyOptional({ description: '可见范围', enum: DocumentScopeEnum })
  @IsOptional()
  @IsString()
  scope?: string
}

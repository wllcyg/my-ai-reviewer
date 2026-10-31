import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

import { PagerDto } from '~/common/dto/pager.dto'
import { ApprovalActionEnum, ApprovalNodeTypeEnum } from '../document.constant'

export class QueryApprovalDto extends PagerDto {
  @ApiPropertyOptional({ description: '搜索关键字 (匹配文档标题、业务编码或操作人)' })
  @IsOptional()
  @IsString()
  keyword?: string

  @ApiPropertyOptional({ description: '审批动作', enum: ApprovalActionEnum })
  @IsOptional()
  @IsString()
  action?: string

  @ApiPropertyOptional({ description: '审批节点类型', enum: ApprovalNodeTypeEnum })
  @IsOptional()
  @IsString()
  nodeType?: string

  @ApiPropertyOptional({ description: '关联文档业务编码' })
  @IsOptional()
  @IsString()
  docCode?: string

  @ApiPropertyOptional({ description: '操作起始时间 (YYYY-MM-DD 或 ISO 字符串)' })
  @IsOptional()
  @IsString()
  startDate?: string

  @ApiPropertyOptional({ description: '操作截止时间 (YYYY-MM-DD 或 ISO 字符串)' })
  @IsOptional()
  @IsString()
  endDate?: string
}

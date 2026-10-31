import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString } from 'class-validator'

export enum AuditActionEnum {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class SubmitReviewDto {
  @ApiPropertyOptional({ description: '提交审核备注/说明' })
  @IsOptional()
  @IsString()
  comment?: string
}

export class AuditDocumentDto {
  @ApiProperty({ description: '审核动作: APPROVE 通过, REJECT 驳回', enum: AuditActionEnum })
  @IsEnum(AuditActionEnum)
  action: AuditActionEnum

  @ApiPropertyOptional({ description: '审核意见或驳回原因说明' })
  @IsOptional()
  @IsString()
  comment?: string
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class EnumOptionDto {
  @ApiProperty({ description: '枚举存储值', example: 'APPROVED' })
  value: string

  @ApiProperty({ description: '前端显示标签', example: '审核通过' })
  label: string

  @ApiPropertyOptional({ description: 'UI 语义标签颜色 (Ant Design Tag)', example: 'success' })
  color?: string

  @ApiPropertyOptional({ description: '徽标状态 (Ant Design Badge)', example: 'success' })
  badge?: string

  @ApiPropertyOptional({ description: '业务说明' })
  description?: string
}

export class DocumentMetaDto {
  @ApiProperty({ type: [EnumOptionDto], description: '审批状态列表' })
  reviewStatus: EnumOptionDto[]

  @ApiProperty({ type: [EnumOptionDto], description: '向量化状态列表' })
  vectorStatus: EnumOptionDto[]

  @ApiProperty({ type: [EnumOptionDto], description: '生命周期状态列表' })
  documentStatus: EnumOptionDto[]

  @ApiProperty({ type: [EnumOptionDto], description: '可见范围列表' })
  scope: EnumOptionDto[]

  @ApiProperty({ type: [EnumOptionDto], description: '文档业务分类列表' })
  categories: EnumOptionDto[]
}

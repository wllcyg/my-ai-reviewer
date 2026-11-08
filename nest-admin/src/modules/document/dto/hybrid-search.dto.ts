import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator'

/**
 * 混合检索请求参数
 */
export class HybridSearchDto {
  @ApiProperty({ description: '检索查询词/自然语言问题', example: '差旅住宿报销限额' })
  @IsString({ message: '检索关键词必须为字符串' })
  @Length(1, 500, { message: '检索关键词长度必须在 1 到 500 之间' })
  query: string

  @ApiPropertyOptional({ description: '最终返回的命中命中文档数量 (默认 10，最大 50)', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10

  @ApiPropertyOptional({ description: '单通路召回候选切块数量 (默认 20，最大 100)', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  topKPerRoute?: number = 20

  @ApiPropertyOptional({ description: '限定在特定文档内检索 (可选)' })
  @IsOptional()
  @IsString()
  docCode?: string

  @ApiPropertyOptional({ description: '文档分类过滤 (可选)' })
  @IsOptional()
  @IsString()
  category?: string

  @ApiPropertyOptional({ description: '是否启用二次 Rerank 重排打分 (默认 true)', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  enableRerank?: boolean = true

  @ApiPropertyOptional({ description: '向量路 RRF 融合权重 (默认 1.0)', default: 1.0 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  vectorWeight?: number = 1.0

  @ApiPropertyOptional({ description: 'ES/全文检索路 RRF 融合权重 (默认 0.8)', default: 0.8 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  esWeight?: number = 0.8
}

/**
 * 命中文档内部的具体切块证据项
 */
export class HitDocumentChunkDto {
  @ApiProperty({ description: '切块唯一ID: `${docCode}_${chunkIndex}`' })
  chunkId: string

  @ApiProperty({ description: '切块序号' })
  chunkIndex: number

  @ApiProperty({ description: '面包屑标题路径，如 "第三章 差旅住宿 > 3.2 房费限额"' })
  headingPath: string

  @ApiProperty({ description: '切块正文' })
  content: string

  @ApiProperty({ description: 'RRF 融合得分 (0 ~ 1)' })
  score: number

  @ApiPropertyOptional({ description: '二次 Rerank 精排得分 (0 ~ 1)' })
  rerankScore?: number

  @ApiProperty({ description: '命中的召回源: VECTOR (向量) / ES (全文检索)', enum: ['VECTOR', 'ES'], isArray: true })
  matchedSources: ('VECTOR' | 'ES')[]

  @ApiPropertyOptional({ description: '关键词高亮片段 (ES 提供)' })
  highlights?: {
    title?: string[]
    headingPath?: string[]
    content?: string[]
  }
}

/**
 * 最终命中的文档模型
 */
export class HitDocumentDto {
  @ApiProperty({ description: '文档业务编码' })
  docCode: string

  @ApiProperty({ description: '文档标题' })
  title: string

  @ApiProperty({ description: '文档分类' })
  category: string

  @ApiProperty({ description: '可见范围: PUBLIC / DEPT / PRIVATE' })
  scope: string

  @ApiProperty({ description: '原始文件名' })
  fileName: string

  @ApiProperty({ description: '文件大小(字节)' })
  fileSize: number

  @ApiProperty({ description: '文件格式' })
  fileType: string

  @ApiProperty({ description: '文档状态: DRAFT / UNDER_REVIEW / PUBLISHED / ARCHIVED' })
  status: string

  @ApiPropertyOptional({ description: '文档公有/预览访问地址' })
  publicUrl?: string

  @ApiPropertyOptional({ description: 'AI审核得分' })
  reviewScore?: number

  @ApiProperty({ description: '文档综合相关性得分 (0.0 ~ 1.0)' })
  score: number

  @ApiProperty({ description: '命中召回通路集合', enum: ['VECTOR', 'ES'], isArray: true })
  matchedSources: ('VECTOR' | 'ES')[]

  @ApiProperty({ description: '最相关的证明切片列表 (Top 证据块)', type: [HitDocumentChunkDto] })
  chunks: HitDocumentChunkDto[]
}

/**
 * 混合检索统一响应
 */
export class HybridSearchResponseDto {
  @ApiProperty({ description: '命中的相关文档列表 (按相关性得分降序)', type: [HitDocumentDto] })
  items: HitDocumentDto[]

  @ApiProperty({ description: '命中总文档数' })
  total: number

  @ApiProperty({ description: '检索耗时 (ms)' })
  costMs: number

  @ApiProperty({ description: '原始查询词' })
  query: string
}


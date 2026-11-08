import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator'

/**
 * 历史上下文对话项
 */
export class ChatHistoryItemDto {
  @ApiProperty({ description: '角色: user 或 assistant', enum: ['user', 'assistant'] })
  @IsEnum(['user', 'assistant'], { message: '角色必须为 user 或 assistant' })
  role: 'user' | 'assistant'

  @ApiProperty({ description: '消息内容' })
  @IsString()
  @IsNotEmpty()
  content: string
}

/**
 * 知识库智能问答请求体
 */
export class DocumentChatDto {
  @ApiProperty({ description: '用户提问内容/自然语言查询', example: '一类城市出差房费限额每天是多少？' })
  @IsString({ message: '提问内容必须为字符串' })
  @Length(1, 1000, { message: '提问内容长度在 1 到 1000 字之间' })
  query: string

  @ApiPropertyOptional({ description: '多轮对话历史上下文记录', type: [ChatHistoryItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  history?: ChatHistoryItemDto[]

  @ApiPropertyOptional({ description: '限定在特定文档内问答 (可选)' })
  @IsOptional()
  @IsString()
  docCode?: string

  @ApiPropertyOptional({ description: '限定在特定业务分类下问答 (可选)' })
  @IsOptional()
  @IsString()
  category?: string
}

/**
 * 引用溯源出处
 */
export class CitationItemDto {
  @ApiProperty({ description: '引用来源文档编码' })
  docCode: string

  @ApiProperty({ description: '引用来源文档标题' })
  title: string

  @ApiPropertyOptional({ description: '大纲章节面包屑路径' })
  headingPath?: string

  @ApiProperty({ description: '语义匹配置信度 (0.0 ~ 1.0)' })
  score: number

  @ApiProperty({ description: '原文证明片段摘要' })
  snippet: string
}

/**
 * 知识库智能问答响应体
 */
export class DocumentChatResponseDto {
  @ApiProperty({ description: 'AI 生成的规范 Markdown 格式回答' })
  answer: string

  @ApiProperty({ description: '参考知识库来源切片 (用于前端点击溯源)', type: [CitationItemDto] })
  citations: CitationItemDto[]

  @ApiProperty({ description: '端到端总耗时 (ms)' })
  costMs: number
}


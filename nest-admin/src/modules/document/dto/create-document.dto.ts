import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

import { DocumentScopeEnum } from '../document.constant'
import type { DocumentScope } from '../document.entity'

export class CreateDocumentDto {
  @ApiProperty({ description: '文档标题', example: '2026年企业研发规范与合规指南' })
  @IsString({ message: '标题必须是字符串' })
  @IsNotEmpty({ message: '文档标题不能为空' })
  @MaxLength(255, { message: '标题长度不能超过 255 个字符' })
  title: string

  @ApiPropertyOptional({ description: '文档分类', example: '研发制度' })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: '分类长度不能超过 50 个字符' })
  category?: string

  @ApiProperty({ description: '原始文件名', example: '研发规范.pdf' })
  @IsString({ message: '文件名必须是字符串' })
  @IsNotEmpty({ message: '文件名不能为空' })
  @MaxLength(255, { message: '文件名长度不能超过 255 个字符' })
  fileName: string

  @ApiProperty({ description: '文件大小(字节)', example: 204800 })
  @IsInt({ message: '文件大小必须为整数' })
  @Min(1, { message: '文件大小不能为 0' })
  @Max(50 * 1024 * 1024, { message: '文件大小不能超过 50MB' })
  fileSize: number

  @ApiProperty({ description: '文件格式或扩展名', example: 'pdf' })
  @IsString({ message: '文件类型必须是字符串' })
  @IsNotEmpty({ message: '文件类型不能为空' })
  @MaxLength(50)
  fileType: string

  @ApiProperty({ description: 'R2 存储路径 StorageKey', example: 'knowledge/docs/20261030/doc_xxx.pdf' })
  @IsString({ message: '存储Key必须是字符串' })
  @IsNotEmpty({ message: '存储Key不能为空' })
  @MaxLength(500)
  storageKey: string

  @ApiPropertyOptional({ description: '文档访问公共URL' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  publicUrl?: string

  @ApiPropertyOptional({ description: '可见范围', enum: DocumentScopeEnum, default: DocumentScopeEnum.PUBLIC })
  @IsOptional()
  @IsIn([DocumentScopeEnum.PUBLIC, DocumentScopeEnum.DEPT, DocumentScopeEnum.PRIVATE], { message: '可见范围必须为 PUBLIC/DEPT/PRIVATE' })
  scope?: DocumentScope

  @ApiPropertyOptional({ description: '指定可见部门ID列表', type: [Number] })
  @IsOptional()
  @IsArray({ message: '可见部门ID列表必须是数组' })
  @IsInt({ each: true, message: '部门ID必须是整数' })
  visibleDeptIds?: number[]

  @ApiPropertyOptional({ description: '指定可见部门名称列表', type: [String] })
  @IsOptional()
  @IsArray({ message: '可见部门名称列表必须是数组' })
  @IsString({ each: true, message: '部门名称必须是字符串' })
  visibleDeptNames?: string[]
}

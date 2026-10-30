import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator'

export class GenerateUploadSignDto {
  @ApiProperty({ description: '原始文件名 (含后缀，如：规范手册.pdf)', example: '财务报销规范.pdf' })
  @IsString({ message: '文件名必须是字符串' })
  @IsNotEmpty({ message: '文件名不能为空' })
  fileName: string

  @ApiProperty({ description: '文件大小 (字节，最大 50MB)', example: 102400 })
  @IsInt({ message: '文件大小必须为整数 (字节)' })
  @Min(1, { message: '文件大小不能为 0' })
  @Max(50 * 1024 * 1024, { message: '文件大小不能超过 50MB' })
  fileSize: number

  @ApiProperty({ description: '文件 MIME 类型', example: 'application/pdf' })
  @IsString({ message: 'MIME 类型必须是字符串' })
  @IsNotEmpty({ message: 'MIME 类型不能为空' })
  contentType: string

  @ApiPropertyOptional({ description: '文档分类', example: '财务制度' })
  @IsOptional()
  @IsString()
  category?: string

  @ApiPropertyOptional({ description: '可见范围', enum: ['PUBLIC', 'DEPT', 'PRIVATE'], example: 'PUBLIC' })
  @IsOptional()
  @IsString()
  scope?: string
}

export class UploadSignResultDto {
  @ApiProperty({ description: 'Cloudflare R2 预签名上传 URL (前端使用 HTTP PUT 直传)' })
  uploadUrl: string

  @ApiProperty({ description: '文件在 R2 存储桶中的唯一存储 Key' })
  storageKey: string

  @ApiProperty({ description: '文件的公网/加速访问地址' })
  publicUrl: string

  @ApiProperty({ description: '签名凭证有效时间 (秒)', example: 900 })
  expiresIn: number
}

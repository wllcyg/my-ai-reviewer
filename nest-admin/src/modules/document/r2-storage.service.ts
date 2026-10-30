import path from 'node:path'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'
import { nanoid } from 'nanoid'
import { IR2Config, R2Config } from '~/config/r2.config'
import { GenerateUploadSignDto, UploadSignResultDto } from './dto/upload-sign.dto'

// 知识库允许上传的常用文件类型
export const ALLOWED_DOC_EXTENSIONS = ['.pdf', '.doc', '.docx', '.md', '.txt', '.markdown']

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name)
  private s3Client: S3Client | null = null

  constructor(
    @Inject(R2Config.KEY) private readonly r2Config: IR2Config,
  ) {
    this.initS3Client()
  }

  /**
   * 初始化 Cloudflare R2 S3 客户端
   */
  private initS3Client() {
    if (!this.r2Config.accountId || !this.r2Config.accessKeyId || !this.r2Config.secretAccessKey) {
      this.logger.warn('Cloudflare R2 凭据未完整配置，请在 .env 中设置 R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY')
      return
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.r2Config.endpoint,
      credentials: {
        accessKeyId: this.r2Config.accessKeyId,
        secretAccessKey: this.r2Config.secretAccessKey,
      },
    })
  }

  /**
   * 确保客户端可用
   */
  private ensureClient(): S3Client {
    if (!this.s3Client) {
      this.initS3Client()
    }
    if (!this.s3Client) {
      throw new BadRequestException('Cloudflare R2 存储服务尚未配置凭证，请联系管理员配置 R2 环境变量')
    }
    return this.s3Client
  }

  /**
   * 生成前端直传 Cloudflare R2 的预签名 PUT URL
   * @param dto 上传请求参数
   * @param userId 上传者用户 ID
   * @param expiresIn 有效期秒数，默认 900 秒 (15分钟)
   */
  async generatePresignedPutUrl(
    dto: GenerateUploadSignDto,
    userId: number,
    expiresIn = 900,
  ): Promise<UploadSignResultDto> {
    const client = this.ensureClient()
    const { fileName, fileSize, contentType, category = 'default', scope = 'PUBLIC' } = dto

    // 1. 扩展名白名单校验
    const ext = path.extname(fileName).toLowerCase()
    if (!ALLOWED_DOC_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`不支持的文件格式 [${ext}]，仅允许上传 PDF、Word、Markdown、TXT 格式文档`)
    }

    // 2. 规范化文件唯一存储路径：knowledge/docs/{yyyyMMdd}/{nanoid}{ext}
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const fileId = nanoid(16)
    const storageKey = `knowledge/docs/${dateStr}/${fileId}${ext}`

    // 3. 构建 PutObjectCommand 指令
    const command = new PutObjectCommand({
      Bucket: this.r2Config.bucket,
      Key: storageKey,
      ContentType: contentType,
      ContentLength: fileSize,
      Metadata: {
        originalname: encodeURIComponent(fileName),
        uploadedby: String(userId),
        category: encodeURIComponent(category),
        scope,
      },
    })

    // 4. 生成带有时效签名的 PUT URL
    const uploadUrl = await getSignedUrl(client, command, { expiresIn })

    // 5. 计算文件访问地址 (优先走自定义域名，无自定义域名则走 R2 桶地址)
    const publicUrl = this.r2Config.publicDomain
      ? `${this.r2Config.publicDomain.replace(/\/$/, '')}/${storageKey}`
      : `${this.r2Config.endpoint.replace(/\/$/, '')}/${this.r2Config.bucket}/${storageKey}`

    return {
      uploadUrl,
      storageKey,
      publicUrl,
      expiresIn,
    }
  }

  /**
   * 生成文档下载/预览的预签名 GET URL (适用于私密文档)
   */
  async generatePresignedGetUrl(storageKey: string, expiresIn = 3600): Promise<string> {
    const client = this.ensureClient()
    const command = new GetObjectCommand({
      Bucket: this.r2Config.bucket,
      Key: storageKey,
    })
    return getSignedUrl(client, command, { expiresIn })
  }

  /**
   * 删除 R2 中的文件
   */
  async deleteFile(storageKey: string): Promise<void> {
    const client = this.ensureClient()
    const command = new DeleteObjectCommand({
      Bucket: this.r2Config.bucket,
      Key: storageKey,
    })
    await client.send(command)
  }
}

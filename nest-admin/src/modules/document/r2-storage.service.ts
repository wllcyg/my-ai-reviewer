import path from 'node:path'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { nanoid } from 'nanoid'
import { IR2Config, R2Config } from '~/config/r2.config'
import {
  GenerateUploadSignDto,
  UploadSignResultDto,
} from './dto/upload-sign.dto'

// 知识库允许上传的常用文件类型
export const ALLOWED_DOC_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.md',
  '.txt',
  '.markdown',
]

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name)
  private s3Client: S3Client | null = null

  constructor(@Inject(R2Config.KEY) private readonly r2Config: IR2Config) {
    this.initS3Client()
  }

  /**
   * 初始化 Cloudflare R2 S3 客户端
   */
  private initS3Client() {
    if (
      !this.r2Config.accountId
      || !this.r2Config.accessKeyId
      || !this.r2Config.secretAccessKey
    ) {
      this.logger.warn(
        'Cloudflare R2 凭据未完整配置，请在 .env 中设置 R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY',
      )
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
      throw new BadRequestException(
        'Cloudflare R2 存储服务尚未配置凭证，请联系管理员配置 R2 环境变量',
      )
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
    const {
      fileName,
      fileSize,
      contentType,
      category = 'default',
      scope = 'PUBLIC',
    } = dto

    // 1. 扩展名白名单校验
    const ext = path.extname(fileName).toLowerCase()
    if (!ALLOWED_DOC_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `不支持的文件格式 [${ext}]，仅允许上传 PDF、Word、Markdown、TXT 格式文档`,
      )
    }

    // 2. 规范化文件唯一存储路径：knowledge/docs/{yyyyMMdd}/{userId}/{nanoid}{ext}
    //    userId 写入路径，落库时据此校验 storageKey 确由当前用户签发
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const fileId = nanoid(16)
    const storageKey = `knowledge/docs/${dateStr}/${userId}/${fileId}${ext}`

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

    return {
      uploadUrl,
      storageKey,
      publicUrl: this.buildPublicUrl(storageKey),
      expiresIn,
    }
  }

  /**
   * 计算文件访问地址 (优先走自定义域名，无自定义域名则走 R2 桶地址)
   */
  buildPublicUrl(storageKey: string): string {
    return this.r2Config.publicDomain
      ? `${this.r2Config.publicDomain.replace(/\/$/, '')}/${storageKey}`
      : `${this.r2Config.endpoint.replace(/\/$/, '')}/${this.r2Config.bucket}/${storageKey}`
  }

  /**
   * 校验客户端提交的 storageKey：
   * 1. 必须符合签发格式且路径中的 userId 等于当前用户（防止引用他人或任意文件）
   * 2. 文件必须已真实上传到 R2，且大小与声明一致
   */
  async verifyUploadedObject(
    storageKey: string,
    userId: number,
    expectedSize: number,
  ): Promise<void> {
    const exts = ALLOWED_DOC_EXTENSIONS.map(e => e.replace('.', '\\.')).join(
      '|',
    )
    const keyPattern = new RegExp(
      `^knowledge/docs/\\d{8}/${Number(userId)}/[\\w-]{16}(${exts})$`,
    )
    if (!keyPattern.test(storageKey)) {
      throw new ForbiddenException(
        '存储 Key 非法或不属于当前用户，请重新获取上传签名',
      )
    }

    const client = this.ensureClient()
    try {
      const head = await client.send(
        new HeadObjectCommand({
          Bucket: this.r2Config.bucket,
          Key: storageKey,
        }),
      )
      if (head.ContentLength !== expectedSize) {
        throw new BadRequestException(
          `文件大小与声明不一致 (声明 ${expectedSize}，实际 ${head.ContentLength ?? 0})`,
        )
      }
    }
    catch (err: any) {
      if (err instanceof BadRequestException) {
        throw err
      }
      if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
        throw new BadRequestException(
          '文件尚未上传到存储服务，请确认直传成功后再提交',
        )
      }
      this.logger.error(`校验 R2 文件失败: ${storageKey}`, err)
      throw new InternalServerErrorException('校验存储文件失败，请稍后重试')
    }
  }

  /**
   * 生成文档下载/预览的预签名 GET URL (适用于私密文档)
   */
  async generatePresignedGetUrl(
    storageKey: string,
    expiresIn = 3600,
  ): Promise<string> {
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

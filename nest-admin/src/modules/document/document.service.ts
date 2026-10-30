import { Injectable, Logger } from '@nestjs/common'
import { GenerateUploadSignDto, UploadSignResultDto } from './dto/upload-sign.dto'
import { R2StorageService } from './r2-storage.service'

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name)

  constructor(
    private readonly r2StorageService: R2StorageService,
  ) {}

  /**
   * 为文档直传获取预签名凭据
   */
  async getUploadSignature(dto: GenerateUploadSignDto, userId: number): Promise<UploadSignResultDto> {
    this.logger.log(`用户 [${userId}] 请求上传签名: ${dto.fileName} (${dto.fileSize} bytes)`)
    return this.r2StorageService.generatePresignedPutUrl(dto, userId)
  }

  /**
   * 获取私密文档的授权访问链接
   */
  async getDocumentAccessUrl(storageKey: string): Promise<string> {
    return this.r2StorageService.generatePresignedGetUrl(storageKey)
  }
}

import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { generateUUID } from '~/utils'

import { DocumentApprovalEntity } from './document-approval.entity'
import { DocumentEntity } from './document.entity'
import { CreateDocumentDto } from './dto/create-document.dto'
import { QueryDocumentDto } from './dto/query-document.dto'
import { GenerateUploadSignDto, UploadSignResultDto } from './dto/upload-sign.dto'
import { R2StorageService } from './r2-storage.service'

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name)

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly docRepo: Repository<DocumentEntity>,
    @InjectRepository(DocumentApprovalEntity)
    private readonly approvalRepo: Repository<DocumentApprovalEntity>,
    private readonly r2StorageService: R2StorageService,
  ) {}

  /**
   * 清理过滤文件名中的危险字符，防范 XSS 和路径穿越
   */
  private sanitizeFileName(name: string): string {
    return (name || '').replace(/[<>"'/\\;`|*?~]/g, '_').trim()
  }

  /**
   * 为文档直传获取预签名凭据
   */
  async getUploadSignature(dto: GenerateUploadSignDto, userId: number): Promise<UploadSignResultDto> {
    this.logger.log(`用户 [${userId}] 请求上传签名: ${dto.fileName} (${dto.fileSize} bytes)`)
    return this.r2StorageService.generatePresignedPutUrl(dto, userId)
  }

  /**
   * 文档直传 R2 成功后落库，并生成首条审批流记录
   */
  async create(dto: CreateDocumentDto, user: IAuthUser): Promise<DocumentEntity> {
    const docCode = `doc_${generateUUID(16)}`
    const cleanFileName = this.sanitizeFileName(dto.fileName)

    const doc = this.docRepo.create({
      docCode,
      title: dto.title,
      category: dto.category,
      fileName: cleanFileName,
      fileSize: dto.fileSize,
      fileType: dto.fileType,
      storageKey: dto.storageKey,
      publicUrl: dto.publicUrl,
      scope: dto.scope || 'PUBLIC',
      visibleDeptIds: dto.visibleDeptIds || [],
      visibleDeptNames: dto.visibleDeptNames || [],
      status: 'PUBLISHED',
      reviewStatus: 'APPROVED', // 现阶段默认通过，后续接 AI 自动评审
      vectorStatus: 'unprocessed',
      createBy: user.uid,
      updateBy: user.uid,
    })

    const savedDoc = await this.docRepo.save(doc)

    // 记录首条审批流转记录
    const initialApproval = this.approvalRepo.create({
      docId: savedDoc.id,
      docCode: savedDoc.docCode,
      nodeType: 'SUBMIT',
      action: 'SUBMIT',
      operatorId: user.uid,
      operatorName: '提交人',
      comment: '文档直传成功并提交归档',
      snapshotStatus: savedDoc.reviewStatus,
    })
    await this.approvalRepo.save(initialApproval)

    this.logger.log(`文档创建成功: ${savedDoc.title} (${savedDoc.docCode}), 创建者: ${user.uid}`)
    return savedDoc
  }

  /**
   * 分页获取文档列表（含多维度过滤与基础数据权限隔离）
   */
  async findAll(dto: QueryDocumentDto, user: IAuthUser): Promise<{ items: DocumentEntity[]; total: number }> {
    const { page = 1, pageSize = 10, keyword, category, status, reviewStatus, vectorStatus, scope } = dto

    const qb = this.docRepo.createQueryBuilder('doc')

    // 1. 关键字模糊搜索（标题或原始文件名）
    if (keyword) {
      qb.andWhere('(doc.title LIKE :kw OR doc.file_name LIKE :kw)', { kw: `%${keyword.trim()}%` })
    }

    // 2. 分类过滤
    if (category) {
      qb.andWhere('doc.category = :category', { category })
    }

    // 3. 文档生命周期状态过滤
    if (status) {
      qb.andWhere('doc.status = :status', { status })
    }

    // 4. 审核流状态过滤
    if (reviewStatus) {
      qb.andWhere('doc.review_status = :reviewStatus', { reviewStatus })
    }

    // 5. 向量化状态过滤
    if (vectorStatus) {
      qb.andWhere('doc.vector_status = :vectorStatus', { vectorStatus })
    }

    // 6. 可见范围过滤
    if (scope) {
      qb.andWhere('doc.scope = :scope', { scope })
    }

    // 7. 数据权限过滤：非超管普通用户仅能查看公开文档、自己创建的私有文档
    const isAdmin = user.roles && (user.roles.includes('admin') || user.roles.includes('super_admin'))
    if (!isAdmin) {
      qb.andWhere('(doc.scope = :pubScope OR (doc.scope = :privScope AND doc.create_by = :uid))', {
        pubScope: 'PUBLIC',
        privScope: 'PRIVATE',
        uid: user.uid,
      })
    }

    // 按创建时间倒序排列
    qb.orderBy('doc.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)

    const [items, total] = await qb.getManyAndCount()
    return { items, total }
  }

  /**
   * 根据业务编码获取文档详情及历史审批轨迹
   */
  async findByCode(code: string): Promise<{ document: DocumentEntity; approvalHistory: DocumentApprovalEntity[] }> {
    const document = await this.docRepo.findOne({ where: { docCode: code } })
    if (!document) {
      throw new NotFoundException(`未找到业务编码为 ${code} 的文档`)
    }

    const approvalHistory = await this.approvalRepo.find({
      where: { docCode: code },
      order: { createdAt: 'ASC' },
    })

    return { document, approvalHistory }
  }

  /**
   * 根据业务编码删除文档，并同步删除 R2 物理存储文件
   */
  async deleteByCode(code: string, user: IAuthUser): Promise<void> {
    const document = await this.docRepo.findOne({ where: { docCode: code } })
    if (!document) {
      throw new NotFoundException(`未找到业务编码为 ${code} 的文档`)
    }

    const isAdmin = user.roles && (user.roles.includes('admin') || user.roles.includes('super_admin'))
    if (!isAdmin && document.createBy !== user.uid) {
      throw new ForbiddenException('您无权删除他人创建的文档')
    }

    // 1. 删除 R2 物理文件
    if (document.storageKey) {
      try {
        await this.r2StorageService.deleteFile(document.storageKey)
        this.logger.log(`R2 物理文件删除成功: ${document.storageKey}`)
      } catch (err) {
        this.logger.error(`删除 R2 物理文件异常: ${document.storageKey}`, err)
      }
    }

    // 2. 删除审批记录
    await this.approvalRepo.delete({ docCode: code })

    // 3. 删除主表记录
    await this.docRepo.delete({ docCode: code })

    this.logger.log(`文档 [${code}] 已被用户 [${user.uid}] 彻底移除`)
  }

  /**
   * 获取私密文档的授权访问链接
   */
  async getDocumentAccessUrl(storageKey: string): Promise<string> {
    return this.r2StorageService.generatePresignedGetUrl(storageKey)
  }
}

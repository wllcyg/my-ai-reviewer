import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, QueryFailedError, Repository } from 'typeorm'

import { generateUUID } from '~/utils'

import { DocumentApprovalEntity } from '../document-approval.entity'
import {
  ApprovalActionEnum,
  ApprovalNodeTypeEnum,
  DocumentScopeEnum,
  DocumentStatusEnum,
  ReviewStatusEnum,
  VectorStatusEnum,
} from '../document.constant'
import { DocumentEntity } from '../document.entity'
import { CreateDocumentDto } from '../dto/create-document.dto'
import { QueryDocumentDto } from '../dto/query-document.dto'
import {
  GenerateUploadSignDto,
  UploadSignResultDto,
} from '../dto/upload-sign.dto'
import { R2StorageService } from '../r2-storage.service'
import { DocumentApprovalService } from './document-approval.service'
import { lockDocumentByCode } from './document-lock.util'
import { DocumentPermissionService } from './document-permission.service'

/**
 * 文档主流程：创建、查询、删除，以及与对象存储相关的签名与访问链接
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name)

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly docRepo: Repository<DocumentEntity>,
    private readonly r2StorageService: R2StorageService,
    private readonly permission: DocumentPermissionService,
    private readonly approvalService: DocumentApprovalService,
  ) {}

  /**
   * 清理过滤文件名中的危险字符，防范 XSS 和路径穿越
   */
  private sanitizeFileName(name: string): string {
    return (name || '').replace(/[<>"'/\\;`|*?~]/g, '_').trim()
  }

  /**
   * 在事务中落库新文档，并把 storageKey 唯一索引冲突转为友好提示
   */
  private async saveNewDocument(
    work: (manager: EntityManager) => Promise<DocumentEntity>,
  ): Promise<DocumentEntity> {
    try {
      return await this.docRepo.manager.transaction(work)
    }
    catch (err) {
      if (
        err instanceof QueryFailedError
        && (err.driverError as { code?: string })?.code === 'ER_DUP_ENTRY'
      ) {
        throw new BadRequestException('该文件已被关联到其他文档，不可重复提交')
      }
      throw err
    }
  }

  /**
   * 为文档直传获取预签名凭据
   */
  async getUploadSignature(
    dto: GenerateUploadSignDto,
    userId: number,
  ): Promise<UploadSignResultDto> {
    this.logger.log(
      `用户 [${userId}] 请求上传签名: ${dto.fileName} (${dto.fileSize} bytes)`,
    )
    return this.r2StorageService.generatePresignedPutUrl(dto, userId)
  }

  /**
   * 文档直传 R2 成功后落库，并生成首条审批流记录（同一事务）
   */
  async create(
    dto: CreateDocumentDto,
    user: IAuthUser,
  ): Promise<DocumentEntity> {
    // 校验 storageKey 确由当前用户签发、文件已真实上传且大小一致，防止引用他人或伪造的文件
    await this.r2StorageService.verifyUploadedObject(
      dto.storageKey,
      user.uid,
      dto.fileSize,
    )

    const docCode = `doc_${generateUUID(16)}`
    const cleanFileName = this.sanitizeFileName(dto.fileName)

    const savedDoc = await this.saveNewDocument(async (manager) => {
      const doc = await manager.save(
        manager.create(DocumentEntity, {
          docCode,
          title: dto.title,
          category: dto.category,
          fileName: cleanFileName,
          fileSize: dto.fileSize,
          fileType: dto.fileType,
          storageKey: dto.storageKey,
          // 访问地址由服务端根据 storageKey 生成，不信任客户端传值
          publicUrl: this.r2StorageService.buildPublicUrl(dto.storageKey),
          scope: dto.scope || DocumentScopeEnum.PUBLIC,
          visibleDeptIds: dto.visibleDeptIds || [],
          visibleDeptNames: dto.visibleDeptNames || [],
          status: DocumentStatusEnum.DRAFT, // 初始为草稿状态
          reviewStatus: ReviewStatusEnum.INIT, // 审批流初始为待提交/草稿
          vectorStatus: VectorStatusEnum.UNPROCESSED,
          createBy: user.uid,
          updateBy: user.uid,
        }),
      )

      // 记录首条审批流转记录
      await this.approvalService.appendRecord(manager, {
        doc,
        nodeType: ApprovalNodeTypeEnum.SUBMIT,
        action: ApprovalActionEnum.SUBMIT,
        user,
        operatorName: '提交人',
        comment: '文档直传成功并生成草稿，待提交走查',
        snapshotStatus: doc.reviewStatus,
      })

      return doc
    })

    this.logger.log(
      `文档创建成功: ${savedDoc.title} (${savedDoc.docCode}), 创建者: ${user.uid}`,
    )
    return savedDoc
  }

  /**
   * 分页获取文档列表（含多维度过滤与基础数据权限隔离）
   */
  async findAll(
    dto: QueryDocumentDto,
    user: IAuthUser,
  ): Promise<{ items: DocumentEntity[], total: number }> {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      category,
      status,
      reviewStatus,
      vectorStatus,
      scope,
    } = dto

    const qb = this.docRepo.createQueryBuilder('doc')

    // 1. 关键字模糊搜索（标题或原始文件名）
    if (keyword) {
      qb.andWhere('(doc.title LIKE :kw OR doc.file_name LIKE :kw)', {
        kw: `%${keyword.trim()}%`,
      })
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

    // 7. 数据权限过滤
    this.permission.applyVisibilityFilter(qb, user)

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
  async findByCode(
    code: string,
    user: IAuthUser,
  ): Promise<{
      document: DocumentEntity
      approvalHistory: DocumentApprovalEntity[]
    }> {
    const document = await this.docRepo.findOne({ where: { docCode: code } })
    if (!document) {
      throw new NotFoundException(`未找到业务编码为 ${code} 的文档`)
    }
    if (!this.permission.canAccessDocument(document, user)) {
      throw new ForbiddenException('您无权查看该文档')
    }

    const approvalHistory = await this.approvalService.findHistoryByCode(code)
    return { document, approvalHistory }
  }

  /**
   * 根据业务编码删除文档及审批记录（同一事务），提交成功后再清理 R2 物理文件
   */
  async deleteByCode(code: string, user: IAuthUser): Promise<void> {
    const storageKey = await this.docRepo.manager.transaction(
      async (manager) => {
        const document = await lockDocumentByCode(manager, code)

        if (
          !this.permission.isAdmin(user)
          && !this.permission.isOwner(document, user)
        ) {
          throw new ForbiddenException('您无权删除他人创建的文档')
        }

        await this.approvalService.deleteByDocCode(manager, code)
        await manager.delete(DocumentEntity, { docCode: code })

        return document.storageKey
      },
    )

    // 数据库删除成功后再删 R2：失败只会遗留孤儿文件，不会出现"记录还在但文件已丢"
    if (storageKey) {
      try {
        await this.r2StorageService.deleteFile(storageKey)
        this.logger.log(`R2 物理文件删除成功: ${storageKey}`)
      }
      catch (err) {
        this.logger.error(
          `删除 R2 物理文件异常，需人工清理孤儿文件: ${storageKey}`,
          err,
        )
      }
    }

    this.logger.log(`文档 [${code}] 已被用户 [${user.uid}] 彻底移除`)
  }

  /**
   * 获取私密文档的授权访问链接
   */
  async getDocumentAccessUrl(
    storageKey: string,
    user: IAuthUser,
  ): Promise<string> {
    const document = await this.docRepo.findOne({ where: { storageKey } })
    if (!document) {
      throw new NotFoundException('未找到对应的文档')
    }
    if (!this.permission.canAccessDocument(document, user)) {
      throw new ForbiddenException('您无权访问该文档')
    }
    return this.r2StorageService.generatePresignedGetUrl(storageKey)
  }
}

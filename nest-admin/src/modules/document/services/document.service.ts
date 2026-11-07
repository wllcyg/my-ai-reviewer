import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { EntityManager, QueryFailedError, Repository } from 'typeorm'

import { DocContentService } from '~/shared/mongo/services/doc-content.service'
import { OpenSearchService } from '~/shared/opensearch/opensearch.service'
import { DocParserService } from '~/shared/parser/doc-parser.service'
import { VectorService } from '~/shared/vector/vector.service'
import { DocumentPipelinePublisher } from '~/mq/document-pipeline.publisher'
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
import { DocumentIndexTaskService } from './document-index-task.service'
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
    private readonly docParserService: DocParserService,
    private readonly docContentService: DocContentService,
    private readonly docPublisher: DocumentPipelinePublisher,
    private readonly indexTaskService: DocumentIndexTaskService,
    private readonly vectorService: VectorService,
    private readonly openSearchService: OpenSearchService,
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

    // 🌟 异步触发自动解析流并持久化至 MongoDB (不阻塞本次上传请求响应)
    this.asyncParseAndSaveContent(savedDoc).catch((err) => {
      this.logger.error(`[触发异步解析失败] docCode=${savedDoc.docCode}: ${err.message}`)
    })

    return savedDoc
  }

  /**
   * 异步执行文档解析并持久化至 MongoDB (容错闭环)
   */
  async asyncParseAndSaveContent(doc: DocumentEntity): Promise<void> {
    const { docCode, id: docId, storageKey, fileType, fileName } = doc

    try {
      this.logger.log(`[自动解析流] 开始拉取并解析文档: ${docCode} (${fileName})`)

      // 1. 更新 MySQL 状态为解析中
      await this.docRepo.update(docId, {
        vectorStatus: VectorStatusEnum.PROCESSING,
      })

      // 2. 从 R2 流式下载为内存 Buffer
      const buffer = await this.r2StorageService.downloadBuffer(storageKey)

      // 3. 策略路由：自动解析为标准 Markdown
      const markdown = await this.docParserService.parseToMarkdown(buffer, fileType, fileName)

      // 4. 存入 MongoDB doc_contents 集合
      await this.docContentService.saveContent(docCode, docId, markdown)

      // 5. 更新 MySQL 状态为待发布 (未向量化)
      await this.docRepo.update(docId, {
        vectorStatus: VectorStatusEnum.UNPROCESSED,
      })

      this.logger.log(`[自动解析流] 文档 ${docCode} 已成功转换为 Markdown 并写入 MongoDB`)
    }
    catch (err: any) {
      this.logger.error(`[自动解析流] 解析失败: docCode=${docCode}: ${err.message}`, err.stack)

      // 容错处理：标记为解析失败，并记录具体原因供前台 Tooltip 展示
      await this.docRepo.update(docId, {
        vectorStatus: VectorStatusEnum.FAILED,
        reviewRemark: `解析失败: ${err.message || '文件损坏或格式受损'}`,
      })
    }
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
   * 根据业务编码软删除文档（保留 R2 静态原件和 MongoDB Markdown，仅业务侧屏蔽）
   */
  async deleteByCode(code: string, user: IAuthUser): Promise<void> {
    await this.docRepo.manager.transaction(async (manager) => {
      const document = await lockDocumentByCode(manager, code)

      if (
        !this.permission.isAdmin(user)
        && !this.permission.isOwner(document, user)
      ) {
        throw new ForbiddenException('您无权删除他人创建的文档')
      }

      await manager.softDelete(DocumentEntity, { docCode: code })
    })

    this.logger.log(`文档 [${code}] 已被用户 [${user.uid}] 软删除 (保留 R2 与 MongoDB 数据)`)

    // 联动并发清理双路检索切块 (Vectorize 向量点与 OpenSearch 倒排分块)，彻底从 RAG 检索池移除
    try {
      await Promise.allSettled([
        this.vectorService.deleteDocumentVectors(code),
        this.openSearchService.deleteDocumentChunks(code),
      ])
      this.logger.log(`[DocumentService] 已联动清理文档 [${code}] 的向量与全文检索切块`)
    }
    catch (err: any) {
      this.logger.warn(`[DocumentService] 联动清理检索切块失败 (不影响软删除主流程): ${err.message}`)
    }
  }

  /**
   * 根据业务编码归档/下线文档（置为 ARCHIVED 状态，同时彻底从 RAG 检索池下架切块）
   */
  async archiveByCode(code: string, user: IAuthUser): Promise<DocumentEntity> {
    const document = await this.docRepo.manager.transaction(async (manager) => {
      const doc = await lockDocumentByCode(manager, code)

      if (
        !this.permission.isAdmin(user)
        && !this.permission.isOwner(doc, user)
      ) {
        throw new ForbiddenException('您无权下线他人创建的文档')
      }

      if (doc.status === DocumentStatusEnum.ARCHIVED) {
        return doc
      }

      doc.status = DocumentStatusEnum.ARCHIVED
      return manager.save(DocumentEntity, doc)
    })

    // 联动并发清理双路切块，确保 RAG 不再召回
    try {
      await Promise.allSettled([
        this.vectorService.deleteDocumentVectors(code),
        this.openSearchService.deleteDocumentChunks(code),
      ])
      this.logger.log(`[DocumentService] 文档 [${code}] 已归档下线，并已清理检索池切块`)
    }
    catch (err: any) {
      this.logger.warn(`[DocumentService] 归档清理检索切块失败: ${err.message}`)
    }

    return document
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

  /**
   * 重新触发文档的切片与多路衍生索引/向量化流程
   */
  async reVector(code: string, user: IAuthUser): Promise<DocumentEntity> {
    const { document } = await this.findByCode(code, user)

    if (document.status === DocumentStatusEnum.DRAFT) {
      throw new BadRequestException('草稿状态文档暂不支持向量化，请先提交审核')
    }

    // 1. 同步更新主表向量化状态为 processing
    document.vectorStatus = VectorStatusEnum.PROCESSING
    document.updateBy = user.uid
    const savedDoc = await this.docRepo.save(document)

    // 2. 尝试从 MongoDB 获取正文或构建切片
    let textContent = ''
    try {
      textContent = await this.docContentService.getContentByCode(code)
    }
    catch {
      textContent = `文档《${savedDoc.title}》已发布，准备进入向量化知识加工。`
    }

    const chunks = [
      {
        chunkIndex: 0,
        content: textContent ? textContent.slice(0, 2000) : `文档《${savedDoc.title}》已发布，准备进入向量化知识加工。`,
        headingPath: '第一章 发布正文',
        scope: savedDoc.scope || 'PUBLIC',
        visibleDeptIds: savedDoc.visibleDeptIds || [],
      },
    ]

    // 3. 重置初始化衍生索引任务表 (VECTOR, ES, GRAPH)
    await this.indexTaskService.initTasks(savedDoc.docCode, chunks.length)

    // 4. 派发消息至 RabbitMQ 向量通道与 ES 全文通道
    await Promise.all([
      this.docPublisher.sendVectorIndexTask({
        docCode: savedDoc.docCode,
        docId: savedDoc.id,
        title: savedDoc.title,
        fileType: savedDoc.fileType,
        chunks,
      }),
      this.docPublisher.sendEsIndexTask({
        docCode: savedDoc.docCode,
        docId: savedDoc.id,
        title: savedDoc.title,
        fileType: savedDoc.fileType,
        chunks,
      }),
    ])

    this.logger.log(`[DocumentService] 已成功向消息总线派发重新向量化任务: ${code}`)
    return savedDoc
  }
}

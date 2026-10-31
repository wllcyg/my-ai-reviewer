import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";

import { DocumentApprovalEntity } from "../document-approval.entity";
import {
  ApprovalActionEnum,
  ApprovalNodeTypeEnum,
  DocumentStatusEnum,
  ReviewStatusEnum,
} from "../document.constant";
import { DocumentEntity } from "../document.entity";
import { AuditDocumentDto } from "../dto/audit-document.dto";
import { QueryApprovalDto } from "../dto/query-approval.dto";
import { lockDocumentByCode } from "./document-lock.util";
import { DocumentPermissionService } from "./document-permission.service";

interface AppendApprovalParams {
  doc: DocumentEntity;
  nodeType: ApprovalNodeTypeEnum;
  action: ApprovalActionEnum;
  user: IAuthUser;
  operatorName: string;
  comment: string;
  /** 操作后的状态快照 */
  snapshotStatus: string;
}

/**
 * 审批流转：状态机推进与审批履历的读写
 */
@Injectable()
export class DocumentApprovalService {
  private readonly logger = new Logger(DocumentApprovalService.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly docRepo: Repository<DocumentEntity>,
    @InjectRepository(DocumentApprovalEntity)
    private readonly approvalRepo: Repository<DocumentApprovalEntity>,
    private readonly permission: DocumentPermissionService,
  ) {}

  /**
   * 追加一条审批流转记录，必须传入事务 manager 以与状态变更保持同一事务
   */
  async appendRecord(
    manager: EntityManager,
    params: AppendApprovalParams,
  ): Promise<DocumentApprovalEntity> {
    const {
      doc,
      nodeType,
      action,
      user,
      operatorName,
      comment,
      snapshotStatus,
    } = params;
    return manager.save(
      manager.create(DocumentApprovalEntity, {
        docId: doc.id,
        docCode: doc.docCode,
        nodeType,
        action,
        operatorId: user.uid,
        operatorName,
        comment,
        snapshotStatus,
      }),
    );
  }

  /**
   * 获取某文档的审批轨迹（按时间正序）
   */
  async findHistoryByCode(code: string): Promise<DocumentApprovalEntity[]> {
    return this.approvalRepo.find({
      where: { docCode: code },
      order: { createdAt: "ASC" },
    });
  }

  /**
   * 删除某文档的全部审批记录，必须在事务中与删除文档一起执行
   */
  async deleteByDocCode(manager: EntityManager, code: string): Promise<void> {
    await manager.delete(DocumentApprovalEntity, { docCode: code });
  }

  /**
   * 提交文档审核（从草稿流转到待审核状态，并记录流转历史，同一事务）
   */
  async submitForReview(
    code: string,
    user: IAuthUser,
    comment?: string,
  ): Promise<DocumentEntity> {
    const savedDoc = await this.docRepo.manager.transaction(async (manager) => {
      const document = await lockDocumentByCode(manager, code);

      if (
        !this.permission.isAdmin(user) &&
        !this.permission.isOwner(document, user)
      ) {
        throw new ForbiddenException("您无权提交他人创建的草稿文档");
      }

      if (document.status !== DocumentStatusEnum.DRAFT) {
        throw new BadRequestException(
          `只有草稿状态的文档可以提交审核，当前状态为: ${document.status}`,
        );
      }

      // 变更为待审核状态，直接进入人工复核（不经过 AI 审核）
      document.status = DocumentStatusEnum.UNDER_REVIEW;
      document.reviewStatus = ReviewStatusEnum.MANUAL_REVIEWING;
      document.updateBy = user.uid;
      const doc = await manager.save(document);

      await this.appendRecord(manager, {
        doc,
        nodeType: ApprovalNodeTypeEnum.SUBMIT,
        action: ApprovalActionEnum.SUBMIT,
        user,
        operatorName: "提交人",
        comment: comment || "提交文档审核，进入待审核流转池",
        snapshotStatus: doc.status,
      });

      return doc;
    });

    this.logger.log(`文档 [${code}] 已提交审核，状态变更为 UNDER_REVIEW`);
    return savedDoc;
  }

  /**
   * 审核文档（通过/驳回，并流转状态与历史，同一事务）
   */
  async auditDocument(
    code: string,
    dto: AuditDocumentDto,
    user: IAuthUser,
  ): Promise<DocumentEntity> {
    const isAdmin = this.permission.isAdmin(user);
    if (!isAdmin && !this.permission.isReviewer(user)) {
      throw new ForbiddenException("您没有审核文档的权限");
    }

    const savedDoc = await this.docRepo.manager.transaction(async (manager) => {
      const document = await lockDocumentByCode(manager, code);

      // 职责分离：非管理员的审核人不能审核自己提交的文档
      if (!isAdmin && this.permission.isOwner(document, user)) {
        throw new ForbiddenException("不能审核自己提交的文档");
      }

      if (document.status !== DocumentStatusEnum.UNDER_REVIEW) {
        throw new BadRequestException(
          `当前文档不在待审核状态 (当前状态: ${document.status})`,
        );
      }

      const isApprove = dto.action === "APPROVE";
      if (isApprove) {
        document.status = DocumentStatusEnum.PUBLISHED;
        document.reviewStatus = ReviewStatusEnum.APPROVED;
      } else {
        // 驳回则退回草稿状态供修改
        document.status = DocumentStatusEnum.DRAFT;
        document.reviewStatus = ReviewStatusEnum.REJECTED;
        document.reviewRemark = dto.comment || "审核未通过被驳回";
      }

      document.updateBy = user.uid;
      const doc = await manager.save(document);

      await this.appendRecord(manager, {
        doc,
        nodeType: ApprovalNodeTypeEnum.MANUAL_REVIEW,
        action: isApprove
          ? ApprovalActionEnum.APPROVE
          : ApprovalActionEnum.REJECT,
        user,
        operatorName: "审核人",
        comment:
          dto.comment ||
          (isApprove ? "审核通过，准予发布" : "审核驳回，退回草稿"),
        snapshotStatus: doc.status,
      });

      return doc;
    });

    this.logger.log(
      `文档 [${code}] 审核完成: ${dto.action}, 操作者: ${user.uid}`,
    );
    return savedDoc;
  }

  /**
   * 分页获取全局审批流转履历列表（带文档标题与分类等详情）
   */
  async findApprovalRecords(
    dto: QueryApprovalDto,
    user: IAuthUser,
  ): Promise<{ items: any[]; total: number }> {
    const {
      keyword,
      action,
      nodeType,
      docCode,
      startDate,
      endDate,
      page = 1,
      pageSize = 10,
    } = dto;

    const qb = this.approvalRepo
      .createQueryBuilder("record")
      .leftJoin(DocumentEntity, "doc", "doc.id = record.doc_id")
      .select([
        "record.id AS id",
        "record.doc_id AS docId",
        "record.doc_code AS docCode",
        "record.node_type AS nodeType",
        "record.action AS action",
        "record.operator_id AS operatorId",
        "record.operator_name AS operatorName",
        "record.comment AS comment",
        "record.snapshot_status AS snapshotStatus",
        "record.created_at AS createdAt",
        "record.updated_at AS updatedAt",
        "doc.title AS docTitle",
        "doc.category AS docCategory",
        "doc.file_type AS docFileType",
        "doc.file_size AS docFileSize",
        "doc.status AS docStatus",
      ]);

    if (keyword) {
      qb.andWhere(
        "(doc.title LIKE :kw OR record.doc_code LIKE :kw OR record.operator_name LIKE :kw OR record.comment LIKE :kw)",
        { kw: `%${keyword}%` },
      );
    }

    if (action) {
      qb.andWhere("record.action = :action", { action });
    }

    if (nodeType) {
      qb.andWhere("record.node_type = :nodeType", { nodeType });
    }

    if (docCode) {
      qb.andWhere("record.doc_code = :docCode", { docCode });
    }

    if (startDate) {
      qb.andWhere("record.created_at >= :startDate", {
        startDate: startDate.length <= 10 ? `${startDate} 00:00:00` : startDate,
      });
    }

    if (endDate) {
      qb.andWhere("record.created_at <= :endDate", {
        endDate: endDate.length <= 10 ? `${endDate} 23:59:59` : endDate,
      });
    }

    // 数据权限隔离：非管理员且非审核人，仅能查看自己提交的文档或者自己操作的记录
    if (!this.permission.isAdmin(user) && !this.permission.isReviewer(user)) {
      qb.andWhere("(record.operator_id = :uid OR doc.create_by = :uid)", {
        uid: user.uid,
      });
    }

    qb.orderBy("record.created_at", "DESC")
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    const [rawItems, total] = await Promise.all([
      qb.getRawMany(),
      qb.getCount(),
    ]);

    return { items: rawItems, total };
  }
}

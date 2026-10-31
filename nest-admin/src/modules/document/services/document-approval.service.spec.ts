import { BadRequestException, ForbiddenException } from '@nestjs/common'
import { EntityManager, Repository } from 'typeorm'

import {
  ApprovalActionEnum,
  ApprovalNodeTypeEnum,
  DocumentStatusEnum,
  ReviewStatusEnum,
} from '../document.constant'
import { DocumentApprovalEntity } from '../document-approval.entity'
import { DocumentEntity } from '../document.entity'
import { AuditActionEnum } from '../dto/audit-document.dto'
import { DocumentApprovalService } from './document-approval.service'
import { DocumentPermissionService } from './document-permission.service'

describe('DocumentApprovalService', () => {
  let service: DocumentApprovalService
  let mockDocRepo: Partial<Repository<DocumentEntity>>
  let mockApprovalRepo: Partial<Repository<DocumentApprovalEntity>>
  let mockManager: Partial<EntityManager>
  let permissionService: DocumentPermissionService

  const adminUser: IAuthUser = {
    uid: 1,
    username: 'admin',
    roles: ['admin'],
  } as any

  const reviewerUser: IAuthUser = {
    uid: 2,
    username: 'reviewer',
    roles: ['reviewer'],
  } as any

  const normalAuthor: IAuthUser = {
    uid: 10,
    username: 'author',
    roles: ['user'],
  } as any

  const otherUser: IAuthUser = {
    uid: 20,
    username: 'other',
    roles: ['user'],
  } as any

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      create: jest.fn().mockImplementation((_, entity) => entity),
      delete: jest.fn().mockResolvedValue({ affected: 1 } as any),
    }

    mockDocRepo = {
      manager: {
        transaction: jest.fn().mockImplementation((cb: (mgr: EntityManager) => any) => cb(mockManager as EntityManager)),
      } as any,
    }

    mockApprovalRepo = {
      find: jest.fn(),
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    }

    permissionService = new DocumentPermissionService()
    service = new DocumentApprovalService(
      mockDocRepo as Repository<DocumentEntity>,
      mockApprovalRepo as Repository<DocumentApprovalEntity>,
      permissionService,
    )
  })

  describe('submitForReview (提交审核)', () => {
    it('非作者且非管理员提交他人草稿，应抛出 ForbiddenException', async () => {
      const doc = {
        id: 1,
        docCode: 'doc_001',
        createBy: normalAuthor.uid,
        status: DocumentStatusEnum.DRAFT,
      } as DocumentEntity

      ;(mockManager.findOne as jest.Mock).mockResolvedValue(doc)

      await expect(
        service.submitForReview('doc_001', otherUser),
      ).rejects.toThrow(ForbiddenException)
    })

    it('当前文档不是草稿状态时，应抛出 BadRequestException', async () => {
      const doc = {
        id: 1,
        docCode: 'doc_001',
        createBy: normalAuthor.uid,
        status: DocumentStatusEnum.PUBLISHED,
      } as DocumentEntity

      ;(mockManager.findOne as jest.Mock).mockResolvedValue(doc)

      await expect(
        service.submitForReview('doc_001', normalAuthor),
      ).rejects.toThrow(BadRequestException)
    })

    it('作者提交草稿成功：状态变更为 UNDER_REVIEW、MANUAL_REVIEWING 并记录审批历史', async () => {
      const doc = {
        id: 1,
        docCode: 'doc_001',
        createBy: normalAuthor.uid,
        status: DocumentStatusEnum.DRAFT,
        reviewStatus: ReviewStatusEnum.INIT,
      } as DocumentEntity

      ;(mockManager.findOne as jest.Mock).mockResolvedValue(doc)

      const result = await service.submitForReview('doc_001', normalAuthor, '请求加急走查')

      expect(result.status).toBe(DocumentStatusEnum.UNDER_REVIEW)
      expect(result.reviewStatus).toBe(ReviewStatusEnum.MANUAL_REVIEWING)
      expect(result.updateBy).toBe(normalAuthor.uid)

      // 验证在同一事务 manager 中保存了审批流转记录
      expect(mockManager.save).toHaveBeenCalledTimes(2)
      expect(mockManager.create).toHaveBeenCalledWith(
        DocumentApprovalEntity,
        expect.objectContaining({
          docCode: 'doc_001',
          nodeType: ApprovalNodeTypeEnum.SUBMIT,
          action: ApprovalActionEnum.SUBMIT,
          operatorId: normalAuthor.uid,
          comment: '请求加急走查',
          snapshotStatus: DocumentStatusEnum.UNDER_REVIEW,
        }),
      )
    })

    it('管理员代作者提交草稿允许通过', async () => {
      const doc = {
        id: 2,
        docCode: 'doc_002',
        createBy: normalAuthor.uid,
        status: DocumentStatusEnum.DRAFT,
      } as DocumentEntity

      ;(mockManager.findOne as jest.Mock).mockResolvedValue(doc)

      const result = await service.submitForReview('doc_002', adminUser)
      expect(result.status).toBe(DocumentStatusEnum.UNDER_REVIEW)
    })
  })

  describe('auditDocument (文档审核通过/驳回)', () => {
    it('普通用户无审核人角色时，抛出 ForbiddenException', async () => {
      await expect(
        service.auditDocument('doc_001', { action: AuditActionEnum.APPROVE }, normalAuthor),
      ).rejects.toThrow(ForbiddenException)
    })

    it('审核人不能审核自己提交的文档（职责分离原则）', async () => {
      const reviewerSelfDoc = {
        id: 10,
        docCode: 'doc_010',
        createBy: reviewerUser.uid,
        status: DocumentStatusEnum.UNDER_REVIEW,
      } as DocumentEntity

      ;(mockManager.findOne as jest.Mock).mockResolvedValue(reviewerSelfDoc)

      await expect(
        service.auditDocument('doc_010', { action: AuditActionEnum.APPROVE }, reviewerUser),
      ).rejects.toThrow('不能审核自己提交的文档')
    })

    it('管理员可审核自己或他人的文档', async () => {
      const adminDoc = {
        id: 11,
        docCode: 'doc_011',
        createBy: adminUser.uid,
        status: DocumentStatusEnum.UNDER_REVIEW,
      } as DocumentEntity

      ;(mockManager.findOne as jest.Mock).mockResolvedValue(adminDoc)

      const result = await service.auditDocument('doc_011', { action: AuditActionEnum.APPROVE }, adminUser)
      expect(result.status).toBe(DocumentStatusEnum.PUBLISHED)
      expect(result.reviewStatus).toBe(ReviewStatusEnum.APPROVED)
    })

    it('文档不在 UNDER_REVIEW 状态时，驳回或通过应抛出 BadRequestException', async () => {
      const draftDoc = {
        id: 12,
        docCode: 'doc_012',
        createBy: normalAuthor.uid,
        status: DocumentStatusEnum.DRAFT,
      } as DocumentEntity

      ;(mockManager.findOne as jest.Mock).mockResolvedValue(draftDoc)

      await expect(
        service.auditDocument('doc_012', { action: AuditActionEnum.APPROVE }, reviewerUser),
      ).rejects.toThrow('当前文档不在待审核状态')
    })

    it('审核通过 (APPROVE)：流转为 PUBLISHED 和 APPROVED，并追加记录', async () => {
      const underReviewDoc = {
        id: 13,
        docCode: 'doc_013',
        createBy: normalAuthor.uid,
        status: DocumentStatusEnum.UNDER_REVIEW,
        reviewStatus: ReviewStatusEnum.MANUAL_REVIEWING,
      } as DocumentEntity

      ;(mockManager.findOne as jest.Mock).mockResolvedValue(underReviewDoc)

      const result = await service.auditDocument(
        'doc_013',
        { action: AuditActionEnum.APPROVE, comment: '符合规范，准予发布' },
        reviewerUser,
      )

      expect(result.status).toBe(DocumentStatusEnum.PUBLISHED)
      expect(result.reviewStatus).toBe(ReviewStatusEnum.APPROVED)
      expect(result.updateBy).toBe(reviewerUser.uid)

      expect(mockManager.create).toHaveBeenCalledWith(
        DocumentApprovalEntity,
        expect.objectContaining({
          docCode: 'doc_013',
          action: ApprovalActionEnum.APPROVE,
          comment: '符合规范，准予发布',
          snapshotStatus: DocumentStatusEnum.PUBLISHED,
        }),
      )
    })

    it('审核驳回 (REJECT)：退回 DRAFT，记录 REJECTED 与驳回原因', async () => {
      const underReviewDoc = {
        id: 14,
        docCode: 'doc_014',
        createBy: normalAuthor.uid,
        status: DocumentStatusEnum.UNDER_REVIEW,
        reviewStatus: ReviewStatusEnum.MANUAL_REVIEWING,
      } as DocumentEntity

      ;(mockManager.findOne as jest.Mock).mockResolvedValue(underReviewDoc)

      const result = await service.auditDocument(
        'doc_014',
        { action: AuditActionEnum.REJECT, comment: '文档缺少安全合规章节' },
        reviewerUser,
      )

      expect(result.status).toBe(DocumentStatusEnum.DRAFT)
      expect(result.reviewStatus).toBe(ReviewStatusEnum.REJECTED)
      expect(result.reviewRemark).toBe('文档缺少安全合规章节')

      expect(mockManager.create).toHaveBeenCalledWith(
        DocumentApprovalEntity,
        expect.objectContaining({
          docCode: 'doc_014',
          action: ApprovalActionEnum.REJECT,
          comment: '文档缺少安全合规章节',
          snapshotStatus: DocumentStatusEnum.DRAFT,
        }),
      )
    })
  })

  describe('findHistoryByCode', () => {
    it('按创建时间正序查询该文档的历史审批记录', async () => {
      const fakeRecords = [{ id: 1 }, { id: 2 }] as DocumentApprovalEntity[]
      ;(mockApprovalRepo.find as jest.Mock).mockResolvedValue(fakeRecords)

      const history = await service.findHistoryByCode('doc_history_test')
      expect(mockApprovalRepo.find).toHaveBeenCalledWith({
        where: { docCode: 'doc_history_test' },
        order: { createdAt: 'ASC' },
      })
      expect(history).toBe(fakeRecords)
    })
  })
})

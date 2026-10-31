import { SelectQueryBuilder } from 'typeorm'

import {
  DocumentScopeEnum,
  DocumentStatusEnum,
} from '../document.constant'
import { DocumentEntity } from '../document.entity'
import { DocumentPermissionService } from './document-permission.service'

describe('DocumentPermissionService', () => {
  let service: DocumentPermissionService

  const adminUser: IAuthUser = {
    uid: 1,
    username: 'admin',
    roles: ['admin'],
  } as any

  const superAdminUser: IAuthUser = {
    uid: 2,
    username: 'superAdmin',
    roles: ['super_admin'],
  } as any

  const reviewerUser: IAuthUser = {
    uid: 3,
    username: 'reviewer',
    roles: ['reviewer'],
  } as any

  const normalUser: IAuthUser = {
    uid: 4,
    username: 'user4',
    roles: ['common_user'],
  } as any

  const anotherUser: IAuthUser = {
    uid: 5,
    username: 'user5',
    roles: ['common_user'],
  } as any

  beforeEach(() => {
    service = new DocumentPermissionService()
  })

  describe('角色与归属判断 (isAdmin, isReviewer, isOwner)', () => {
    it('正确识别管理员与超级管理员角色', () => {
      expect(service.isAdmin(adminUser)).toBe(true)
      expect(service.isAdmin(superAdminUser)).toBe(true)
      expect(service.isAdmin(reviewerUser)).toBe(false)
      expect(service.isAdmin(normalUser)).toBe(false)
      expect(service.isAdmin({ uid: 6, roles: [] } as any)).toBe(false)
    })

    it('正确识别审核人角色', () => {
      expect(service.isReviewer(reviewerUser)).toBe(true)
      expect(service.isReviewer(adminUser)).toBe(false)
      expect(service.isReviewer(normalUser)).toBe(false)
    })

    it('正确判断是否为文档作者', () => {
      const doc = { createBy: 4 } as DocumentEntity
      expect(service.isOwner(doc, normalUser)).toBe(true)
      expect(service.isOwner(doc, anotherUser)).toBe(false)
    })
  })

  describe('单文档阅读权限判定 (canAccessDocument)', () => {
    it('管理员或超级管理员可访问任何状态/任何范围的文档', () => {
      const privateDraft = {
        scope: DocumentScopeEnum.PRIVATE,
        status: DocumentStatusEnum.DRAFT,
        createBy: 99,
      } as DocumentEntity

      expect(service.canAccessDocument(privateDraft, adminUser)).toBe(true)
      expect(service.canAccessDocument(privateDraft, superAdminUser)).toBe(true)
    })

    it('创建者可以访问自己的私密文档和草稿', () => {
      const ownerPrivateDraft = {
        scope: DocumentScopeEnum.PRIVATE,
        status: DocumentStatusEnum.DRAFT,
        createBy: normalUser.uid,
      } as DocumentEntity

      expect(service.canAccessDocument(ownerPrivateDraft, normalUser)).toBe(true)
    })

    it('公开文档 (PUBLIC) 任何登录用户均可访问', () => {
      const publicDoc = {
        scope: DocumentScopeEnum.PUBLIC,
        status: DocumentStatusEnum.DRAFT,
        createBy: 99,
      } as DocumentEntity

      expect(service.canAccessDocument(publicDoc, normalUser)).toBe(true)
      expect(service.canAccessDocument(publicDoc, reviewerUser)).toBe(true)
    })

    it('审核人可以访问非草稿状态的文档，但不能访问他人草稿', () => {
      const underReviewDoc = {
        scope: DocumentScopeEnum.DEPT,
        status: DocumentStatusEnum.UNDER_REVIEW,
        createBy: 99,
      } as DocumentEntity

      const publishedDoc = {
        scope: DocumentScopeEnum.PRIVATE,
        status: DocumentStatusEnum.PUBLISHED,
        createBy: 99,
      } as DocumentEntity

      const draftDoc = {
        scope: DocumentScopeEnum.PRIVATE,
        status: DocumentStatusEnum.DRAFT,
        createBy: 99,
      } as DocumentEntity

      expect(service.canAccessDocument(underReviewDoc, reviewerUser)).toBe(true)
      expect(service.canAccessDocument(publishedDoc, reviewerUser)).toBe(true)
      expect(service.canAccessDocument(draftDoc, reviewerUser)).toBe(false)
    })

    it('非作者普通用户无法访问他人的私密非公开文档', () => {
      const privateDoc = {
        scope: DocumentScopeEnum.PRIVATE,
        status: DocumentStatusEnum.PUBLISHED,
        createBy: 99,
      } as DocumentEntity

      expect(service.canAccessDocument(privateDoc, normalUser)).toBe(false)
    })
  })

  describe('列表数据隔离过滤 (applyVisibilityFilter)', () => {
    let mockQb: Partial<SelectQueryBuilder<DocumentEntity>>

    beforeEach(() => {
      mockQb = {
        andWhere: jest.fn().mockReturnThis(),
      }
    })

    it('管理员不添加数据范围限制', () => {
      service.applyVisibilityFilter(mockQb as SelectQueryBuilder<DocumentEntity>, adminUser)
      expect(mockQb.andWhere).not.toHaveBeenCalled()
    })

    it('普通用户仅能查询 PUBLIC 或自己创建的文档', () => {
      service.applyVisibilityFilter(mockQb as SelectQueryBuilder<DocumentEntity>, normalUser)
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(doc.scope = :pubScope OR doc.create_by = :uid)',
        {
          pubScope: DocumentScopeEnum.PUBLIC,
          uid: normalUser.uid,
          draftStatus: DocumentStatusEnum.DRAFT,
        },
      )
    })

    it('审核人可查询 PUBLIC、自己创建或非草稿状态文档', () => {
      service.applyVisibilityFilter(mockQb as SelectQueryBuilder<DocumentEntity>, reviewerUser)
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(doc.scope = :pubScope OR doc.create_by = :uid OR doc.status <> :draftStatus)',
        {
          pubScope: DocumentScopeEnum.PUBLIC,
          uid: reviewerUser.uid,
          draftStatus: DocumentStatusEnum.DRAFT,
        },
      )
    })
  })
})

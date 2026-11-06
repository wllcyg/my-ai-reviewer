import { SelectQueryBuilder } from 'typeorm'

import {
  DocumentScopeEnum,
  DocumentStatusEnum,
} from '../document.constant'
import { DocumentEntity } from '../document.entity'
import { DocumentPermissionService } from './document-permission.service'

describe('documentPermissionService', () => {
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

  const deptUser101: IAuthUser = {
    uid: 5,
    username: 'deptUser101',
    roles: ['common_user'],
    deptId: 101,
  } as any

  const deptUser102: IAuthUser = {
    uid: 6,
    username: 'deptUser102',
    roles: ['common_user'],
    deptId: 102,
  } as any

  const anotherUser: IAuthUser = {
    uid: 7,
    username: 'user7',
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

    it('部门内部文档 (DEPT) 仅匹配部门的用户或创建者/管理员可访问', () => {
      const deptDoc = {
        scope: DocumentScopeEnum.DEPT,
        status: DocumentStatusEnum.PUBLISHED,
        visibleDeptIds: [101, 103],
        createBy: 99,
      } as DocumentEntity

      // 部门匹配的用户可访问
      expect(service.canAccessDocument(deptDoc, deptUser101)).toBe(true)
      // 部门不匹配的用户无法访问
      expect(service.canAccessDocument(deptDoc, deptUser102)).toBe(false)
      // 未绑定部门的普通用户无法访问
      expect(service.canAccessDocument(deptDoc, normalUser)).toBe(false)
      // 管理员仍可访问
      expect(service.canAccessDocument(deptDoc, adminUser)).toBe(true)
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

    it('未绑定部门的普通用户仅能查询 PUBLIC 或自己创建的文档', () => {
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

    it('绑定部门的普通用户可同时查询其所属部门公开的文档', () => {
      service.applyVisibilityFilter(mockQb as SelectQueryBuilder<DocumentEntity>, deptUser101)
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        '(doc.scope = :pubScope OR doc.create_by = :uid OR (doc.scope = :deptScope AND JSON_CONTAINS(doc.visible_dept_ids, :userDeptId)))',
        {
          pubScope: DocumentScopeEnum.PUBLIC,
          uid: deptUser101.uid,
          draftStatus: DocumentStatusEnum.DRAFT,
          deptScope: DocumentScopeEnum.DEPT,
          userDeptId: '101',
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

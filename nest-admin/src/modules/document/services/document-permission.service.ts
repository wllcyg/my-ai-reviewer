import { Injectable } from '@nestjs/common'
import { SelectQueryBuilder } from 'typeorm'

import {
  DOCUMENT_ADMIN_ROLES,
  DOCUMENT_REVIEWER_ROLES,
  DocumentScopeEnum,
  DocumentStatusEnum,
} from '../document.constant'
import { DocumentEntity } from '../document.entity'

/**
 * 文档权限判定：无状态、无 I/O，集中维护角色与数据可见性规则
 */
@Injectable()
export class DocumentPermissionService {
  /** 是否为文档管理员 */
  isAdmin(user: IAuthUser): boolean {
    return !!user.roles?.some(role => DOCUMENT_ADMIN_ROLES.includes(role))
  }

  /** 是否为审核人 */
  isReviewer(user: IAuthUser): boolean {
    return !!user.roles?.some(role => DOCUMENT_REVIEWER_ROLES.includes(role))
  }

  /** 是否为文档创建者 */
  isOwner(document: DocumentEntity, user: IAuthUser): boolean {
    return document.createBy === user.uid
  }

  /**
   * 单文档读权限：
   * 1. 管理员或创建者拥有完全访问权限
   * 2. 全员公开文档 (PUBLIC) 允许任意登录用户查看
   * 3. 部门内部文档 (DEPT) 仅限所属部门在 visibleDeptIds 列表中的用户查看
   * 4. 审核人可访问非草稿状态的流转/发布文档
   */
  canAccessDocument(document: DocumentEntity, user: IAuthUser): boolean {
    if (this.isAdmin(user) || this.isOwner(document, user)) {
      return true
    }
    if (document.scope === DocumentScopeEnum.PUBLIC) {
      return true
    }
    if (
      document.scope === DocumentScopeEnum.DEPT
      && user.deptId
      && Array.isArray(document.visibleDeptIds)
      && document.visibleDeptIds.includes(user.deptId)
    ) {
      return true
    }
    return this.isReviewer(user) && document.status !== DocumentStatusEnum.DRAFT
  }

  /**
   * 列表读权限过滤，规则需与 canAccessDocument 保持一致
   * @param qb 以 `doc` 为别名的文档查询构造器
   */
  applyVisibilityFilter(qb: SelectQueryBuilder<DocumentEntity>, user: IAuthUser): void {
    if (this.isAdmin(user)) {
      return
    }
    const conditions = ['doc.scope = :pubScope', 'doc.create_by = :uid']
    const parameters: Record<string, any> = {
      pubScope: DocumentScopeEnum.PUBLIC,
      uid: user.uid,
      draftStatus: DocumentStatusEnum.DRAFT,
    }

    if (user.deptId) {
      conditions.push('(doc.scope = :deptScope AND JSON_CONTAINS(doc.visible_dept_ids, :userDeptId))')
      parameters.deptScope = DocumentScopeEnum.DEPT
      parameters.userDeptId = JSON.stringify(user.deptId)
    }

    if (this.isReviewer(user)) {
      conditions.push('doc.status <> :draftStatus')
    }

    qb.andWhere(`(${conditions.join(' OR ')})`, parameters)
  }
}

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
   * 单文档读权限：管理员、创建者、公开文档可访问；审核人可访问非草稿文档
   */
  canAccessDocument(document: DocumentEntity, user: IAuthUser): boolean {
    if (this.isAdmin(user) || this.isOwner(document, user)) {
      return true
    }
    if (document.scope === DocumentScopeEnum.PUBLIC) {
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
    if (this.isReviewer(user)) {
      conditions.push('doc.status <> :draftStatus')
    }
    qb.andWhere(`(${conditions.join(' OR ')})`, {
      pubScope: DocumentScopeEnum.PUBLIC,
      uid: user.uid,
      draftStatus: DocumentStatusEnum.DRAFT,
    })
  }
}

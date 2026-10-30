import { ApiProperty } from '@nestjs/swagger'
import { Column, Entity, Index } from 'typeorm'

import { CompleteEntity } from '~/common/entity/common.entity'
import {
  DocumentScopeEnum,
  DocumentStatusEnum,
  ReviewStatusEnum,
  VectorStatusEnum,
} from './document.constant'

export type DocumentScope = DocumentScopeEnum | 'PUBLIC' | 'DEPT' | 'PRIVATE'
export type DocumentStatus = DocumentStatusEnum | 'DRAFT' | 'UNDER_REVIEW' | 'PUBLISHED' | 'ARCHIVED'
export type ReviewStatus = ReviewStatusEnum | 'INIT' | 'AI_REVIEWING' | 'MANUAL_REVIEWING' | 'APPROVED' | 'REJECTED'
export type VectorStatus = VectorStatusEnum | 'unprocessed' | 'processing' | 'completed' | 'failed'

@Entity({ name: 'doc_documents' })
export class DocumentEntity extends CompleteEntity {
  @Index({ unique: true })
  @Column({ name: 'doc_code', type: 'varchar', length: 32, comment: '对外唯一公开业务编码' })
  @ApiProperty({ description: '文档业务编码' })
  docCode: string

  @Column({ type: 'varchar', length: 255, comment: '文档标题' })
  @ApiProperty({ description: '文档标题' })
  title: string

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '分类' })
  @ApiProperty({ description: '分类', required: false })
  category: string

  @Column({ name: 'file_name', type: 'varchar', length: 255, comment: '原始文件名' })
  @ApiProperty({ description: '原始文件名' })
  fileName: string

  @Column({ name: 'file_size', type: 'bigint', comment: '文件大小(字节)' })
  @ApiProperty({ description: '文件大小(字节)' })
  fileSize: number

  @Column({ name: 'file_type', type: 'varchar', length: 50, comment: '文件扩展名或MIME' })
  @ApiProperty({ description: '文件格式/扩展名' })
  fileType: string

  @Column({ name: 'storage_key', type: 'varchar', length: 500, comment: 'R2存储Key' })
  @ApiProperty({ description: 'R2存储Key' })
  storageKey: string

  @Column({ name: 'public_url', type: 'varchar', length: 1000, nullable: true, comment: '访问URL' })
  @ApiProperty({ description: '访问URL', required: false })
  publicUrl: string

  @Column({ type: 'varchar', length: 20, default: 'PUBLIC', comment: '可见范围: PUBLIC/DEPT/PRIVATE' })
  @ApiProperty({ description: '可见范围' })
  scope: DocumentScope

  @Column({ name: 'visible_dept_ids', type: 'json', nullable: true, comment: '指定可见部门ID列表' })
  @ApiProperty({ description: '可见部门ID列表', required: false })
  visibleDeptIds: number[]

  @Column({ name: 'visible_dept_names', type: 'json', nullable: true, comment: '指定可见部门名称冗余' })
  @ApiProperty({ description: '可见部门名称列表', required: false })
  visibleDeptNames: string[]

  @Column({ type: 'varchar', length: 20, default: 'DRAFT', comment: '文档生命周期状态: DRAFT/PUBLISHED/ARCHIVED' })
  @ApiProperty({ description: '文档生命周期状态' })
  status: DocumentStatus

  @Column({ name: 'review_status', type: 'varchar', length: 20, default: 'INIT', comment: '审批流状态: INIT/AI_REVIEWING/MANUAL_REVIEWING/APPROVED/REJECTED' })
  @ApiProperty({ description: '审批流状态' })
  reviewStatus: ReviewStatus

  @Column({ name: 'review_score', type: 'decimal', precision: 5, scale: 2, nullable: true, comment: 'AI审核得分' })
  @ApiProperty({ description: 'AI审核得分', required: false })
  reviewScore: number

  @Column({ name: 'review_remark', type: 'text', nullable: true, comment: '审核意见或驳回原因' })
  @ApiProperty({ description: '审核意见或驳回原因', required: false })
  reviewRemark: string

  @Column({ name: 'vector_status', type: 'varchar', length: 20, default: 'unprocessed', comment: '向量化状态' })
  @ApiProperty({ description: '向量化状态' })
  vectorStatus: VectorStatus
}

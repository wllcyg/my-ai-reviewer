import { ApiProperty } from '@nestjs/swagger'
import { Column, Entity, Index } from 'typeorm'

import { CommonEntity } from '~/common/entity/common.entity'
import { ApprovalActionEnum, ApprovalNodeTypeEnum } from './document.constant'

export type ApprovalNodeType = ApprovalNodeTypeEnum | 'SUBMIT' | 'AI_REVIEW' | 'MANUAL_REVIEW'
export type ApprovalAction = ApprovalActionEnum | 'SUBMIT' | 'APPROVE' | 'REJECT' | 'TRANSFER'

@Entity({ name: 'doc_approval_records' })
export class DocumentApprovalEntity extends CommonEntity {
  @Index()
  @Column({ name: 'doc_id', type: 'bigint', comment: '关联文档ID' })
  @ApiProperty({ description: '关联文档ID' })
  docId: number

  @Index()
  @Column({ name: 'doc_code', type: 'varchar', length: 32, comment: '关联文档Code' })
  @ApiProperty({ description: '关联文档Code' })
  docCode: string

  @Column({ name: 'node_type', type: 'varchar', length: 50, comment: '节点类型: SUBMIT/AI_REVIEW/MANUAL_REVIEW' })
  @ApiProperty({ description: '节点类型' })
  nodeType: ApprovalNodeType

  @Column({ type: 'varchar', length: 50, comment: '审批动作: SUBMIT/APPROVE/REJECT/TRANSFER' })
  @ApiProperty({ description: '审批动作' })
  action: ApprovalAction

  @Column({ name: 'operator_id', type: 'bigint', nullable: true, comment: '操作人UID(AI操作可为0或空)' })
  @ApiProperty({ description: '操作人UID', required: false })
  operatorId: number

  @Column({ name: 'operator_name', type: 'varchar', length: 50, nullable: true, comment: '操作人名称或AI标识' })
  @ApiProperty({ description: '操作人名称', required: false })
  operatorName: string

  @Column({ type: 'text', nullable: true, comment: '审批意见/评语' })
  @ApiProperty({ description: '审批意见/评语', required: false })
  comment: string

  @Column({ name: 'snapshot_status', type: 'varchar', length: 20, nullable: true, comment: '操作后的状态快照' })
  @ApiProperty({ description: '操作后的状态快照', required: false })
  snapshotStatus: string
}

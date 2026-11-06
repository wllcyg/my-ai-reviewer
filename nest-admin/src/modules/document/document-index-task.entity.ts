import { ApiProperty } from '@nestjs/swagger'
import { Column, Entity, Index } from 'typeorm'
import { CommonEntity } from '~/common/entity/common.entity'
import { DocIndexStatusEnum, DocIndexTypeEnum } from './document.constant'

export type DocIndexType = DocIndexTypeEnum | 'VECTOR' | 'ES' | 'GRAPH'
export type DocIndexStatus =
  | DocIndexStatusEnum
  | 'unprocessed'
  | 'processing'
  | 'completed'
  | 'failed'

@Entity({ name: 'doc_index_tasks' })
@Index('uk_doc_index_type', ['docCode', 'indexType'], { unique: true })
export class DocumentIndexTaskEntity extends CommonEntity {
  @Column({
    name: 'doc_code',
    type: 'varchar',
    length: 32,
    comment: '关联文档全局唯一业务编码',
  })
  @ApiProperty({ description: '文档业务编码' })
  docCode: string

  @Column({
    name: 'index_type',
    type: 'varchar',
    length: 20,
    comment: '索引衍生管道类型: VECTOR / ES / GRAPH',
  })
  @ApiProperty({ description: '索引管道类型: VECTOR | ES | GRAPH' })
  indexType: DocIndexType

  @Column({
    type: 'varchar',
    length: 20,
    default: DocIndexStatusEnum.UNPROCESSED,
    comment: '处理状态: unprocessed / processing / completed / failed',
  })
  @ApiProperty({ description: '处理状态' })
  status: DocIndexStatus

  @Column({
    name: 'chunk_count',
    type: 'int',
    default: 0,
    comment: '切块总数',
  })
  @ApiProperty({ description: '切块总数' })
  chunkCount: number

  @Column({
    name: 'cost_ms',
    type: 'int',
    nullable: true,
    comment: '处理总耗时(毫秒)',
  })
  @ApiProperty({ description: '耗时(ms)', required: false })
  costMs?: number

  @Column({
    name: 'retry_count',
    type: 'tinyint',
    default: 0,
    comment: '已重试次数',
  })
  @ApiProperty({ description: '重试次数' })
  retryCount: number

  @Column({
    name: 'error_message',
    type: 'text',
    nullable: true,
    comment: '失败报错信息或异常摘要',
  })
  @ApiProperty({ description: '失败原因', required: false })
  errorMessage?: string

  @Column({
    name: 'completed_at',
    type: 'datetime',
    nullable: true,
    comment: '索引构建完成时间戳',
  })
  @ApiProperty({ description: '完成时间', required: false })
  completedAt?: Date
}


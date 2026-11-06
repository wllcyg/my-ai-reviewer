import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import {
  DocIndexType,
  DocumentIndexTaskEntity,
} from '../document-index-task.entity'
import {
  DocIndexStatusEnum,
  DocIndexTypeEnum,
  VectorStatusEnum,
} from '../document.constant'
import { DocumentEntity } from '../document.entity'

@Injectable()
export class DocumentIndexTaskService {
  private readonly logger = new Logger(DocumentIndexTaskService.name)

  constructor(
    @InjectRepository(DocumentIndexTaskEntity)
    private readonly taskRepo: Repository<DocumentIndexTaskEntity>,
    @InjectRepository(DocumentEntity)
    private readonly docRepo: Repository<DocumentEntity>,
  ) {}

  /**
   * 阶段一切块完毕后，批量初始化/覆盖重置 3 条衍生索引记录
   * @param docCode 文档业务编码
   * @param chunkCount 切块总数
   * @param types 指定需要初始化的类型，默认全部 [VECTOR, ES, GRAPH]
   */
  async initTasks(
    docCode: string,
    chunkCount: number,
    types: DocIndexType[] = [
      DocIndexTypeEnum.VECTOR,
      DocIndexTypeEnum.ES,
      DocIndexTypeEnum.GRAPH,
    ],
  ): Promise<DocumentIndexTaskEntity[]> {
    const tasks = types.map(type =>
      this.taskRepo.create({
        docCode,
        indexType: type,
        status: DocIndexStatusEnum.UNPROCESSED,
        chunkCount,
        costMs: undefined,
        errorMessage: undefined,
        completedAt: undefined,
      }),
    )

    // 基于 uk_doc_index_type (docCode, indexType) 幂等 upsert
    await this.taskRepo.upsert(tasks, ['docCode', 'indexType'])
    this.logger.log(`[IndexTask] 已初始化文档 ${docCode} 的索引任务: [${types.join(', ')}], 块数=${chunkCount}`)
    return tasks
  }

  /**
   * 标记任务进入处理中状态
   */
  async markProcessing(docCode: string, indexType: DocIndexType): Promise<void> {
    const existing = await this.taskRepo.findOne({
      where: { docCode, indexType },
    })

    if (existing) {
      await this.taskRepo.update(existing.id, {
        status: DocIndexStatusEnum.PROCESSING,
        retryCount: (existing.retryCount || 0) + 1,
      })
    }
    else {
      await this.taskRepo.save(
        this.taskRepo.create({
          docCode,
          indexType,
          status: DocIndexStatusEnum.PROCESSING,
          retryCount: 1,
        }),
      )
    }

    // 同步回写文档主表 vector_status 为 processing
    if (indexType === DocIndexTypeEnum.VECTOR) {
      await this.docRepo.update({ docCode }, { vectorStatus: VectorStatusEnum.PROCESSING })
    }
  }

  /**
   * 标记任务处理成功
   */
  async markCompleted(
    docCode: string,
    indexType: DocIndexType,
    costMs: number,
    chunkCount?: number,
  ): Promise<void> {
    const updatePayload: Record<string, any> = {
      status: DocIndexStatusEnum.COMPLETED,
      costMs,
      errorMessage: undefined,
      completedAt: new Date(),
    }
    if (typeof chunkCount === 'number') {
      updatePayload.chunkCount = chunkCount
    }

    await this.taskRepo.update(
      { docCode, indexType },
      updatePayload,
    )

    // 同步回写文档主表 vector_status 为 completed
    if (indexType === DocIndexTypeEnum.VECTOR) {
      await this.docRepo.update({ docCode }, { vectorStatus: VectorStatusEnum.COMPLETED })
    }

    this.logger.log(`[IndexTask] ✅ 文档 ${docCode} 的 [${indexType}] 索引构建完成, 切块数=${chunkCount ?? '-'}, 耗时=${costMs}ms`)
  }

  /**
   * 标记任务处理失败
   */
  async markFailed(
    docCode: string,
    indexType: DocIndexType,
    errorMessage: string,
  ): Promise<void> {
    await this.taskRepo.update(
      { docCode, indexType },
      {
        status: DocIndexStatusEnum.FAILED,
        errorMessage: errorMessage.slice(0, 2000), // 防止报错过长
      },
    )

    // 同步回写文档主表 vector_status 为 failed
    if (indexType === DocIndexTypeEnum.VECTOR) {
      await this.docRepo.update({ docCode }, { vectorStatus: VectorStatusEnum.FAILED })
    }

    this.logger.error(`[IndexTask] ❌ 文档 ${docCode} 的 [${indexType}] 索引构建失败: ${errorMessage}`)
  }

  /**
   * 查询单篇文档的所有索引任务
   */
  async getTasksByDocCode(docCode: string): Promise<DocumentIndexTaskEntity[]> {
    return this.taskRepo.find({ where: { docCode } })
  }

  /**
   * 批量查询多篇文档的所有索引任务 (按 docCode 分组，供列表页快速聚合装配)
   */
  async getTasksGroupedByDocCodes(
    docCodes: string[],
  ): Promise<Map<string, DocumentIndexTaskEntity[]>> {
    const map = new Map<string, DocumentIndexTaskEntity[]>()
    if (!docCodes.length)
      return map

    const tasks = await this.taskRepo.find({
      where: { docCode: In(docCodes) },
    })

    for (const task of tasks) {
      const list = map.get(task.docCode) || []
      list.push(task)
      map.set(task.docCode, list)
    }

    return map
  }
}

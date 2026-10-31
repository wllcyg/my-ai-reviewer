import { NotFoundException } from '@nestjs/common'
import { EntityManager } from 'typeorm'

import { DocumentEntity } from '../document.entity'

/**
 * 在事务内按业务编码加排他锁读取文档，串行化同一文档上的并发状态流转
 * 必须在 `manager.transaction` 回调中使用，否则锁在语句结束时即释放
 */
export async function lockDocumentByCode(manager: EntityManager, code: string): Promise<DocumentEntity> {
  const document = await manager.findOne(DocumentEntity, {
    where: { docCode: code },
    lock: { mode: 'pessimistic_write' },
  })
  if (!document) {
    throw new NotFoundException(`未找到业务编码为 ${code} 的文档`)
  }
  return document
}

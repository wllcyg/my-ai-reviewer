import { NotFoundException } from '@nestjs/common'
import { EntityManager } from 'typeorm'

import { DocumentEntity } from '../document.entity'
import { lockDocumentByCode } from './document-lock.util'

describe('lockDocumentByCode', () => {
  let mockManager: Partial<EntityManager>

  beforeEach(() => {
    mockManager = {
      findOne: jest.fn(),
    }
  })

  it('文档存在时，应以 pessimistic_write 排他悲观锁读取并返回文档', async () => {
    const fakeDoc = {
      id: 101,
      docCode: 'doc_test_123',
      title: '测试文档',
    } as DocumentEntity

    ;(mockManager.findOne as jest.Mock).mockResolvedValue(fakeDoc)

    const result = await lockDocumentByCode(mockManager as EntityManager, 'doc_test_123')

    expect(mockManager.findOne).toHaveBeenCalledWith(DocumentEntity, {
      where: { docCode: 'doc_test_123' },
      lock: { mode: 'pessimistic_write' },
    })
    expect(result).toBe(fakeDoc)
  })

  it('文档不存在时，应抛出 NotFoundException 异常', async () => {
    ;(mockManager.findOne as jest.Mock).mockResolvedValue(null)

    await expect(
      lockDocumentByCode(mockManager as EntityManager, 'doc_non_exist'),
    ).rejects.toThrow(NotFoundException)

    expect(mockManager.findOne).toHaveBeenCalledWith(DocumentEntity, {
      where: { docCode: 'doc_non_exist' },
      lock: { mode: 'pessimistic_write' },
    })
  })
})

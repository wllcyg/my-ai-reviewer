import {
  DOCUMENT_CATEGORY_OPTIONS,
  DOCUMENT_SCOPE_OPTIONS,
  DOCUMENT_STATUS_OPTIONS,
  REVIEW_STATUS_OPTIONS,
  VECTOR_STATUS_OPTIONS,
} from '../document.constant'
import { DocumentMetaService } from './document-meta.service'

describe('DocumentMetaService', () => {
  let service: DocumentMetaService

  beforeEach(() => {
    service = new DocumentMetaService()
  })

  it('返回完整的 SSOT 全局状态字典与选项列表', () => {
    const meta = service.getMeta()

    expect(meta.reviewStatus).toEqual(Object.values(REVIEW_STATUS_OPTIONS))
    expect(meta.vectorStatus).toEqual(Object.values(VECTOR_STATUS_OPTIONS))
    expect(meta.documentStatus).toEqual(Object.values(DOCUMENT_STATUS_OPTIONS))
    expect(meta.scope).toEqual(Object.values(DOCUMENT_SCOPE_OPTIONS))
    expect(meta.categories).toEqual(DOCUMENT_CATEGORY_OPTIONS)
  })
})

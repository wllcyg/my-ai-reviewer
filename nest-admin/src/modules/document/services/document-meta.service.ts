import { Injectable } from '@nestjs/common'

import {
  DOCUMENT_CATEGORY_OPTIONS,
  DOCUMENT_SCOPE_OPTIONS,
  DOCUMENT_STATUS_OPTIONS,
  REVIEW_STATUS_OPTIONS,
  VECTOR_STATUS_OPTIONS,
} from '../document.constant'
import { DocumentMetaDto } from '../dto/document-meta.dto'

@Injectable()
export class DocumentMetaService {
  /**
   * 获取企业级全局状态字典与配置元数据 (SSOT)
   */
  getMeta(): DocumentMetaDto {
    return {
      reviewStatus: Object.values(REVIEW_STATUS_OPTIONS),
      vectorStatus: Object.values(VECTOR_STATUS_OPTIONS),
      documentStatus: Object.values(DOCUMENT_STATUS_OPTIONS),
      scope: Object.values(DOCUMENT_SCOPE_OPTIONS),
      categories: DOCUMENT_CATEGORY_OPTIONS,
    }
  }
}

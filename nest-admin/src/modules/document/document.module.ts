import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { DocumentApprovalEntity } from './document-approval.entity'
import { DocumentIndexTaskEntity } from './document-index-task.entity'
import { DocumentController } from './document.controller'
import { DocumentEntity } from './document.entity'
import { R2StorageService } from './r2-storage.service'
import { HybridRerankerService } from './rerank/hybrid-reranker.service'
import { ModelRerankerService } from './rerank/model-reranker.service'
import { DocumentApprovalService } from './services/document-approval.service'
import { DocumentChatService } from './services/document-chat.service'
import { DocumentIndexTaskService } from './services/document-index-task.service'
import { DocumentMetaService } from './services/document-meta.service'
import { DocumentPermissionService } from './services/document-permission.service'
import { DocumentService } from './services/document.service'
import { HybridSearchService } from './services/hybrid-search.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DocumentEntity,
      DocumentApprovalEntity,
      DocumentIndexTaskEntity,
    ]),
  ],
  controllers: [DocumentController],
  providers: [
    DocumentService,
    DocumentApprovalService,
    DocumentIndexTaskService,
    DocumentMetaService,
    DocumentPermissionService,
    HybridRerankerService,
    ModelRerankerService,
    HybridSearchService,
    DocumentChatService,
    R2StorageService,
  ],
  exports: [
    DocumentService,
    DocumentApprovalService,
    DocumentIndexTaskService,
    HybridRerankerService,
    ModelRerankerService,
    HybridSearchService,
    DocumentChatService,
    R2StorageService,
  ],
})
export class DocumentModule {}

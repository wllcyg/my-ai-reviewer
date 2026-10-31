import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { DocumentApprovalEntity } from './document-approval.entity'
import { DocumentController } from './document.controller'
import { DocumentEntity } from './document.entity'
import { R2StorageService } from './r2-storage.service'
import { DocumentApprovalService } from './services/document-approval.service'
import { DocumentMetaService } from './services/document-meta.service'
import { DocumentPermissionService } from './services/document-permission.service'
import { DocumentService } from './services/document.service'

@Module({
  imports: [TypeOrmModule.forFeature([DocumentEntity, DocumentApprovalEntity])],
  controllers: [DocumentController],
  providers: [
    DocumentService,
    DocumentApprovalService,
    DocumentMetaService,
    DocumentPermissionService,
    R2StorageService,
  ],
  exports: [DocumentService, DocumentApprovalService, R2StorageService],
})
export class DocumentModule {}

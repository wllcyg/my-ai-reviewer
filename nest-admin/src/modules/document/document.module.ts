import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { DocumentApprovalEntity } from './document-approval.entity'
import { DocumentController } from './document.controller'
import { DocumentEntity } from './document.entity'
import { DocumentService } from './document.service'
import { R2StorageService } from './r2-storage.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity, DocumentApprovalEntity]),
  ],
  controllers: [DocumentController],
  providers: [DocumentService, R2StorageService],
  exports: [DocumentService, R2StorageService],
})
export class DocumentModule {}


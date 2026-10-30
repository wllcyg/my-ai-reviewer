import { Module } from '@nestjs/common'
import { DocumentController } from './document.controller'
import { DocumentService } from './document.service'
import { R2StorageService } from './r2-storage.service'

@Module({
  controllers: [DocumentController],
  providers: [DocumentService, R2StorageService],
  exports: [DocumentService, R2StorageService],
})
export class DocumentModule {}

import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'

import { ApiResult } from '~/common/decorators/api-result.decorator'
import { AuthUser } from '~/modules/auth/decorators/auth-user.decorator'

import { DocumentEntity } from './document.entity'
import { DocumentService } from './document.service'
import { AuditDocumentDto, SubmitReviewDto } from './dto/audit-document.dto'
import { CreateDocumentDto } from './dto/create-document.dto'
import { DocumentMetaDto } from './dto/document-meta.dto'
import { QueryDocumentDto } from './dto/query-document.dto'
import { GenerateUploadSignDto, UploadSignResultDto } from './dto/upload-sign.dto'

@ApiTags('Document - 知识库文档模块')
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload-sign')
  @ApiOperation({ summary: '获取文档直传 Cloudflare R2 的预签名凭证' })
  @ApiOkResponse({ type: UploadSignResultDto })
  @ApiResult({ type: UploadSignResultDto })
  async getUploadSign(
    @Body() dto: GenerateUploadSignDto,
    @AuthUser() user: IAuthUser,
  ): Promise<UploadSignResultDto> {
    return this.documentService.getUploadSignature(dto, user.uid)
  }

  @Post()
  @ApiOperation({ summary: '直传 R2 完成后提交落库保存' })
  @ApiResult({ type: DocumentEntity })
  async create(
    @Body() dto: CreateDocumentDto,
    @AuthUser() user: IAuthUser,
  ): Promise<DocumentEntity> {
    return this.documentService.create(dto, user)
  }

  @Get()
  @ApiOperation({ summary: '分页获取知识库文档列表' })
  @ApiResult({ type: [DocumentEntity], isPage: true })
  async list(
    @Query() dto: QueryDocumentDto,
    @AuthUser() user: IAuthUser,
  ): Promise<{ items: DocumentEntity[]; total: number }> {
    return this.documentService.findAll(dto, user)
  }

  @Get('meta')
  @ApiOperation({ summary: '获取知识库文档模块全局枚举字典与配置元数据 (SSOT)' })
  @ApiOkResponse({ type: DocumentMetaDto })
  @ApiResult({ type: DocumentMetaDto })
  async getMeta(): Promise<DocumentMetaDto> {
    return this.documentService.getMeta()
  }

  @Get('access-url')
  @ApiOperation({ summary: '获取私密文档的临时访问与预览 URL' })
  @ApiOkResponse({ type: String })
  @ApiResult({ type: String })
  async getAccessUrl(@Query('storageKey') storageKey: string): Promise<string> {
    return this.documentService.getDocumentAccessUrl(storageKey)
  }

  @Post(':code/submit')
  @ApiOperation({ summary: '提交文档审核（从草稿流转到待审核）' })
  @ApiResult({ type: DocumentEntity })
  async submitReview(
    @Param('code') code: string,
    @Body() dto: SubmitReviewDto,
    @AuthUser() user: IAuthUser,
  ): Promise<DocumentEntity> {
    return this.documentService.submitForReview(code, user, dto?.comment)
  }

  @Post(':code/audit')
  @ApiOperation({ summary: '审核文档（通过/驳回，并流转状态与历史）' })
  @ApiResult({ type: DocumentEntity })
  async audit(
    @Param('code') code: string,
    @Body() dto: AuditDocumentDto,
    @AuthUser() user: IAuthUser,
  ): Promise<DocumentEntity> {
    return this.documentService.auditDocument(code, dto, user)
  }

  @Get(':code')
  @ApiOperation({ summary: '根据业务编码获取文档详情与审批流转轨迹' })
  async detail(@Param('code') code: string) {
    return this.documentService.findByCode(code)
  }

  @Delete(':code')
  @ApiOperation({ summary: '根据业务编码删除文档及清理 R2 存储' })
  async delete(
    @Param('code') code: string,
    @AuthUser() user: IAuthUser,
  ): Promise<void> {
    return this.documentService.deleteByCode(code, user)
  }
}

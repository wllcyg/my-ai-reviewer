import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiResult } from '~/common/decorators/api-result.decorator'
import { AuthUser } from '~/modules/auth/decorators/auth-user.decorator'
import { DocumentService } from './document.service'
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

  @Get('access-url')
  @ApiOperation({ summary: '获取私密文档的临时访问与预览 URL' })
  @ApiOkResponse({ type: String })
  @ApiResult({ type: String })
  async getAccessUrl(@Query('storageKey') storageKey: string): Promise<string> {
    return this.documentService.getDocumentAccessUrl(storageKey)
  }
}

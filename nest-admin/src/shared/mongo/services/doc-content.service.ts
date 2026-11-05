import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { DocContent, DocContentDocument } from '../schemas/doc-content.schema'

@Injectable()
export class DocContentService {
  private readonly logger = new Logger(DocContentService.name)

  constructor(
    @InjectModel(DocContent.name)
    private readonly docContentModel: Model<DocContentDocument>,
  ) {}

  /**
   * 保存或更新文档的 Markdown 全文
   * @param docCode 业务编码（对应 Mongo 的 _id）
   * @param docId MySQL 中的主键 ID
   * @param markdownContent Markdown 格式大文本
   */
  async saveContent(
    docCode: string,
    docId: number,
    markdownContent: string,
  ): Promise<DocContent> {
    const doc = await this.docContentModel.findByIdAndUpdate(
      docCode,
      {
        $set: {
          docId,
          markdownContent,
        },
      },
      { new: true, upsert: true },
    )
    this.logger.log(`[MongoDB] 文档 Markdown 已持久化: docCode=${docCode}`)
    return doc
  }

  /**
   * 根据 docCode 获取文档的 Markdown 全文
   */
  async getContentByCode(docCode: string): Promise<string> {
    const doc = await this.docContentModel.findById(docCode).lean()
    if (!doc) {
      throw new NotFoundException(`未找到文档 [${docCode}] 的 Markdown 内容`)
    }
    return doc.markdownContent
  }

  /**
   * 获取完整的文档内容记录
   */
  async findRecordByCode(docCode: string): Promise<DocContent | null> {
    return this.docContentModel.findById(docCode).lean()
  }

  /**
   * 检查文档内容是否存在
   */
  async hasContent(docCode: string): Promise<boolean> {
    const count = await this.docContentModel.countDocuments({ _id: docCode })
    return count > 0
  }

  /**
   * 删除文档对应的 Markdown 内容
   */
  async deleteByCode(docCode: string): Promise<boolean> {
    const res = await this.docContentModel.deleteOne({ _id: docCode })
    this.logger.log(`[MongoDB] 文档内容已清理: docCode=${docCode}`)
    return res.deletedCount > 0
  }
}


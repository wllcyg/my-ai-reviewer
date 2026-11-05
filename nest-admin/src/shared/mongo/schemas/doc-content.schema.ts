import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export type DocContentDocument = HydratedDocument<DocContent>

@Schema({
  collection: 'doc_contents',
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class DocContent {
  /**
   * 对应 MySQL 中的对外唯一业务编码 doc_code
   */
  @Prop({ type: String, required: true })
  _id: string

  /**
   * 对应 MySQL 中的自增物理主键 id
   */
  @Prop({ type: Number, required: true, index: true })
  docId: number

  /**
   * 文档转换后的 Markdown 全文字符串
   */
  @Prop({ type: String, required: true })
  markdownContent: string

  @Prop({ type: Date })
  createdAt?: Date

  @Prop({ type: Date })
  updatedAt?: Date
}

export const DocContentSchema = SchemaFactory.createForClass(DocContent)


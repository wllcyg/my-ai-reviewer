import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { DocContent, DocContentSchema } from './schemas/doc-content.schema'
import { DocContentService } from './services/doc-content.service'

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('mongo.uri') || process.env.MONGODB_URI
        return {
          uri,
        }
      },
    }),
    MongooseModule.forFeature([{ name: DocContent.name, schema: DocContentSchema }]),
  ],
  providers: [DocContentService],
  exports: [DocContentService, MongooseModule],
})
export class MongoModule {}


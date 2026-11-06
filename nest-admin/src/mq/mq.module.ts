import { forwardRef, Global, Module } from '@nestjs/common'
import { DocumentModule } from '~/modules/document/document.module'
import { VectorConsumer } from './consumers/vector.consumer'
import { DocumentPipelinePublisher } from './document-pipeline.publisher'
import { MqController } from './mq.controller'
import { RabbitMqService } from './rabbitmq.service'

@Global()
@Module({
  imports: [forwardRef(() => DocumentModule)],
  providers: [RabbitMqService, DocumentPipelinePublisher, VectorConsumer],
  controllers: [MqController],
  exports: [RabbitMqService, DocumentPipelinePublisher],
})
export class MqModule {}

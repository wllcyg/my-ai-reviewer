import { Global, Module } from '@nestjs/common'
import { DocumentPipelinePublisher } from './document-pipeline.publisher'
import { MqController } from './mq.controller'
import { RabbitMqService } from './rabbitmq.service'

@Global()
@Module({
  providers: [RabbitMqService, DocumentPipelinePublisher],
  controllers: [MqController],
  exports: [RabbitMqService, DocumentPipelinePublisher],
})
export class MqModule {}

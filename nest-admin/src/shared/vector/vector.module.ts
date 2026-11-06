import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MockEmbeddingProvider } from './embedding/mock-embedding.provider'
import { OpenAiEmbeddingProvider } from './embedding/openai-embedding.provider'
import { CloudflareVectorizeStore } from './store/cloudflare-vectorize.store'
import { MemoryVectorStore } from './store/memory-vector.store'
import { EMBEDDING_PROVIDER_TOKEN, VECTOR_STORE_TOKEN } from './vector.constant'
import { IEmbeddingProvider, IVectorStore } from './vector.interface'
import { VectorService } from './vector.service'

@Global()
@Module({
  providers: [
    // 1. 各底层实现类
    MockEmbeddingProvider,
    OpenAiEmbeddingProvider,
    MemoryVectorStore,
    CloudflareVectorizeStore,

    // 2. 向量模型提供者工厂 (动态策略装配)
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      useFactory: (
        configService: ConfigService,
        openAiProvider: OpenAiEmbeddingProvider,
        mockProvider: MockEmbeddingProvider,
      ): IEmbeddingProvider => {
        const providerType = configService.get<string>('vector.embeddingProvider', 'mock')
        if (providerType === 'openai' || providerType === 'cloudflare') {
          return openAiProvider
        }
        return mockProvider
      },
      inject: [ConfigService, OpenAiEmbeddingProvider, MockEmbeddingProvider],
    },

    // 3. 向量数据库存储工厂 (动态策略装配)
    {
      provide: VECTOR_STORE_TOKEN,
      useFactory: (
        configService: ConfigService,
        vectorizeStore: CloudflareVectorizeStore,
        memoryStore: MemoryVectorStore,
      ): IVectorStore => {
        const storeType = configService.get<string>('vector.vectorStoreProvider', 'memory')
        if (storeType === 'vectorize') {
          return vectorizeStore
        }
        return memoryStore
      },
      inject: [ConfigService, CloudflareVectorizeStore, MemoryVectorStore],
    },

    // 4. 高层业务门面
    VectorService,
  ],
  exports: [VectorService, EMBEDDING_PROVIDER_TOKEN, VECTOR_STORE_TOKEN],
})
export class VectorModule {}


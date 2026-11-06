import { ConfigModule } from '@nestjs/config'
import { Test, TestingModule } from '@nestjs/testing'
import { VectorConfig } from '~/config'
import { EMBEDDING_PROVIDER_TOKEN, VECTOR_STORE_TOKEN } from '../vector.constant'
import { IEmbeddingProvider, IVectorStore } from '../vector.interface'
import { VectorModule } from '../vector.module'
import { VectorService } from '../vector.service'

describe('VectorModule (NestJS DI Integration)', () => {
  let moduleRef: TestingModule

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close()
    }
  })

  it('在默认配置下应成功初始化所有 Provider 并解析 VectorService', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [VectorConfig],
        }),
        VectorModule,
      ],
    }).compile()

    const service = moduleRef.get<VectorService>(VectorService)
    const provider = moduleRef.get<IEmbeddingProvider>(EMBEDDING_PROVIDER_TOKEN)
    const store = moduleRef.get<IVectorStore>(VECTOR_STORE_TOKEN)

    expect(service).toBeDefined()
    expect(provider).toBeDefined()
    expect(store).toBeDefined()
    expect(['mock', 'openai']).toContain(service.providerName)
    expect(['memory', 'vectorize']).toContain(service.storeName)
  })
})


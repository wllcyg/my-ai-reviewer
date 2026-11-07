import { Test, TestingModule } from '@nestjs/testing'
import { ConfigModule } from '@nestjs/config'
import { OpenSearchModule } from '../opensearch.module'
import { OpenSearchService } from '../opensearch.service'
import { OPENSEARCH_STORE_TOKEN } from '../opensearch.constant'

describe('OpenSearchModule DI Integration', () => {
  let moduleRef: TestingModule

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close()
    }
  })

  it('should compile and provide OpenSearchService with store', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              opensearch: {
                provider: 'mock',
                nodeUrl: '',
                indexName: 'test_chunks',
              },
            }),
          ],
        }),
        OpenSearchModule,
      ],
    }).compile()

    const service = moduleRef.get<OpenSearchService>(OpenSearchService)
    const store = moduleRef.get(OPENSEARCH_STORE_TOKEN)

    expect(service).toBeDefined()
    expect(store).toBeDefined()
    expect(service.storeName).toBe('mock')
    expect(await service.ping()).toBe(true)
  })
})


import { DynamicModule, Global, Module, Provider } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import type { IOpenSearchConfig } from '~/config/opensearch.config'
import { opensearchRegToken } from '~/config/opensearch.config'
import { OPENSEARCH_STORE_TOKEN } from './opensearch.constant'
import { OpenSearchService } from './opensearch.service'
import { BonsaiOpenSearchStore } from './store/bonsai-opensearch.store'
import { MockOpenSearchStore } from './store/mock-opensearch.store'

const openSearchStoreProvider: Provider = {
  provide: OPENSEARCH_STORE_TOKEN,
  useFactory: (
    configService: ConfigService,
    mockStore: MockOpenSearchStore,
    bonsaiStore: BonsaiOpenSearchStore,
  ) => {
    const config = configService.get<IOpenSearchConfig>(opensearchRegToken)
    const provider = (config?.provider || 'mock').toLowerCase()

    if (provider === 'bonsai' || provider === 'opensearch') {
      return bonsaiStore
    }

    if (provider === 'mock') {
      return mockStore
    }

    // 默认自动探测
    if (config?.nodeUrl) {
      return bonsaiStore
    }

    return mockStore
  },
  inject: [ConfigService, MockOpenSearchStore, BonsaiOpenSearchStore],
}

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    MockOpenSearchStore,
    BonsaiOpenSearchStore,
    openSearchStoreProvider,
    OpenSearchService,
  ],
  exports: [OpenSearchService, OPENSEARCH_STORE_TOKEN],
})
export class OpenSearchModule {
  static register(): DynamicModule {
    return {
      module: OpenSearchModule,
    }
  }
}


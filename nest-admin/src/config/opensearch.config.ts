import { registerAs } from '@nestjs/config'

export const opensearchRegToken = 'opensearch'

export interface IOpenSearchConfig {
  /** Bonsai / OpenSearch 集群连接完整 URL */
  nodeUrl: string
  /** 索引名称，默认为 kh_doc_chunks */
  indexName: string
  /** 服务提供商类型: bonsai | opensearch | mock */
  provider: 'bonsai' | 'opensearch' | 'mock'
  /** 是否在启动时自动确保索引和 mapping 存在 */
  autoCreateIndex: boolean
}

export const OpenSearchConfig = registerAs(opensearchRegToken, (): IOpenSearchConfig => {
  const nodeUrl = process.env.BONSAI_URL || process.env.OPENSEARCH_URL || ''
  const indexName = process.env.OPENSEARCH_INDEX || 'kh_doc_chunks'
  const provider = (process.env.ES_PROVIDER as any) || (nodeUrl ? 'bonsai' : 'mock')
  const autoCreateIndex = process.env.OPENSEARCH_AUTO_CREATE_INDEX !== 'false'

  return {
    nodeUrl,
    indexName,
    provider,
    autoCreateIndex,
  }
})


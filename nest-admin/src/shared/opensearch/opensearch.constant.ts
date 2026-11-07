/**
 * OpenSearch 全文检索底层 Store 依赖注入 Token
 */
export const OPENSEARCH_STORE_TOKEN = Symbol('OPENSEARCH_STORE_TOKEN')

/**
 * 默认索引名称
 */
export const DEFAULT_OPENSEARCH_INDEX = 'kh_doc_chunks'

/**
 * OpenSearch / Bonsai 索引创建配置
 * - number_of_shards: 1 (适应 Bonsai 10 分片限额，极度精简高效)
 * - number_of_replicas: 0
 * - analyzer: smartcn (Bonsai 3.9.0 原生支持的工业级中文分词器)
 */
export const DEFAULT_INDEX_MAPPINGS = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
    analysis: {
      analyzer: {
        default: {
          type: 'smartcn',
        },
      },
    },
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      docCode: { type: 'keyword' },
      docId: { type: 'long' },
      chunkIndex: { type: 'integer' },
      title: {
        type: 'text',
        analyzer: 'smartcn',
        search_analyzer: 'smartcn',
        fields: {
          raw: { type: 'keyword', ignore_above: 256 },
        },
      },
      headingPath: {
        type: 'text',
        analyzer: 'smartcn',
        search_analyzer: 'smartcn',
      },
      content: {
        type: 'text',
        analyzer: 'smartcn',
        search_analyzer: 'smartcn',
      },
      tokens: { type: 'integer' },
      scope: { type: 'keyword' },
      visibleDeptIds: { type: 'integer' },
      acl_tags: { type: 'keyword' },
      createdAt: { type: 'date' },
    },
  },
}


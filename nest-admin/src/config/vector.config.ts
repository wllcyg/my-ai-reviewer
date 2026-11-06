import { ConfigType, registerAs } from '@nestjs/config'
import { env } from '~/global/env'

export const vectorRegToken = 'vector'

export const VectorConfig = registerAs(vectorRegToken, () => {
  const accountId = env('CLOUDFLARE_ACCOUNT_ID') || env('R2_ACCOUNT_ID') || ''
  const apiToken = env('CLOUDFLARE_API_TOKEN') || env('OPENAI_API_KEY') || ''
  const baseUrl = env('CLOUDFLARE_AI_BASE_URL') || (accountId ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1` : '')
  const embeddingModel = env('CLOUDFLARE_EMBEDDING_MODEL') || '@cf/baai/bge-m3'
  const vectorizeIndex = env('CLOUDFLARE_VECTORIZE_INDEX') || 'word-embeddings'

  // 提供者开关：未显式配置时，若存在 apiToken 则优先使用 cloudflare / vectorize，否则自动优雅降级为 mock / memory
  const embeddingProvider = env('EMBEDDING_PROVIDER') || (apiToken ? 'cloudflare' : 'mock')
  const vectorStoreProvider = env('VECTOR_STORE_PROVIDER') || (apiToken ? 'vectorize' : 'memory')

  return {
    accountId,
    apiToken,
    baseUrl,
    embeddingModel,
    embeddingDimension: 1024,
    vectorizeIndex,
    embeddingProvider,
    vectorStoreProvider,
  }
})

export type IVectorConfig = ConfigType<typeof VectorConfig>


/**
 * 向量模块全局常量与依赖注入标识
 */

export const DEFAULT_EMBEDDING_MODEL = '@cf/baai/bge-m3'
export const DEFAULT_VECTOR_DIMENSION = 1024
export const DEFAULT_EMBEDDING_BATCH_SIZE = 16

/** IoC 注入 Token */
export const EMBEDDING_PROVIDER_TOKEN = Symbol('EMBEDDING_PROVIDER_TOKEN')
export const VECTOR_STORE_TOKEN = Symbol('VECTOR_STORE_TOKEN')


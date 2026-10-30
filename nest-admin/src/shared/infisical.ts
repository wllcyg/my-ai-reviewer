import { Logger } from '@nestjs/common'
import { InfisicalSDK } from '@infisical/sdk'

const logger = new Logger('InfisicalLoader')

/**
 * 在应用启动前，从私有 Infisical 云端拉取最新配置并挂载到 process.env
 */
export async function loadInfisicalSecrets() {
  const siteUrl = process.env.INFISICAL_SITE_URL || 'https://env.cheatppf.xyz'
  const clientId = process.env.INFISICAL_CLIENT_ID
  const clientSecret = process.env.INFISICAL_CLIENT_SECRET
  const projectId = process.env.INFISICAL_PROJECT_ID
  const environment = process.env.INFISICAL_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'prod' : 'dev')

  if (!clientId || !clientSecret || !projectId) {
    logger.log('未配置 INFISICAL_CLIENT_ID / CLIENT_SECRET / PROJECT_ID，使用本地已有环境变量启动')
    return
  }

  try {
    logger.log(`正在从云端配置中心 [${siteUrl}] 同步环境 [${environment}] 密钥...`)
    const client = new InfisicalSDK({ siteUrl })

    await client.auth().universalAuth.login({
      clientId,
      clientSecret,
    })

    const { secrets } = await client.secrets().listSecrets({
      projectId,
      environment,
      attachToProcessEnv: true, // 核心：自动把云端变量挂载到 process.env
    })

    logger.log(`✓ 云端配置同步成功，共装载 ${secrets.length} 个配置变量`)
  } catch (error) {
    logger.error(`✗ 从 Infisical 同步云端配置失败: ${error?.message || error}，将回退使用本地环境变量`)
  }
}

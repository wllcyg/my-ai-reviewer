import fs from 'node:fs'
import path from 'node:path'
import { Logger } from '@nestjs/common'
import { InfisicalSDK } from '@infisical/sdk'
import dotenv from 'dotenv'

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

    // 核心：在云端配置加载后，优先读取本地 .env 再次进行强制覆盖 (override: true)
    // 保证本地开发时在 .env 显式指定的变量（如 REDIS_HOST=127.0.0.1）拥有最高优先级，不被云端配置覆盖！
    const envPaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), 'nest-admin/.env'),
      path.resolve(__dirname, '../../.env'),
    ]
    for (const p of envPaths) {
      if (fs.existsSync(p)) {
        const result = dotenv.config({ path: p, override: true })
        if (result.parsed) {
          logger.log(`✓ 已成功应用本地 .env 覆盖配置: ${Object.keys(result.parsed).join(', ')}`)
          break
        }
      }
    }
  } catch (error) {
    logger.error(`✗ 从 Infisical 同步云端配置失败: ${error?.message || error}，将回退使用本地环境变量`)
  }
}

import { ConfigType, registerAs } from '@nestjs/config'
import { env } from '~/global/env'

export const r2RegToken = 'r2'

export const R2Config = registerAs(r2RegToken, () => {
  const accountId = env('R2_ACCOUNT_ID') || ''
  return {
    accountId,
    accessKeyId: env('R2_ACCESS_KEY_ID') || '',
    secretAccessKey: env('R2_SECRET_ACCESS_KEY') || '',
    bucket: env('R2_BUCKET') || 'my-ai-reviewer-docs',
    publicDomain: env('R2_PUBLIC_DOMAIN') || '',
    endpoint: env('R2_ENDPOINT') || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''),
  }
})

export type IR2Config = ConfigType<typeof R2Config>

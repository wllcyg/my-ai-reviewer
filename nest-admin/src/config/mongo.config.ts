import { ConfigType, registerAs } from '@nestjs/config'
import { env } from '~/global/env'

export const mongoRegToken = 'mongo'

export const MongoConfig = registerAs(mongoRegToken, () => ({
  uri: env('MONGODB_URI', process.env.MONGODB_URI || ''),
}))

export type IMongoConfig = ConfigType<typeof MongoConfig>


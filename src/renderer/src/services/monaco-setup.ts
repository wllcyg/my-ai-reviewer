import * as monaco from 'monaco-editor'
import { loader } from '@guolao/vue-monaco-editor'

let isInitialized = false

// 初始化 Monaco Editor 运行环境并绑定本地 monaco-editor 实例，确保脱离外网 CDN
export function setupMonaco(): void {
  if (isInitialized) return
  isInitialized = true

  // 绑定本地 Monaco 实例
  loader.config({ monaco })
}

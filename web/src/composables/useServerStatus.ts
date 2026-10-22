import { ref, onMounted, onUnmounted } from 'vue'
import { apiUrl } from '@/utils/api'

export interface ServerStatus {
  connected: boolean
  mcpName?: string
  latency?: number
  targetUrl: string
  errorMsg?: string
  lastChecked?: string
}

export function useServerStatus() {
  const status = ref<ServerStatus>({
    connected: false,
    targetUrl: apiUrl('/health')
  })
  let timer: any = null

  const checkHealth = async () => {
    const startTime = Date.now()
    const target = apiUrl('/health')
    try {
      const res = await fetch(target)
      if (res.ok) {
        const text = await res.text()
        try {
          const data = JSON.parse(text)
          status.value = {
            connected: true,
            mcpName: data.mcp?.name || 'OverseasFreeHub',
            latency: Date.now() - startTime,
            targetUrl: target,
            lastChecked: new Date().toLocaleTimeString()
          }
        } catch {
          status.value = {
            connected: false,
            targetUrl: target,
            errorMsg: '接口返回了 HTML 页面而非 JSON（请检查是否直连了静态站）',
            lastChecked: new Date().toLocaleTimeString()
          }
        }
      } else {
        status.value = {
          connected: false,
          targetUrl: target,
          errorMsg: `HTTP ${res.status} ${res.statusText}`,
          lastChecked: new Date().toLocaleTimeString()
        }
      }
    } catch (err: any) {
      status.value = {
        connected: false,
        targetUrl: target,
        errorMsg: err.message || '网络不可达或跨域拦截',
        lastChecked: new Date().toLocaleTimeString()
      }
    }
  }

  onMounted(() => {
    checkHealth()
    timer = setInterval(checkHealth, 8000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return {
    status,
    checkHealth
  }
}

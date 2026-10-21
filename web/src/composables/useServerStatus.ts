import { ref, onMounted, onUnmounted } from 'vue'

export interface ServerStatus {
  connected: boolean
  mcpName?: string
  latency?: number
}

export function useServerStatus() {
  const status = ref<ServerStatus>({ connected: false })
  let timer: any = null

  const checkHealth = async () => {
    const startTime = Date.now()
    try {
      const res = await fetch('/health')
      if (res.ok) {
        const data = await res.json()
        status.value = {
          connected: true,
          mcpName: data.mcp?.name || 'OverseasFreeHub',
          latency: Date.now() - startTime
        }
      } else {
        status.value = { connected: false }
      }
    } catch {
      status.value = { connected: false }
    }
  }

  onMounted(() => {
    checkHealth()
    timer = setInterval(checkHealth, 10000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return {
    status,
    checkHealth
  }
}

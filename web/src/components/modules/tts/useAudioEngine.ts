import { ref } from 'vue'
import { apiUrl } from '@/utils/api'

const audioCache = new Map<string, ArrayBuffer>()
let globalAudioElement: HTMLAudioElement | null = null
let currentBlobUrl: string | null = null

export function useAudioEngine() {
  const isAudioPlaying = ref(false)

  const stopAudio = () => {
    if (globalAudioElement) {
      globalAudioElement.pause()
      globalAudioElement.src = ''
      globalAudioElement = null
    }
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl)
      currentBlobUrl = null
    }
    isAudioPlaying.value = false
  }

  const fetchAudioBuffer = async (
    text: string,
    voice: string,
    rate: string,
    pitch: string
  ): Promise<ArrayBuffer> => {
    const cleanText = text.trim()
    const cacheKey = `${voice}_${rate}_${pitch}_${cleanText}`
    if (audioCache.has(cacheKey)) {
      return audioCache.get(cacheKey)!
    }
    // 采用 POST /api/tts/stream 接口，彻底避免长文本触发 URL 长度限制
    const res = await fetch(apiUrl('/api/tts/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleanText,
        voice,
        rate,
        pitch
      })
    })
    if (!res.ok) throw new Error('语音合成网络连接异常')
    const buf = await res.arrayBuffer()
    audioCache.set(cacheKey, buf)
    return buf
  }

  const playStream = (
    text: string,
    voice: string,
    rate: string,
    pitch: string,
    onEnded?: () => void,
    onError?: (e: any) => void
  ): HTMLAudioElement | null => {
    const cleanText = text.trim()
    if (!cleanText) return null

    stopAudio()
    isAudioPlaying.value = true

    // 短文本 (<= 300 字) 走 GET 原生直连流，享受毫秒级首包即播体验
    // 长文本 (> 300 字) 走 POST 拉取并转为 Blob URL 播放，彻底避免浏览器/代理抛出 414 URI Too Long
    if (cleanText.length <= 300) {
      const streamUrl = apiUrl(`/api/tts/stream?text=${encodeURIComponent(cleanText)}&voice=${voice}&rate=${encodeURIComponent(rate)}&pitch=${encodeURIComponent(pitch)}`)
      globalAudioElement = new Audio(streamUrl)

      // 后台静默预热缓存
      fetchAudioBuffer(cleanText, voice, rate, pitch).catch(() => {})

      globalAudioElement.play().catch(e => {
        isAudioPlaying.value = false
        if (onError) onError(e)
      })

      globalAudioElement.onended = () => {
        isAudioPlaying.value = false
        if (onEnded) onEnded()
      }

      return globalAudioElement
    } else {
      fetchAudioBuffer(cleanText, voice, rate, pitch)
        .then(buf => {
          if (!isAudioPlaying.value) return

          const blob = new Blob([buf], { type: 'audio/mpeg' })
          if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl)
          }
          currentBlobUrl = URL.createObjectURL(blob)
          globalAudioElement = new Audio(currentBlobUrl)

          globalAudioElement.play().catch(e => {
            isAudioPlaying.value = false
            if (onError) onError(e)
          })

          globalAudioElement.onended = () => {
            isAudioPlaying.value = false
            if (currentBlobUrl) {
              URL.revokeObjectURL(currentBlobUrl)
              currentBlobUrl = null
            }
            if (onEnded) onEnded()
          }
        })
        .catch(err => {
          isAudioPlaying.value = false
          if (onError) onError(err)
        })

      return null
    }
  }

  const clearCache = () => {
    audioCache.clear()
  }

  return {
    isAudioPlaying,
    stopAudio,
    fetchAudioBuffer,
    playStream,
    clearCache
  }
}

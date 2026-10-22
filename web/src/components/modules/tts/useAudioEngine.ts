import { ref } from 'vue'

const audioCache = new Map<string, ArrayBuffer>()
let globalAudioElement: HTMLAudioElement | null = null

export function useAudioEngine() {
  const isAudioPlaying = ref(false)

  const stopAudio = () => {
    if (globalAudioElement) {
      globalAudioElement.pause()
      globalAudioElement.src = ''
      globalAudioElement = null
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
    const streamUrl = `/api/tts/stream?text=${encodeURIComponent(cleanText)}&voice=${voice}&rate=${encodeURIComponent(rate)}&pitch=${encodeURIComponent(pitch)}`
    const res = await fetch(streamUrl)
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

    const streamUrl = `/api/tts/stream?text=${encodeURIComponent(cleanText)}&voice=${voice}&rate=${encodeURIComponent(rate)}&pitch=${encodeURIComponent(pitch)}`
    globalAudioElement = new Audio(streamUrl)

    // 后台预热缓存
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

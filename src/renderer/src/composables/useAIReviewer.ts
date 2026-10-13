import { ref, onMounted, onUnmounted } from 'vue'
import type { AIReviewConfig, ReviewStreamPayload, StartReviewParams } from '../../../preload/ai-types'

export function useAIReviewer() {
  const isReviewing = ref<boolean>(false)
  const isThinking = ref<boolean>(false)
  const isThinkingExpanded = ref<boolean>(true)
  const errorMessage = ref<string>('')

  // 响应式内容存储
  const thinkingText = ref<string>('')
  const reviewText = ref<string>('')

  // 当前 AI 模型配置
  const aiConfig = ref<AIReviewConfig>({
    provider: 'deepseek',
    modelId: 'deepseek-chat',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    thinkingBudget: 0
  })

  // 【核心机制】：非响应式 RAF 批量合并缓冲池
  // 杜绝高频 IPC 推送直接触发 Vue 响应式依赖收集导致的界面掉帧与撕裂
  let rawThinkingBuffer: string[] = []
  let rawTextBuffer: string[] = []
  let rafHandle: number | null = null

  // 批量帧合并调度器
  const scheduleFlush = (): void => {
    if (rafHandle !== null) return

    rafHandle = requestAnimationFrame(() => {
      rafHandle = null

      if (rawThinkingBuffer.length > 0) {
        thinkingText.value += rawThinkingBuffer.join('')
        rawThinkingBuffer = []
      }

      if (rawTextBuffer.length > 0) {
        reviewText.value += rawTextBuffer.join('')
        rawTextBuffer = []
      }

      // 如果缓冲区在执行后仍有新数据进入，继续调度下一帧
      if (rawThinkingBuffer.length > 0 || rawTextBuffer.length > 0) {
        scheduleFlush()
      }
    })
  }

  // 强制刷空缓冲区
  const flushImmediately = (): void => {
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle)
      rafHandle = null
    }
    if (rawThinkingBuffer.length > 0) {
      thinkingText.value += rawThinkingBuffer.join('')
      rawThinkingBuffer = []
    }
    if (rawTextBuffer.length > 0) {
      reviewText.value += rawTextBuffer.join('')
      rawTextBuffer = []
    }
  }

  let cleanupStreamListener: (() => void) | null = null

  // 处理流式 IPC 消息
  const handleStreamEvent = (payload: ReviewStreamPayload): void => {
    switch (payload.type) {
      case 'start':
        isReviewing.value = true
        errorMessage.value = ''
        break
      case 'thinking':
        if (!isThinking.value) {
          isThinking.value = true
        }
        if (payload.delta) {
          rawThinkingBuffer.push(payload.delta)
          scheduleFlush()
        }
        break
      case 'text':
        if (isThinking.value) {
          // 正文开始输出后，可以自动收起思维链保持整洁
          isThinking.value = false
        }
        if (payload.delta) {
          rawTextBuffer.push(payload.delta)
          scheduleFlush()
        }
        break
      case 'done':
        flushImmediately()
        isReviewing.value = false
        isThinking.value = false
        break
      case 'error':
        flushImmediately()
        isReviewing.value = false
        isThinking.value = false
        errorMessage.value = payload.error || '审查遇到未知错误'
        break
    }
  }

  // 发起审查
  const triggerReview = async (diffText: string, filePath: string): Promise<void> => {
    if (!diffText.trim()) {
      errorMessage.value = '没有可供审查的 Diff 差异代码'
      return
    }

    // 重置状态与缓冲池
    flushImmediately()
    thinkingText.value = ''
    reviewText.value = ''
    errorMessage.value = ''
    isReviewing.value = true
    isThinking.value = false
    isThinkingExpanded.value = true

    try {
      const params: StartReviewParams = {
        diffText,
        filePath,
        config: aiConfig.value
      }
      await window.api.startReview(params)
    } catch (err: unknown) {
      isReviewing.value = false
      errorMessage.value = err instanceof Error ? err.message : String(err)
    }
  }

  // 终止审查
  const cancelReview = async (): Promise<void> => {
    await window.api.stopReview()
    flushImmediately()
    isReviewing.value = false
    isThinking.value = false
  }

  // 加载与保存 AI 模型配置
  const loadConfig = async (): Promise<void> => {
    try {
      const saved = await window.api.getAIConfig()
      if (saved) {
        aiConfig.value = saved
      }
    } catch (e) {
      console.warn('读取配置失败:', e)
    }
  }

  const saveConfig = async (newConfig: Partial<AIReviewConfig>): Promise<void> => {
    try {
      const updated = await window.api.updateAIConfig(newConfig)
      aiConfig.value = updated
    } catch (e) {
      console.error('保存配置失败:', e)
    }
  }

  onMounted(async () => {
    await loadConfig()
    cleanupStreamListener = window.api.onReviewStream(handleStreamEvent)
  })

  onUnmounted(() => {
    cleanupStreamListener?.()
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle)
    }
  })

  return {
    isReviewing,
    isThinking,
    isThinkingExpanded,
    thinkingText,
    reviewText,
    errorMessage,
    aiConfig,
    triggerReview,
    cancelReview,
    saveConfig
  }
}

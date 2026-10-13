export interface AIReviewConfig {
  provider: 'openai' | 'anthropic' | 'deepseek' | 'ollama' | 'custom'
  modelId: string
  apiKey: string
  baseUrl: string
  thinkingBudget?: number
}

export type ReviewStreamEventType = 'start' | 'thinking' | 'text' | 'done' | 'error'

export interface ReviewStreamPayload {
  type: ReviewStreamEventType
  delta?: string
  error?: string
  durationMs?: number
}

export interface StartReviewParams {
  diffText: string
  filePath: string
  config?: Partial<AIReviewConfig>
}

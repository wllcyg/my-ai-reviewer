import type { BrowserWindow } from 'electron'
import { createModels } from '@earendil-works/pi-ai/models'
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai'
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic'
import { deepseekProvider } from '@earendil-works/pi-ai/providers/deepseek'
import type { AIReviewConfig, ReviewStreamPayload, StartReviewParams } from '../../preload/ai-types'

let currentAbortController: AbortController | null = null

// 默认 AI 模型配置
export const defaultAIConfig: AIReviewConfig = {
  provider: 'deepseek',
  modelId: 'deepseek-chat',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com/v1',
  thinkingBudget: 0
}

// 用户配置内存缓存 (支持本地持久化扩展)
let savedConfig: AIReviewConfig = { ...defaultAIConfig }

export function getStoredAIConfig(): AIReviewConfig {
  return { ...savedConfig }
}

export function updateStoredAIConfig(newConfig: Partial<AIReviewConfig>): AIReviewConfig {
  savedConfig = { ...savedConfig, ...newConfig }
  return { ...savedConfig }
}

// 停止当前正在进行的审查
export function stopCurrentReview(): void {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }
}

// 构造高质量的代码审查专业提示词
function buildReviewSystemPrompt(): string {
  return `你是一名世界顶尖的高级代码审查专家（Staff Software Engineer），拥有极强的代码品味与工程直觉。
请对给出的 Git 代码差异（Diff）进行全面而深刻的代码审查。

请重点关注以下核心维度：
1. 【严重缺陷与逻辑漏洞】：是否存在空指针、越界、竞态条件、死锁、逻辑遗漏或未处理的异常？
2. 【安全隐患】：是否存在未转义输入、注入攻击风险、敏感信息泄漏、越权或不安全的反序列化？
3. 【性能与资源泄漏】：是否存在高频重渲染、同步阻塞 I/O、无界循环、未释放的句柄/监听器或内存泄漏？
4. 【代码设计与可维护性】：是否符合单一职责原则、是否存在可简化的过度设计或冗余代码、命名是否清晰准确？

请按以下 Markdown 结构输出审查意见：
## 📋 变更概述与总体评价
(简明扼要总结本次改动的核心目的与风险等级：极高/高/中/低)

## 🚨 关键问题与缺陷 (如有)
(按问题严重程度列出，并附上具体文件、代码行与清晰的风险成因分析)

## 💡 改进建议与优化代码
(给出规范、健壮的重构建议或替换代码块)

## 综合复核结论
(清晰指出：可直接合并 / 需修改后重审 / 阻断合并)`
}

// 启动 AI 流式代码审查
export async function startReview(
  win: BrowserWindow,
  params: StartReviewParams
): Promise<void> {
  // 1. 中止之前的未完成审查
  stopCurrentReview()

  const abortController = new AbortController()
  currentAbortController = abortController

  const config: AIReviewConfig = { ...savedConfig, ...(params.config || {}) }
  const { diffText, filePath } = params

  const sendEvent = (payload: ReviewStreamPayload): void => {
    if (!win.isDestroyed()) {
      win.webContents.send('review:stream', payload)
    }
  }

  if (!diffText.trim()) {
    sendEvent({
      type: 'error',
      error: '没有检测到可审查的 Diff 差异内容'
    })
    return
  }

  sendEvent({ type: 'start' })

  try {
    // 2. 按需创建轻量模型运行时（树摇优化，严禁引入 providers/all）
    const models = createModels()
    models.setProvider(openaiProvider())
    models.setProvider(anthropicProvider())
    models.setProvider(deepseekProvider())

    // 根据 provider 选定模型对象与认证
    const providerId = config.provider === 'ollama' ? 'openai' : config.provider
    const targetModelId = config.modelId || (providerId === 'deepseek' ? 'deepseek-chat' : 'gpt-4o')

    let targetModel = models.getModel(providerId, targetModelId)

    // 如果是自定义或未在静态列表中的模型，动态补齐定义
    if (!targetModel) {
      targetModel = {
        id: targetModelId,
        provider: providerId,
        api: providerId === 'anthropic' ? 'anthropic-messages' : 'openai-responses',
        name: targetModelId,
        input: ['text'],
        output: ['text']
      } as any
    }

    const effectiveBaseUrl = config.baseUrl || undefined
    const effectiveApiKey = config.apiKey || (config.provider === 'ollama' ? 'ollama' : undefined)

    // 3. 构造请求上下文
    const userPrompt = `【待审查文件】：${filePath || '全局变更'}\n\n【Git Diff 内容】：\n\`\`\`diff\n${diffText}\n\`\`\``

    const stream = models.stream(
      targetModel as any,
      {
        systemPrompt: buildReviewSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: userPrompt,
            timestamp: Date.now()
          }
        ]
      },
      {
        signal: abortController.signal,
        apiKey: effectiveApiKey,
        ...(effectiveBaseUrl ? { baseUrl: effectiveBaseUrl } : {})
      } as any
    )

    // 4. 流式转发事件
    for await (const event of stream) {
      if (abortController.signal.aborted) {
        break
      }

      if (event.type === 'thinking_delta') {
        sendEvent({
          type: 'thinking',
          delta: event.delta
        })
      } else if (event.type === 'text_delta') {
        sendEvent({
          type: 'text',
          delta: event.delta
        })
      } else if (event.type === 'error') {
        const errMsg = (event.error as any)?.errorMessage || '模型响应异常'
        sendEvent({
          type: 'error',
          error: errMsg
        })
        return
      }
    }

    if (!abortController.signal.aborted) {
      sendEvent({ type: 'done' })
    }
  } catch (err: unknown) {
    if (abortController.signal.aborted) {
      sendEvent({ type: 'done' })
      return
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('AI 审查执行异常:', err)
    sendEvent({
      type: 'error',
      error: `审查请求失败: ${message}`
    })
  } finally {
    if (currentAbortController === abortController) {
      currentAbortController = null
    }
  }
}

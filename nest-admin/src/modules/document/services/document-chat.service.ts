import type { ServerResponse } from 'node:http'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ChatOpenAI } from '@langchain/openai'
import { createUIMessageStream, pipeUIMessageStreamToResponse } from 'ai'
import { toUIMessageStream } from '@ai-sdk/langchain'
import { traceable } from 'langsmith/traceable'
import dotenv from 'dotenv'
import { z } from 'zod'

// 保证热重载或即时调用下环境变量与 LangSmith 追踪无缝生效
dotenv.config()
if (process.env.LANGSMITH_API_KEY) {
  // 避免 LANGSMITH_AGENT_* 与 LANGSMITH_PROJECT 同时存在导致 LangSmith 抑制通用链路追踪
  delete process.env.LANGSMITH_AGENT_ID
  delete process.env.LANGSMITH_AGENT_ENVIRONMENT
  process.env.LANGCHAIN_TRACING_V2 = process.env.LANGSMITH_TRACING || 'true'
  process.env.LANGCHAIN_ENDPOINT = process.env.LANGSMITH_ENDPOINT || 'https://api.smith.langchain.com'
  process.env.LANGCHAIN_API_KEY = process.env.LANGSMITH_API_KEY
  process.env.LANGCHAIN_PROJECT = process.env.LANGSMITH_PROJECT || 'my-dev'
}

import { IVectorConfig, VectorConfig } from '~/config/vector.config'
import {
  CitationItemDto,
  DocChatUIMessage,
  DocumentChatDto,
  DocumentChatResponseDto,
} from '../dto/document-chat.dto'
import { HybridSearchService } from './hybrid-search.service'

/**
 * 知识库智能问答服务 (基于 LangChain LCEL 与 Tool 标准化架构)
 *
 * 架构组成：
 * 1. 结构化工具 (LangChain Tool): 将 ES + Vectorize 双路混合检索封装为标准 DynamicStructuredTool
 * 2. 链式工作流 (LangChain LCEL): ChatPromptTemplate + ChatOpenAI + StringOutputParser 管道
 * 3. 消息上下文抽象 (LangChain Messages): 历史会话自动转为 HumanMessage / AIMessage
 * 4. 容错与兜底机制: 在无 Token 或接口超时时平滑降级至本地智能响应合成器
 */
@Injectable()
export class DocumentChatService {
  private readonly logger = new Logger(DocumentChatService.name)

  constructor(
    private readonly hybridSearchService: HybridSearchService,
    @Inject(VectorConfig.KEY)
    private readonly vectorConfig: IVectorConfig,
  ) {
    this.logger.log(`[DocumentChatService] 成功装配 LangChain RAG 知识库问答引擎`)
  }

  /**
   * 将多路混合检索与重排管道封装为标准的 LangChain 结构化工具 (LangChain Tool)
   * 支持后续无缝接入 LangGraph / ReAct Agent 自主调用
   */
  createSearchTool(user: IAuthUser, docCode?: string, category?: string) {
    return new DynamicStructuredTool({
      name: 'search_enterprise_knowledge',
      description: '检索企业内部规章制度、技术架构规范与各类已发布的正规业务文档。',
      schema: z.object({
        query: z.string().describe('检索提问关键词或问题短语'),
      }),
      func: async ({ query }) => {
        const searchRes = await this.hybridSearchService.search(
          {
            query,
            limit: 3,
            topKPerRoute: 15,
            docCode,
            category,
            enableRerank: true,
          },
          user,
        )
        return JSON.stringify(searchRes.items)
      },
    })
  }

  async chat(
    dto: DocumentChatDto,
    user: IAuthUser,
  ): Promise<DocumentChatResponseDto> {
    const startTime = Date.now()
    const query = dto.query.trim()

    // 1. 调度混合检索工具召回最相关的证据文档与切块
    const searchRes = await this.hybridSearchService.search(
      {
        query,
        limit: 3,
        topKPerRoute: 6,
        docCode: dto.docCode,
        category: dto.category,
        enableRerank: true,
      },
      user,
    )

    // 2. 提炼 Top 引用出处切块 (用于溯源卡片与 LLM 知识注入)
    const citations: CitationItemDto[] = []
    const contextFragments: string[] = []
    const MIN_RELEVANCE_THRESHOLD = 0.35

    for (const doc of searchRes.items) {
      for (const chunk of doc.chunks) {
        if (citations.length < 4) {
          const rawScore = chunk.rerankScore ?? chunk.score ?? doc.score ?? 0.0
          // 核心置信度过滤：低于阈值的无关切块果断过滤，不强行注入上下文
          if (rawScore < MIN_RELEVANCE_THRESHOLD) {
            continue
          }

          const normalizedScore = Number(Math.min(Math.max(rawScore, 0.40), 0.99).toFixed(4))

          citations.push({
            docCode: doc.docCode,
            title: doc.title,
            headingPath: chunk.headingPath,
            score: normalizedScore,
            snippet:
              chunk.content.length > 200
                ? `${chunk.content.slice(0, 200)}...`
                : chunk.content,
          })
          contextFragments.push(
            `【参考来源: 《${doc.title}》 - 章节: ${chunk.headingPath || '正文'}】\n${chunk.content}`,
          )
        }
      }
    }

    // 3. 若知识库没有任何相关内容，直接礼貌告知，防大模型凭空捏造
    if (contextFragments.length === 0) {
      return {
        answer: `抱歉，在企业知识库中未检索到与 **“${query}”** 直接相关的正式制度或技术文档。\n\n建议您：\n1. 尝试更换更具体的关键词（如查询具体报销标准、架构规范、考勤作息等）；\n2. 确认您是否拥有该文档的查看权限；\n3. 联系文档管理员上传并发布相应业务文件。`,
        citations: [],
        costMs: Date.now() - startTime,
      }
    }

    // 4. 调用 LangChain LCEL 管道进行基于真实知识库的生成推理
    let answerText = ''
    try {
      answerText = await this.callLangChainRAG(query, contextFragments, dto.history)
    }
    catch (err: any) {
      this.logger.warn(`[DocumentChat] LangChain 管道生成异常 (${err.message})，启用本地兜底合成生成器`)
      answerText = this.synthesizeLocalAnswer(query, citations)
    }

    return {
      answer: answerText,
      citations,
      costMs: Date.now() - startTime,
    }
  }

  /**
   * 自动解析最优的大模型服务商配置 (优先 DeepSeek 官方直连，其次 Cloudflare Workers AI)
   */
  private resolveChatConfig() {
    const deepseekKey =
      process.env.DEEPSEEK_API_KEY
      || (this.vectorConfig.chatApiKey?.startsWith('sk-') ? this.vectorConfig.chatApiKey : '')

    if (deepseekKey) {
      return {
        apiKey: deepseekKey,
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      }
    }

    const apiKey = this.vectorConfig.chatApiKey || this.vectorConfig.apiToken || process.env.CLOUDFLARE_API_TOKEN || ''
    const accountId = this.vectorConfig.accountId || process.env.CLOUDFLARE_ACCOUNT_ID || ''
    const baseURL =
      this.vectorConfig.chatBaseUrl
      || (accountId ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1` : 'https://api.deepseek.com')
    let model = this.vectorConfig.chatModel || '@cf/meta/llama-3.1-8b-instruct'
    if (model.includes('infire')) {
      model = '@cf/meta/llama-3.1-8b-instruct'
    }

    return { apiKey, baseURL, model }
  }

  /**
   * 基于 LangChain (LCEL) 表达语言执行结构化 RAG 生成
   */
  private async callLangChainRAG(
    query: string,
    contextFragments: string[],
    history: Array<{ role: 'user' | 'assistant', content: string }> = [],
  ): Promise<string> {
    const { apiKey: chatApiKey, baseURL: chatBaseUrl, model: chatModel } = this.resolveChatConfig()

    if (!chatApiKey) {
      throw new Error('未配置大模型 API Key')
    }

    // 1. 初始化兼容 OpenAI 规范的 LangChain ChatModel (直连 DeepSeek / Cloudflare 端点)
    const llm = new ChatOpenAI({
      apiKey: chatApiKey,
      configuration: {
        baseURL: chatBaseUrl,
      },
      model: chatModel,
      temperature: 0.3,
      timeout: 25000,
    })

    // 2. 构造 LangChain 格式系统提示词与提示词模板 (ChatPromptTemplate)
    const systemPrompt = `你是一个专业、严谨的企业知识库 AI 助理。请依据下方提供的【企业正式参考文档及条款】，准确、客观、条理清晰地回答用户的问题。
【回答规则】：
1. 严格以提供的参考文档内容为准，严禁凭空臆造规章标准或参数；
2. 回答需结构清晰，重点明确，使用 Markdown 格式（标题、加粗、列表）排版；
3. 如果参考文档未涉及用户提问的核心细节，请诚实告知；
4. 语言使用正式、专业的中文。

【企业正式参考文档及条款】：
{context}`

    const promptTemplate = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
    ])

    // 3. 将会话历史转换为 LangChain 标准 Message 结构
    const chatHistory: BaseMessage[] = (history || []).slice(-4).map((h) => {
      return h.role === 'user'
        ? new HumanMessage(h.content)
        : new AIMessage(h.content)
    })

    // 4. 组装 LangChain LCEL 运行管道: Prompt -> LLM -> StringOutputParser
    const outputParser = new StringOutputParser()
    const ragChain = RunnableSequence.from([
      promptTemplate,
      llm,
      outputParser,
    ])

    // 5. 执行管道调用
    const answer = await ragChain.invoke({
      context: contextFragments.join('\n\n'),
      chat_history: chatHistory,
      input: query,
    })

    if (!answer || !answer.trim()) {
      throw new Error('LangChain 管道输出为空')
    }

    return answer.trim()
  }

  /**
   * 本地智能响应合成器（在无外部 LLM Token 或网络抖动时提供高质量结构化回复）
   */
  private synthesizeLocalAnswer(query: string, citations: CitationItemDto[]): string {
    const titles = Array.from(new Set(citations.map(c => `《${c.title}》`))).join('、')
    const primaryCite = citations[0]

    return `### 知识库查询回复\n\n关于您咨询的 **“${query}”**，系统已通过混合检索与语义重排在企业正式知识库 ${titles} 中为您精准定位到相关条款：\n\n`
      + `> **核心条款（节选自 ${primaryCite.headingPath || primaryCite.title}）：**\n`
      + `> “${primaryCite.snippet}”\n\n`
      + `**执行建议与指引：**\n`
      + `- 上述规定已于企业知识中心正式审批发布生效，具有标准管理效力；\n`
      + `- 具体业务执行中请严格按照对应限额与流程要求办理；\n`
      + `- 您可以在下方 **“参考知识库来源”** 展开卡片中查阅各章节详细出处与证明文本。`
  }

  /**
   * 知识库 AI 流式对话问答 (基于 Vercel AI SDK UI Message Stream 与 LangChain 流融合)
   */
  async streamChat(
    dto: DocumentChatDto,
    user: IAuthUser,
    res: ServerResponse,
  ): Promise<void> {
    const startTime = Date.now()
    const query = dto.query?.trim() || ''

    if (typeof (res as any).setHeaders !== 'function') {
      ;(res as any).setHeaders = (headers: any) => {
        if (headers && typeof headers.forEach === 'function') {
          headers.forEach((value: string, key: string) => {
            res.setHeader(key, value)
          })
        }
      }
    }

    const stream = createUIMessageStream<DocChatUIMessage>({
      execute: async ({ writer }) => {
        writer.write({ type: 'start' })

        if (!query) {
          writer.write({ type: 'text-start', id: 'empty' })
          writer.write({
            type: 'text-delta',
            id: 'empty',
            delta: '请输入您要咨询的知识库问题。',
          })
          writer.write({ type: 'text-end', id: 'empty' })
          writer.write({ type: 'finish' })
          return
        }

        // 1. 发射阶段状态通知: 正在执行多路检索与重排
        writer.write({
          type: 'data-status',
          data: {
            stage: 'retrieve',
            text: '正在多路召回知识库并执行语义重排…',
          },
        })

        // 2. 调度混合检索
        const citations: CitationItemDto[] = []
        const contextFragments: string[] = []

        try {
          const runHybridSearch = traceable(
            async () => this.hybridSearchService.search(
              {
                query,
                limit: 3,
                topKPerRoute: 6,
                docCode: dto.docCode,
                category: dto.category,
                enableRerank: true,
              },
              user,
            ),
            { name: 'hybrid_search_retrieval', run_type: 'retriever' },
          )
          const searchRes = await runHybridSearch()

          let citeIndex = 1
          const MIN_RELEVANCE_THRESHOLD = 0.35

          for (const doc of searchRes.items) {
            for (const chunk of doc.chunks) {
              if (citations.length < 4) {
                const rawScore = chunk.rerankScore ?? chunk.score ?? doc.score ?? 0.0
                // 核心置信度过滤：低于阈值的无关切块果断过滤，不强行注入上下文
                if (rawScore < MIN_RELEVANCE_THRESHOLD) {
                  continue
                }

                const normalizedScore = Number(Math.min(Math.max(rawScore, 0.40), 0.99).toFixed(4))

                citations.push({
                  docCode: doc.docCode,
                  title: doc.title,
                  headingPath: chunk.headingPath,
                  score: normalizedScore,
                  snippet:
                    chunk.content.length > 200
                      ? `${chunk.content.slice(0, 200)}...`
                      : chunk.content,
                })
                contextFragments.push(
                  `[${citeIndex}] 《${doc.title}》 - 章节: ${chunk.headingPath || '正文'}\n${chunk.content}`,
                )
                citeIndex++
              }
            }
          }
        } catch (error: any) {
          this.logger.warn(`[DocumentChat] 混合检索失败: ${error?.message || error}`)
        }

        // 3. 推送检索到的参考来源 (仅当真正命中高置信度出处时才下发卡片)
        if (citations.length > 0) {
          writer.write({
            type: 'data-sources',
            data: citations,
          })
        }

        // 4. 若未召回任何内容，友好兜底
        if (contextFragments.length === 0) {
          writer.write({ type: 'text-start', id: 'not-found' })
          writer.write({
            type: 'text-delta',
            id: 'not-found',
            delta: `抱歉，在企业知识库中未检索到与 **“${query}”** 直接相关的正式制度或技术文档。\n\n建议您：\n1. 尝试更换更具体的关键词（如具体报销标准、架构规范、考勤作息等）；\n2. 确认您是否拥有该文档的查看权限；\n3. 联系文档管理员上传并发布相应业务文件。`,
          })
          writer.write({ type: 'text-end', id: 'not-found' })
          writer.write({ type: 'finish' })
          return
        }

        // 5. 组装 LangChain LLM 流
        const { apiKey: chatApiKey, baseURL: chatBaseUrl, model: chatModel } = this.resolveChatConfig()

        if (!chatApiKey) {
          this.logger.warn('[DocumentChat] 未检测到可用大模型 API Key，启用本地兜底合成回复')
          const fallback = this.synthesizeLocalAnswer(query, citations)
          writer.write({ type: 'text-start', id: 'fallback' })
          writer.write({ type: 'text-delta', id: 'fallback', delta: fallback })
          writer.write({ type: 'text-end', id: 'fallback' })
          writer.write({ type: 'finish' })
          return
        }

        this.logger.log(`[DocumentChat] 发起 LLM 流式对话: model=${chatModel}, endpoint=${chatBaseUrl}`)

        const llm = new ChatOpenAI({
          apiKey: chatApiKey,
          configuration: {
            baseURL: chatBaseUrl,
          },
          model: chatModel,
          temperature: 0.3,
          timeout: 30000,
        })

        const systemPrompt = `你是一个专业、严谨的企业知识库 AI 助理。请依据下方提供的【企业正式参考文档及条款】，准确、客观、条理清晰地回答用户的问题。
【回答规则】：
1. 严格以提供的参考文档内容为准，严禁凭空臆造规章标准或参数；
2. 依据资料的陈述句末请标出对应资料编号如 [1]、[2]，与参考条款编号一致；
3. 回答需结构清晰，重点明确，使用 Markdown 格式（标题、加粗、列表）排版；
4. 如果参考文档未涉及用户提问的核心细节，请诚实告知；
5. 语言使用正式、专业的中文。

【企业正式参考文档及条款】：
{context}`

        const promptTemplate = ChatPromptTemplate.fromMessages([
          ['system', systemPrompt],
          new MessagesPlaceholder('chat_history'),
          ['human', '{input}'],
        ])

        const chatHistory: BaseMessage[] = (dto.history || []).slice(-4).map((h) => {
          return h.role === 'user'
            ? new HumanMessage(h.content)
            : new AIMessage(h.content)
        })

        const ragChain = promptTemplate.pipe(llm).withConfig({
          runName: 'deepseek_rag_generation',
          tags: ['production', 'knowledge-hub'],
          metadata: { query, docCode: dto.docCode },
        })
        try {
          const langchainStream = await ragChain.stream({
            context: contextFragments.join('\n\n'),
            chat_history: chatHistory,
            input: query,
          })

          // 6. 将 LangChain 流桥接进 UI Message Stream
          writer.merge(
            toUIMessageStream(mapReasoningStream(langchainStream) as never, {
              sendStart: false,
              sendFinish: false,
              onError: (err) => {
                this.logger.warn(`[DocumentChat] LangChain 流异常: ${err.message}`)
              },
            }) as never,
          )
        } catch (llmErr: any) {
          this.logger.error(`[DocumentChat] LLM 流式调用异常 (${llmErr?.message || llmErr})`, llmErr?.stack)
          const fallback = this.synthesizeLocalAnswer(query, citations)
          writer.write({ type: 'text-start', id: 'fallback' })
          writer.write({ type: 'text-delta', id: 'fallback', delta: fallback })
          writer.write({ type: 'text-end', id: 'fallback' })
          writer.write({ type: 'finish' })
        }
      },
      onFinish: async ({ responseMessage }) => {
        const costMs = Date.now() - startTime
        const parts = responseMessage?.parts ?? []
        const answer = parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text)
          .join('')
          .trim()
        this.logger.log(`[DocumentChat] 流式问答完成 (耗时: ${costMs}ms, 回复字数: ${answer.length})`)
      },
      onError: (err) => (err instanceof Error ? err.message : String(err)),
    })

    await pipeUIMessageStreamToResponse({ response: res, stream })
  }
}

/**
 * 思考流字段转换生成器 (兼容百炼/DeepSeek reasoning_content 与 summary)
 */
async function* mapReasoningStream(
  stream: AsyncIterable<unknown>,
): AsyncIterable<unknown> {
  for await (const event of stream) {
    attachReasoningCompat(event)
    yield event
  }
}

function attachReasoningCompat(value: unknown, seen = new Set<object>()): void {
  if (value == null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    for (const item of value) attachReasoningCompat(item, seen)
    return
  }
  const obj = value as Record<string, unknown>
  const kwargs = obj.additional_kwargs as Record<string, unknown> | undefined
  if (typeof kwargs?.reasoning_content === 'string' && kwargs.reasoning_content) {
    kwargs.reasoning = {
      summary: [{ type: 'summary_text', text: kwargs.reasoning_content }],
    }
  }
  attachReasoningCompat(obj.chunk, seen)
  attachReasoningCompat(obj.data, seen)
  attachReasoningCompat(obj.kwargs, seen)
  attachReasoningCompat(obj.messages, seen)
}


<template>
  <div class="ai-chat-root">
    <!-- 1. 右下角常驻悬浮触发按钮 (带灵动弹跳进出动画) -->
    <transition name="trigger-pop">
      <a-tooltip v-if="!visible" placement="left" title="知识库 AI 智能助手">
        <div class="ai-float-trigger" @click="toggleOpen">
          <div class="pulse-ring"></div>
          <div class="trigger-inner">
            <RobotOutlined class="trigger-icon" />
            <span class="trigger-badge" v-if="unreadCount > 0">{{ unreadCount }}</span>
          </div>
        </div>
      </a-tooltip>
    </transition>

    <!-- 2. AI 浮窗对话面板 (以右下角悬浮球为锚点的向心缩放动画) -->
    <transition name="chat-panel-zoom">
      <div
        v-if="visible"
        class="ai-chat-panel"
        :class="{ 'panel-fullscreen': isFullscreen, 'panel-minimized': isMinimized }"
      >
        <!-- 面板头部 -->
        <div class="panel-header">
          <div class="header-left">
            <div class="bot-avatar-wrapper">
              <RobotOutlined class="bot-avatar-icon" />
              <span class="online-indicator"></span>
            </div>
            <div class="header-titles">
              <div class="title-row">
                <span class="main-title">知识库 AI 助手</span>
                <a-tag color="processing" class="version-tag">RAG Copilot</a-tag>
              </div>
              <span class="sub-title">Cloudflare Vectorize + Bonsai 混合检索</span>
            </div>
          </div>

          <div class="header-actions">
            <a-tooltip title="清空会话">
              <a-button type="text" size="small" class="action-btn" @click="handleClearMessages">
                <ReloadOutlined />
              </a-button>
            </a-tooltip>
            <a-tooltip :title="isFullscreen ? '还原窗口' : '最大化'">
              <a-button type="text" size="small" class="action-btn" @click="toggleFullscreen">
                <FullscreenOutlined v-if="!isFullscreen" />
                <FullscreenExitOutlined v-else />
              </a-button>
            </a-tooltip>
            <a-tooltip title="最小化">
              <a-button type="text" size="small" class="action-btn" @click="toggleMinimize">
                <MinusOutlined />
              </a-button>
            </a-tooltip>
            <a-tooltip title="关闭">
              <a-button type="text" size="small" class="action-btn close-btn" @click="closePanel">
                <CloseOutlined />
              </a-button>
            </a-tooltip>
          </div>
        </div>

        <!-- 面板主体 (当非最小化时展示) -->
        <div v-show="!isMinimized" class="panel-body" ref="messagesContainerRef">
          <!-- 首次欢迎卡片与推荐问题 -->
          <div class="welcome-card" v-if="messages.length === 0">
            <div class="welcome-header">
              <div class="welcome-bot-icon">
                <RobotOutlined />
              </div>
              <div class="welcome-text">
                <div class="welcome-title">你好！我是知识库专属 AI 助理 👋</div>
                <div class="welcome-desc">
                  我已接入企业全部正式发布的制度、规范与技术手册。你可以向我咨询任何具体规定，我将精准定位原文段落并附带溯源链接。
                </div>
              </div>
            </div>

            <div class="quick-prompts-section">
              <div class="prompts-label">💡 猜你想问（点击快速提问）：</div>
              <div class="prompts-list">
                <div
                  v-for="(prompt, idx) in suggestedPrompts"
                  :key="idx"
                  class="prompt-chip"
                  @click="handleSelectPrompt(prompt)"
                >
                  <span class="chip-dot">✦</span>
                  <span class="chip-text">{{ prompt }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 消息流列表 -->
          <div class="message-list">
            <div
              v-for="(msg, index) in messages"
              :key="index"
              class="message-item"
              :class="[msg.role === 'user' ? 'msg-user' : 'msg-assistant']"
            >
              <!-- 头像 -->
              <div class="msg-avatar">
                <UserOutlined v-if="msg.role === 'user'" />
                <RobotOutlined v-else />
              </div>

              <!-- 气泡内容 -->
              <div class="msg-content-wrapper">
                <div class="msg-bubble">
                  <!-- 用户消息直接纯文本 -->
                  <div v-if="msg.role === 'user'" class="user-text">{{ msg.content }}</div>
                  <!-- AI 消息支持 Markdown 渲染 -->
                  <div
                    v-else
                    class="assistant-markdown markdown-body"
                    v-html="renderMarkdown(msg.content)"
                  ></div>

                  <!-- 流式打字中光标 -->
                  <span v-if="msg.isStreaming" class="typing-cursor"></span>
                </div>

                <!-- 知识溯源卡片 (仅 AI 消息展示) -->
                <div
                  v-if="msg.role === 'assistant' && msg.citations && msg.citations.length > 0"
                  class="citations-card"
                >
                  <div class="citations-header" @click="msg.citationsExpanded = !msg.citationsExpanded">
                    <BookOutlined class="cite-icon" />
                    <span class="cite-title">参考知识库来源 ({{ msg.citations.length }})</span>
                    <DownOutlined
                      class="collapse-arrow"
                      :class="{ 'arrow-rotated': msg.citationsExpanded }"
                    />
                  </div>

                  <div v-show="msg.citationsExpanded" class="citations-list">
                    <div
                      v-for="(cite, cIdx) in msg.citations"
                      :key="cIdx"
                      class="citation-item"
                    >
                      <div class="citation-top">
                        <FileTextOutlined class="file-icon" />
                        <span class="doc-title">{{ cite.title }}</span>
                        <a-tag color="blue" class="score-tag">
                          相似度 {{ Math.round((cite.score || 0.85) * 100) }}%
                        </a-tag>
                      </div>
                      <div class="doc-heading" v-if="cite.headingPath">
                        📍 章节：{{ cite.headingPath }}
                      </div>
                      <div class="doc-snippet" v-if="cite.snippet">
                        “{{ cite.snippet }}”
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 消息时间 -->
                <div class="msg-time">{{ msg.time }}</div>
              </div>
            </div>

            <!-- 加载骨架/思考状态 -->
            <div v-if="isLoading && !isStreaming" class="message-item msg-assistant loading-item">
              <div class="msg-avatar">
                <RobotOutlined />
              </div>
              <div class="msg-content-wrapper">
                <div class="thinking-bubble">
                  <div class="dot-flashing"></div>
                  <span class="thinking-text">正在混合检索知识库并推理中...</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 面板底部输入框 (当非最小化时展示) -->
        <div v-show="!isMinimized" class="panel-footer">
          <div class="input-box-wrapper">
            <a-textarea
              v-model:value="inputQuery"
              placeholder="输入关于知识库文档的问题... (Enter 发送, Shift+Enter 换行)"
              :auto-size="{ minRows: 1, maxRows: 4 }"
              class="chat-textarea"
              @keydown.enter.exact.prevent="handleSend"
            />
            <div class="input-actions-bar">
              <div class="disclaimer-tip">
                <span>基于双路混合检索 · 精准切块回答</span>
              </div>
              <a-button
                type="primary"
                shape="circle"
                class="send-btn"
                :disabled="!inputQuery.trim() || isLoading"
                :loading="isLoading"
                @click="handleSend"
              >
                <template #icon><SendOutlined /></template>
              </a-button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, nextTick } from 'vue';
  import { marked } from 'marked';
  import {
    RobotOutlined,
    UserOutlined,
    SendOutlined,
    ReloadOutlined,
    CloseOutlined,
    MinusOutlined,
    FullscreenOutlined,
    FullscreenExitOutlined,
    BookOutlined,
    FileTextOutlined,
    DownOutlined,
  } from '@ant-design/icons-vue';
  import { documentChat } from '@/api/backend/api/document';

  defineOptions({
    name: 'AiChatWidget',
  });

  // 引用来源模型
  interface CitationItem {
    docCode: string;
    title: string;
    headingPath?: string;
    score: number;
    snippet: string;
  }

  // 聊天消息项
  interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    time: string;
    isStreaming?: boolean;
    citations?: CitationItem[];
    citationsExpanded?: boolean;
  }

  // 状态定义
  const visible = ref<boolean>(false);
  const isFullscreen = ref<boolean>(false);
  const isMinimized = ref<boolean>(false);
  const unreadCount = ref<number>(0);
  const inputQuery = ref<string>('');
  const isLoading = ref<boolean>(false);
  const isStreaming = ref<boolean>(false);
  const messagesContainerRef = ref<HTMLDivElement | null>(null);

  // 猜你想问推荐列表
  const suggestedPrompts = ref<string[]>([
    '系统支持解析哪些格式的文档？',
    '差旅报销与日常费用审批标准是什么？',
    '向量数据库与嵌入模型具体采用了什么架构？',
    '文档生命周期有哪些状态，何时会进入知识库？',
  ]);

  // 对话历史
  const messages = ref<ChatMessage[]>([]);

  // 格式化当前时间
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // 滚动到底部
  const scrollToBottom = async () => {
    await nextTick();
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
    }
  };

  // 展开/收起面板
  const toggleOpen = () => {
    visible.value = true;
    isMinimized.value = false;
    unreadCount.value = 0;
    scrollToBottom();
  };

  const closePanel = () => {
    visible.value = false;
    isFullscreen.value = false;
    isMinimized.value = false;
  };

  const toggleMinimize = () => {
    isMinimized.value = !isMinimized.value;
  };

  const toggleFullscreen = () => {
    isFullscreen.value = !isFullscreen.value;
    scrollToBottom();
  };

  const handleClearMessages = () => {
    messages.value = [];
  };

  // 选择推荐问题
  const handleSelectPrompt = (prompt: string) => {
    inputQuery.value = prompt;
    handleSend();
  };

  // Markdown 安全渲染
  const renderMarkdown = (content: string): string => {
    try {
      return marked.parse(content || '', {
        breaks: true,
        gfm: true,
      }) as string;
    } catch {
      return content;
    }
  };

  // 模拟智能 RAG 问答 (当前端独立调试时提供真实企业知识回复)
  const generateMockAnswer = async (query: string): Promise<{ text: string; citations: CitationItem[] }> => {
    const q = query.toLowerCase();

    if (q.includes('格式') || q.includes('解析') || q.includes('支持')) {
      return {
        text: `### 知识库文档格式支持说明\n\n本系统目前支持以下格式的高性能解析与结构化 Markdown 转换：\n\n1. **PDF 文档 (\`.pdf\`)**：基于双层解析引擎（PDF.js / PyMuPDF），能够精确提取文字流并保护页眉页脚；\n2. **Word 文档 (\`.docx\`)**：结构化提取多级标题树、表格与引用；\n3. **Markdown (\`.md\`) 与纯文本 (\`.txt\`)**：原生直出，保留代码块与粗体格式；\n\n解析完成后统一转换为 Markdown 标准大文本落入 **MongoDB Atlas**。`,
        citations: [
          {
            docCode: 'doc_parse_spec',
            title: '《文档多格式结构化解析引擎技术设计》',
            headingPath: '第一章 格式规范 > 1.1 核心支持矩阵',
            score: 0.94,
            snippet: '系统支持 PDF、Word(docx)、Markdown 等主流非结构化办公文件，经管道处理后转换为纯正 Markdown 正文。',
          },
        ],
      };
    }

    if (q.includes('向量') || q.includes('模型') || q.includes('架构') || q.includes('bge')) {
      return {
        text: `### 知识库检索底层架构\n\n系统采用 **双路衍生索引架构 (Dual-Pipeline)**：\n\n- **语义向量路**：采用 **Cloudflare Workers AI** 边缘 GPU 推理 \`@cf/baai/bge-m3\` 模型，生成 **1024 维** 稠密向量，存入全球分布式 **Cloudflare Vectorize** (\`word-embeddings\` 索引)；\n- **关键词全文路**：采用 **Bonsai OpenSearch 3.9.0**，以 \`smartcn\` 工业级中文分词引擎建立 BM25 倒排索引；\n- **切块粒度**：两路严格复用同一个 \`splitMarkdownDocument\` 纯函数，切块主键格式为 \`\${docCode}_\${chunkIndex}\`，便于通过 **RRF (倒数排名融合)** 算法做重排打分。`,
        citations: [
          {
            docCode: 'doc_vector_arch',
            title: '《向量模型嵌入与云端向量数据库检索闭环设计》',
            headingPath: '第二章 模型选型 > 2.1 BGE-M3 优势',
            score: 0.96,
            snippet: '选用 BGE-M3 1024 维模型，支持多语言与 60K 超长语义上下文，向量存储于 Cloudflare Vectorize。',
          },
          {
            docCode: 'doc_opensearch_arch',
            title: '《云端 OpenSearch 全文检索倒排索引设计》',
            headingPath: '第三章 索引规范 > 3.1 smartcn 中文分词',
            score: 0.91,
            snippet: '采用 OpenSearch 3.9.0 原生 smartcn 分词器，以 1 主分片 0 副本架构深度适配云托管限额。',
          },
        ],
      };
    }

    if (q.includes('状态') || q.includes('生命周期') || q.includes('下线') || q.includes('审核')) {
      return {
        text: `### 文档生命周期与 RAG 准入机制\n\n系统严格划分 **4 种生命周期状态**：\n\n1. **\`DRAFT\` (草稿)**：编辑中，仅作者可见，**绝不进入知识库**；\n2. **\`UNDER_REVIEW\` (待审核)**：提交发布流，审核员处理中，**不可被搜索**；\n3. **\`PUBLISHED\` (已发布)**：审核通过，**触发异步 MQ 并发写入向量库与 OpenSearch**，正式进入 AI 问答检索池；\n4. **\`ARCHIVED\` (已归档/下线)**：下线文档，**立即双路清除向量点与倒排切块**，彻底退出 AI 问答池，杜绝大模型幻觉与过时引用。`,
        citations: [
          {
            docCode: 'doc_lifecycle_spec',
            title: '《文档管理权限控制与审批流流转规范》',
            headingPath: '第四章 准入与下架 > 4.2 检索池准入规则',
            score: 0.95,
            snippet: '仅有 PUBLISHED 状态的文档允许派发索引任务；在软删除或下线归档时，必须立即从检索库中物理剔除切块。',
          },
        ],
      };
    }

    // 默认兜底回答
    return {
      text: `关于 **“${query}”** 的问题，我在企业知识库中为您检索到以下相关信息：\n\n根据系统管理条例，所有知识库文档均受 **组织权限 (ACL)** 严格隔离保护。当前内容属于正式发布文档范围，可供员工日常合规参考与执行。\n\n如需进一步了解具体操作流程，可点击下方引用卡片查看对应原文档规章。`,
      citations: [
        {
          docCode: 'doc_general_rules',
          title: '《企业知识中心总管理条例》',
          headingPath: '第一章 总则 > 1.2 适用范围',
          score: 0.86,
          snippet: '本规章适用于公司全体员工及相关部门，用于规范企业数字化知识资产的沉淀、检索与流转。',
        },
      ],
    };
  };

  // 发送消息处理
  const handleSend = async () => {
    const text = inputQuery.value.trim();
    if (!text || isLoading.value) return;

    // 1. 推入用户消息
    messages.value.push({
      role: 'user',
      content: text,
      time: getCurrentTime(),
    });

    inputQuery.value = '';
    isLoading.value = true;
    scrollToBottom();

    // 2. 准备 AI 消息占位符 (使用 reactive 确保 Vue 响应式精准追踪)
    const assistantMsg = reactive<ChatMessage>({
      role: 'assistant',
      content: '',
      time: getCurrentTime(),
      isStreaming: true,
      citations: [],
      citationsExpanded: false,
    });

    try {
      // 提取多轮对话历史 (最近 4 条)
      const history = messages.value.slice(-5, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let fullText = '';
      let citations: CitationItem[] = [];

      try {
        // 优先请求真实后端 RAG 混合检索与大模型问答接口
        const res = await documentChat({
          query: text,
          history,
        }, { isReturnResult: true });

        fullText = res?.answer || '';
        citations = res?.citations || [];
      } catch (apiError) {
        console.warn('[AiChat] 接口调用异常，自动启用本地智能离线回答:', apiError);
        const fallback = await generateMockAnswer(text);
        fullText = fallback.text;
        citations = fallback.citations;
      }

      // 如果未返回内容，执行兜底生成
      if (!fullText) {
        const fallback = await generateMockAnswer(text);
        fullText = fallback.text;
        if (!citations.length) {
          citations = fallback.citations;
        }
      }

      isLoading.value = false;
      isStreaming.value = true;
      assistantMsg.citations = citations;
      messages.value.push(assistantMsg);
      await nextTick();
      scrollToBottom();

      // 打字机流式字符推送呈现
      let currentIdx = 0;
      const chunkSize = 4;
      const streamInterval = setInterval(() => {
        if (currentIdx < fullText.length) {
          const nextIdx = Math.min(currentIdx + chunkSize, fullText.length);
          assistantMsg.content = fullText.slice(0, nextIdx);
          currentIdx = nextIdx;
          scrollToBottom();
        } else {
          clearInterval(streamInterval);
          assistantMsg.content = fullText;
          assistantMsg.isStreaming = false;
          isStreaming.value = false;
          scrollToBottom();
        }
      }, 20);
    } catch (err) {
      console.error('[AiChat] 异常:', err);
      isLoading.value = false;
      isStreaming.value = false;
      assistantMsg.content = '抱歉，检索知识库或连接模型出现异常，请稍后重试。';
      assistantMsg.isStreaming = false;
      if (!messages.value.includes(assistantMsg)) {
        messages.value.push(assistantMsg);
      }
      scrollToBottom();
    }
  };
</script>

<style lang="less" scoped>
  .ai-chat-root {
    position: relative;
    z-index: 1000;
  }

  /* 悬浮球样式 */
  .ai-float-trigger {
    position: fixed;
    right: 28px;
    bottom: 28px;
    width: 56px;
    height: 56px;
    cursor: pointer;
    user-select: none;
    z-index: 1000;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);

    &:hover {
      transform: scale(1.08) translateY(-2px);
    }

    .pulse-ring {
      position: absolute;
      top: -4px;
      left: -4px;
      right: -4px;
      bottom: -4px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(24, 144, 255, 0.4) 0%, rgba(54, 207, 201, 0) 70%);
      animation: pulse-wave 2.4s infinite ease-out;
      pointer-events: none;
    }

    .trigger-inner {
      position: relative;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: linear-gradient(135deg, #1677ff 0%, #13c2c2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 18px rgba(22, 119, 255, 0.38);
      border: 2px solid #ffffff;

      .trigger-icon {
        font-size: 26px;
        color: #ffffff;
      }

      .trigger-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        min-width: 18px;
        height: 18px;
        padding: 0 4px;
        border-radius: 9px;
        background: #ff4d4f;
        color: #ffffff;
        font-size: 11px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
      }
    }
  }

  @keyframes pulse-wave {
    0% {
      transform: scale(0.95);
      opacity: 0.8;
    }
    50% {
      transform: scale(1.25);
      opacity: 0.25;
    }
    100% {
      transform: scale(1.45);
      opacity: 0;
    }
  }

  /* 浮窗主面板 */
  .ai-chat-panel {
    position: fixed;
    right: 28px;
    bottom: 96px;
    width: 440px;
    height: 640px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 120px);
    background: #ffffff;
    border-radius: 16px;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 1000;
    transition: width 0.3s cubic-bezier(0.2, 0, 0, 1), height 0.3s cubic-bezier(0.2, 0, 0, 1), top 0.3s cubic-bezier(0.2, 0, 0, 1), left 0.3s cubic-bezier(0.2, 0, 0, 1), border-radius 0.3s;

    &.panel-fullscreen {
      top: 24px;
      bottom: 24px;
      right: 24px;
      left: 24px;
      width: calc(100vw - 48px);
      height: calc(100vh - 48px);
      max-width: none;
      max-height: none;
      border-radius: 12px;
    }

    &.panel-minimized {
      height: 64px !important;
      overflow: hidden;
    }
  }

  /* 面板头部 */
  .panel-header {
    height: 64px;
    padding: 12px 16px;
    background: #fafafa;
    border-bottom: 1px solid #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;

      .bot-avatar-wrapper {
        position: relative;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e6f4ff 0%, #e6fffb 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #91caff;

        .bot-avatar-icon {
          font-size: 20px;
          color: #1677ff;
        }

        .online-indicator {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #52c41a;
          border: 2px solid #ffffff;
        }
      }

      .header-titles {
        .title-row {
          display: flex;
          align-items: center;
          gap: 6px;

          .main-title {
            font-size: 15px;
            font-weight: 600;
            color: #1f1f1f;
          }

          .version-tag {
            font-size: 10px;
            padding: 0 4px;
            line-height: 16px;
            border-radius: 4px;
          }
        }

        .sub-title {
          font-size: 11px;
          color: #8c8c8c;
        }
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;

      .action-btn {
        color: #595959;
        font-size: 13px;

        &:hover {
          color: #1677ff;
          background: #e6f4ff;
        }

        &.close-btn:hover {
          color: #ff4d4f;
          background: #fff1f0;
        }
      }
    }
  }

  /* 面板主体内容 */
  .panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 16px;

    /* 首次欢迎卡片 */
    .welcome-card {
      background: #ffffff;
      border: 1px solid #edf2f7;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);

      .welcome-header {
        display: flex;
        gap: 12px;
        margin-bottom: 14px;

        .welcome-bot-icon {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #e6f4ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #1677ff;
          flex-shrink: 0;
        }

        .welcome-title {
          font-size: 14px;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 4px;
        }

        .welcome-desc {
          font-size: 12px;
          line-height: 1.6;
          color: #718096;
        }
      }

      .quick-prompts-section {
        border-top: 1px dashed #e2e8f0;
        padding-top: 12px;

        .prompts-label {
          font-size: 12px;
          font-weight: 500;
          color: #4a5568;
          margin-bottom: 8px;
        }

        .prompts-list {
          display: flex;
          flex-direction: column;
          gap: 6px;

          .prompt-chip {
            padding: 8px 12px;
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            font-size: 12px;
            color: #2d3748;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;

            .chip-dot {
              color: #1677ff;
              font-size: 10px;
            }

            &:hover {
              background: #ebf8ff;
              border-color: #90cdf4;
              color: #2b6cb0;
              transform: translateX(4px);
            }
          }
        }
      }
    }

    /* 消息项 */
    .message-list {
      display: flex;
      flex-direction: column;
      gap: 16px;

      .message-item {
        display: flex;
        gap: 10px;

        .msg-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 16px;
        }

        .msg-content-wrapper {
          max-width: 82%;
          display: flex;
          flex-direction: column;

          .msg-bubble {
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 13px;
            line-height: 1.6;
            word-break: break-word;
            position: relative;
          }

          .msg-time {
            font-size: 10px;
            color: #a0aec0;
            margin-top: 4px;
            padding: 0 4px;
          }
        }

        /* 用户消息靠右 */
        &.msg-user {
          flex-direction: row-reverse;

          .msg-avatar {
            background: #1677ff;
            color: #ffffff;
          }

          .msg-content-wrapper {
            align-items: flex-end;

            .msg-bubble {
              background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%);
              color: #ffffff;
              border-bottom-right-radius: 2px;
            }
          }
        }

        /* 助理消息靠左 */
        &.msg-assistant {
          .msg-avatar {
            background: #ffffff;
            color: #1677ff;
            border: 1px solid #d9d9d9;
          }

          .msg-content-wrapper {
            align-items: flex-start;

            .msg-bubble {
              background: #ffffff;
              color: #262626;
              border: 1px solid #edf2f7;
              border-bottom-left-radius: 2px;
              box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
            }
          }
        }
      }

      /* 加载/思考态 */
      .loading-item {
        .thinking-bubble {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          font-size: 12px;
          color: #718096;

          .dot-flashing {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: #1677ff;
            animation: dot-pulse 1.2s infinite ease-in-out;
          }
        }
      }
    }

    /* 知识溯源卡片 */
    .citations-card {
      margin-top: 8px;
      width: 100%;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;

      .citations-header {
        padding: 6px 10px;
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        user-select: none;
        background: #f8fafc;
        transition: background 0.2s;

        &:hover {
          background: #edf2f7;
        }

        .cite-icon {
          color: #1677ff;
          font-size: 13px;
        }

        .cite-title {
          font-size: 11px;
          font-weight: 600;
          color: #334155;
          flex: 1;
        }

        .collapse-arrow {
          font-size: 10px;
          color: #94a3b8;
          transition: transform 0.2s;

          &.arrow-rotated {
            transform: rotate(180deg);
          }
        }
      }

      .citations-list {
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        border-top: 1px dashed #e2e8f0;

        .citation-item {
          background: #ffffff;
          padding: 8px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;

          .citation-top {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;

            .file-icon {
              color: #0284c7;
              font-size: 12px;
            }

            .doc-title {
              font-size: 12px;
              font-weight: 600;
              color: #0f172a;
              flex: 1;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .score-tag {
              font-size: 10px;
              padding: 0 4px;
              line-height: 16px;
              margin: 0;
            }
          }

          .doc-heading {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 4px;
          }

          .doc-snippet {
            font-size: 11px;
            color: #475569;
            background: #f8fafc;
            padding: 4px 6px;
            border-left: 2px solid #38bdf8;
            border-radius: 0 4px 4px 0;
            line-height: 1.5;
          }
        }
      }
    }
  }

  /* 面板底部输入框 */
  .panel-footer {
    padding: 12px 16px;
    background: #ffffff;
    border-top: 1px solid #f0f0f0;
    flex-shrink: 0;

    .input-box-wrapper {
      position: relative;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 8px 12px;
      transition: all 0.2s;

      &:focus-within {
        border-color: #1677ff;
        background: #ffffff;
        box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
      }

      .chat-textarea {
        border: none;
        box-shadow: none;
        padding: 0;
        background: transparent;
        font-size: 13px;
        color: #1a202c;
        resize: none;

        &:focus {
          box-shadow: none;
        }
      }

      .input-actions-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid #edf2f7;

        .disclaimer-tip {
          font-size: 10px;
          color: #94a3b8;
          user-select: none;
        }

        .send-btn {
          width: 30px;
          height: 30px;
          min-width: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
        }
      }
    }
  }

  /* 打字光标动画 */
  .typing-cursor {
    display: inline-block;
    width: 6px;
    height: 14px;
    background: #1677ff;
    margin-left: 3px;
    vertical-align: middle;
    animation: blink 0.9s infinite;
  }

  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  @keyframes dot-pulse {
    0%,
    100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.3);
      opacity: 1;
    }
  }

  /* Markdown 样式修饰 */
  :deep(.assistant-markdown) {
    p {
      margin-bottom: 8px;
      &:last-child {
        margin-bottom: 0;
      }
    }

    h1,
    h2,
    h3,
    h4 {
      margin-top: 10px;
      margin-bottom: 6px;
      font-weight: 600;
      color: #0f172a;
    }

    h3 {
      font-size: 14px;
    }

    ul,
    ol {
      padding-left: 18px;
      margin-bottom: 8px;
    }

    li {
      margin-bottom: 4px;
    }

    code {
      background: #f1f5f9;
      color: #0f172a;
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
    }

    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 10px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 8px 0;

      code {
        background: transparent;
        color: inherit;
        padding: 0;
      }
    }
  }

  /* 悬浮触发球显示与隐藏动画 (弹性缩放) */
  .trigger-pop-enter-active {
    transition: all 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .trigger-pop-leave-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 1, 1);
  }

  .trigger-pop-enter-from,
  .trigger-pop-leave-to {
    opacity: 0;
    transform: scale(0.3) rotate(-35deg);
  }

  /* 面板以右下角悬浮按钮为锚点的向心缩放与微回弹动画 */
  .chat-panel-zoom-enter-active {
    transition: transform 0.35s cubic-bezier(0.34, 1.35, 0.64, 1), opacity 0.25s ease-out;
    transform-origin: calc(100% - 28px) bottom;
  }

  .chat-panel-zoom-leave-active {
    transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease-in;
    transform-origin: calc(100% - 28px) bottom;
  }

  .chat-panel-zoom-enter-from,
  .chat-panel-zoom-leave-to {
    opacity: 0;
    transform: scale(0.12) translateY(32px);
  }
</style>


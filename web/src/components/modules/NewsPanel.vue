<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  RefreshCw,
  ExternalLink,
  FileText,
  Copy,
  Check,
  X,
  SlidersHorizontal,
  Flame,
  ArrowRight,
  MessageSquare
} from 'lucide-vue-next'

interface NewsItem {
  id?: number
  title: string
  url: string
  score: number
  author: string
  time?: number
  comments_count?: number
}

const newsList = ref<NewsItem[]>([])
const newsLoading = ref(false)
const errorMessage = ref('')
const selectedLimit = ref<number>(10)
const copiedIndex = ref<number | null>(null)

// 提取正文阅读抽屉/弹窗状态
const isReaderOpen = ref(false)
const readerLoading = ref(false)
const readerTitle = ref('')
const readerUrl = ref('')
const readerContent = ref('')
const readerCopied = ref(false)

// 获取新闻热榜
const fetchNews = async () => {
  newsLoading.value = true
  errorMessage.value = ''
  try {
    const res = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'get_tech_news',
        args: { limit: selectedLimit.value }
      })
    })
    const data = await res.json()
    if (data.error) {
      errorMessage.value = data.error
      newsList.value = []
    } else {
      newsList.value = Array.isArray(data) ? data : (data.results || [])
    }
  } catch (e: any) {
    errorMessage.value = `请求异常: ${e.message || '网络连接超时'}`
  } finally {
    newsLoading.value = false
  }
}

// 复制链接
const copyLink = async (url: string, index: number) => {
  try {
    await navigator.clipboard.writeText(url)
    copiedIndex.value = index
    setTimeout(() => {
      if (copiedIndex.value === index) {
        copiedIndex.value = null
      }
    }, 2000)
  } catch {
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    copiedIndex.value = index
    setTimeout(() => {
      copiedIndex.value = null
    }, 2000)
  }
}

// 免翻墙阅读目标网页正文 (Jina Reader 提取)
const openReader = async (item: NewsItem) => {
  readerTitle.value = item.title
  readerUrl.value = item.url
  readerContent.value = ''
  isReaderOpen.value = true
  readerLoading.value = true

  try {
    const res = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'fetch_webpage',
        args: { url: item.url }
      })
    })
    const data = await res.json()
    readerContent.value = typeof data === 'string' ? data : (data.result || data.text || JSON.stringify(data, null, 2))
  } catch (err: any) {
    readerContent.value = `抓取内容异常: ${err.message || '目标站点不可达'}`
  } finally {
    readerLoading.value = false
  }
}

const copyReaderContent = async () => {
  if (!readerContent.value) return
  await navigator.clipboard.writeText(readerContent.value)
  readerCopied.value = true
  setTimeout(() => {
    readerCopied.value = false
  }, 2000)
}

// 解析出文章所属域名
const getHostDomain = (urlStr: string) => {
  try {
    const parsed = new URL(urlStr)
    return parsed.hostname.replace('www.', '')
  } catch {
    return 'ycombinator.com'
  }
}

// 计算大致时间差
const formatTimeAgo = (timestamp?: number) => {
  if (!timestamp) return ''
  const now = Math.floor(Date.now() / 1000)
  const diffHours = Math.floor((now - timestamp) / 3600)
  if (diffHours <= 0) return '刚刚'
  if (diffHours < 24) return `${diffHours} 小时前`
  const days = Math.floor(diffHours / 24)
  return `${days} 天前`
}

onMounted(() => {
  if (!newsList.value.length) {
    fetchNews()
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="ui-card p-4 sm:p-6 transition-all shadow-xs">
      <!-- 头部介绍与操作栏 -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <div class="flex items-center space-x-2">
            <h2 class="text-base sm:text-lg font-semibold text-slate-900 tracking-tight flex items-center space-x-1.5">
              <Flame class="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Hacker News 硅谷前沿榜</span>
            </h2>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
              实时热度 · 支持免翻阅读
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            并发抓取硅谷当前最受关注的开源项目与前沿科技趋势，内嵌 Jina Reader 免除海外网络阻碍。
          </p>
        </div>

        <!-- 数量选择与刷新按钮 -->
        <div class="flex items-center space-x-2 self-start sm:self-center">
          <div class="flex items-center space-x-1 bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 text-xs text-slate-600">
            <SlidersHorizontal class="w-3.5 h-3.5 text-slate-400" />
            <select
              v-model="selectedLimit"
              @change="fetchNews"
              class="bg-transparent text-xs text-slate-700 font-medium focus:outline-none cursor-pointer"
            >
              <option :value="8">精选 8 条</option>
              <option :value="12">热门 12 条</option>
              <option :value="20">深度 20 条</option>
            </select>
          </div>

          <button
            @click="fetchNews"
            :disabled="newsLoading"
            class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium shadow-2xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RefreshCw :class="{ 'animate-spin': newsLoading }" class="w-3.5 h-3.5" />
            <span>刷新</span>
          </button>
        </div>
      </div>

      <!-- 错误信息提示 -->
      <div v-if="errorMessage" class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between mb-4">
        <span>{{ errorMessage }}</span>
        <button
          @click="fetchNews"
          class="px-2.5 py-1 rounded bg-white text-rose-700 border border-rose-300 font-medium hover:bg-rose-100/50 cursor-pointer text-[11px]"
        >
          重试
        </button>
      </div>

      <!-- 加载中骨架屏 -->
      <div v-if="newsLoading" class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          v-for="i in selectedLimit"
          :key="i"
          class="p-4 rounded-xl bg-slate-50/70 border border-slate-200/60 animate-pulse space-y-2.5"
        >
          <div class="flex justify-between items-center">
            <div class="h-3.5 bg-slate-200 rounded w-16"></div>
            <div class="h-4 bg-slate-200 rounded w-10"></div>
          </div>
          <div class="h-4 bg-slate-200 rounded w-4/5"></div>
          <div class="h-3 bg-slate-100 rounded w-2/5"></div>
        </div>
      </div>

      <!-- 新闻热帖列表 -->
      <div v-else-if="newsList.length" class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          v-for="(post, idx) in newsList"
          :key="post.url || idx"
          class="p-4 rounded-xl bg-slate-50/60 border border-slate-200/80 hover:border-slate-300 hover:bg-white transition-all shadow-2xs flex flex-col justify-between group"
        >
          <!-- 卡片顶栏：序号、来源域名、得分 -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <div class="inline-flex items-center space-x-1.5 min-w-0">
                <span class="w-5 h-5 rounded-full bg-slate-200/70 text-slate-600 flex items-center justify-center text-[10px] font-mono font-semibold shrink-0">
                  {{ idx + 1 }}
                </span>
                <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200/70 truncate max-w-[130px]">
                  {{ getHostDomain(post.url) }}
                </span>
              </div>
              <div class="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 text-[11px] font-mono font-semibold shrink-0">
                ▲ {{ post.score }}
              </div>
            </div>

            <!-- 帖子标题 -->
            <a
              :href="post.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug inline-flex items-baseline space-x-1"
            >
              <span>{{ post.title }}</span>
              <ExternalLink class="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0 inline ml-0.5" />
            </a>
          </div>

          <!-- 卡片底栏：作者、评论数与核心操作工具 -->
          <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-[11px]">
            <div class="flex items-center space-x-2 text-slate-400">
              <span class="truncate max-w-[80px]">@{{ post.author }}</span>
              <span v-if="post.time" class="text-slate-300">·</span>
              <span v-if="post.time">{{ formatTimeAgo(post.time) }}</span>
              <span v-if="post.comments_count !== undefined" class="flex items-center space-x-0.5 text-slate-400">
                <MessageSquare class="w-2.5 h-2.5" />
                <span>{{ post.comments_count }}</span>
              </span>
            </div>

            <!-- 操作按钮组 -->
            <div class="flex items-center space-x-1 shrink-0">
              <!-- 免翻阅读正文 -->
              <button
                @click="openReader(post)"
                class="inline-flex items-center space-x-1 px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-medium border border-emerald-200/60 transition-colors cursor-pointer"
                title="免翻提取纯净正文 Markdown"
              >
                <FileText class="w-3 h-3 text-emerald-600" />
                <span>免翻阅读</span>
              </button>

              <!-- 复制链接 -->
              <button
                @click="copyLink(post.url, idx)"
                class="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title="复制原帖网址"
              >
                <Check v-if="copiedIndex === idx" class="w-3.5 h-3.5 text-emerald-600" />
                <Copy v-else class="w-3.5 h-3.5" />
              </button>

              <!-- 原生外链跳转 -->
              <a
                :href="post.url"
                target="_blank"
                rel="noopener noreferrer"
                class="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"
                title="在新窗口打开外网原文"
              >
                <ArrowRight class="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
        <Flame class="w-8 h-8 mb-2 text-slate-300" />
        <span>暂无热榜数据，请点击刷新重试</span>
      </div>
    </div>

    <!-- Jina Reader 网页正文阅读模态弹窗 (免翻直接看海外博客) -->
    <div
      v-if="isReaderOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-6"
    >
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <!-- 弹窗顶栏 -->
        <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div class="min-w-0 pr-4">
            <div class="flex items-center space-x-2">
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                Jina Reader 免翻阅读
              </span>
              <span class="text-xs text-slate-400 truncate font-mono">{{ readerUrl }}</span>
            </div>
            <h3 class="text-sm font-semibold text-slate-900 truncate mt-1">{{ readerTitle }}</h3>
          </div>
          <div class="flex items-center space-x-1.5 shrink-0">
            <button
              v-if="readerContent"
              @click="copyReaderContent"
              class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium transition-colors cursor-pointer"
            >
              <Check v-if="readerCopied" class="w-3.5 h-3.5 text-emerald-600" />
              <Copy v-else class="w-3.5 h-3.5 text-slate-500" />
              <span>{{ readerCopied ? '已复制 Markdown' : '复制正文' }}</span>
            </button>
            <button
              @click="isReaderOpen = false"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- 弹窗正文区 -->
        <div class="p-5 overflow-y-auto flex-1 font-sans text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50/30">
          <div v-if="readerLoading" class="h-60 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <RefreshCw class="w-7 h-7 animate-spin text-emerald-600" />
            <span class="text-xs">正在通过后端 Jina Reader 穿透并清洗海外网页正文...</span>
          </div>
          <div v-else class="whitespace-pre-wrap font-mono text-xs sm:text-sm bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs overflow-x-auto selection:bg-emerald-100">
            {{ readerContent }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

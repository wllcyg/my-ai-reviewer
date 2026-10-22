<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  Search,
  RefreshCw,
  ExternalLink,
  Globe,
  Clock,
  SlidersHorizontal,
  Copy,
  Check,
  FileText,
  Volume2,
  VolumeX,
  X,
  Trash2,
  Sparkles,
  ArrowRight
} from 'lucide-vue-next'

interface SearchItem {
  title: string
  href: string
  body: string
}

// 搜索基础状态
const searchQuery = ref('Vue 3.5 新特性')
const searchResults = ref<SearchItem[]>([])
const searchLoading = ref(false)
const searchEngine = ref('')
const errorMessage = ref('')
const copiedIndex = ref<number | null>(null)

// 过滤参数
const selectedRegion = ref<'cn-zh' | 'us-en' | 'wt-wt'>('cn-zh')
const selectedTimelimit = ref<'' | 'd' | 'w' | 'm' | 'y'>('')
const selectedMaxResults = ref<number>(6)

// 热门搜索词
const trendingTags = [
  'Vue 3.5 新特性',
  'DeepSeek R1',
  'FastMCP 教程',
  'React 19 Server Components',
  'Tailwind CSS v4',
  'Edge-TTS 高音质流式'
]

// 搜索历史
const HISTORY_KEY = 'ai_reviewer_ddg_history'
const searchHistory = ref<string[]>([])

const loadHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) {
      searchHistory.value = JSON.parse(raw)
    }
  } catch {
    searchHistory.value = []
  }
}

const saveHistory = (query: string) => {
  const clean = query.trim()
  if (!clean) return
  const filtered = searchHistory.value.filter(item => item !== clean)
  searchHistory.value = [clean, ...filtered].slice(0, 8)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value))
  } catch {}
}

const removeHistoryItem = (idx: number, e: Event) => {
  e.stopPropagation()
  searchHistory.value.splice(idx, 1)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(searchHistory.value))
  } catch {}
}

const clearAllHistory = () => {
  searchHistory.value = []
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {}
}

// 触发搜索
const triggerSearch = async (overrideQuery?: string) => {
  if (overrideQuery) {
    searchQuery.value = overrideQuery
  }
  const clean = searchQuery.value.trim()
  if (!clean) return

  // 停止当前正在播放的语音
  stopAudio()

  searchLoading.value = true
  errorMessage.value = ''
  saveHistory(clean)

  try {
    const res = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'web_search',
        args: {
          query: clean,
          max_results: selectedMaxResults.value,
          region: selectedRegion.value,
          timelimit: selectedTimelimit.value || null
        }
      })
    })

    const data = await res.json()
    if (data.status === 'error') {
      errorMessage.value = data.error || '检索失败，请稍后重试'
      searchResults.value = []
    } else {
      searchResults.value = data.results || (Array.isArray(data) ? data : [])
      searchEngine.value = data.engine || 'duckduckgo'
    }
  } catch (e: any) {
    errorMessage.value = `请求异常: ${e.message || '网络连接超时'}`
    searchResults.value = []
  } finally {
    searchLoading.value = false
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
    // 降级使用 input copy
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

// Jina Reader 正文提取弹窗
const isReaderOpen = ref(false)
const readerLoading = ref(false)
const readerTitle = ref('')
const readerUrl = ref('')
const readerContent = ref('')
const readerCopied = ref(false)

const openWebpageReader = async (item: SearchItem) => {
  readerTitle.value = item.title
  readerUrl.value = item.href
  readerContent.value = ''
  isReaderOpen.value = true
  readerLoading.value = true

  try {
    const res = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'fetch_webpage',
        args: { url: item.href }
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

// 语音播报联动 (微软晓晓流式)
const currentPlayingUrl = ref<string | null>(null)
let audioPlayer: HTMLAudioElement | null = null

const toggleVoiceRead = (item: SearchItem) => {
  if (currentPlayingUrl.value === item.href) {
    stopAudio()
    return
  }

  stopAudio()
  currentPlayingUrl.value = item.href

  // 拼接清晰的朗读文本
  const textToRead = `标题：${item.title}。摘要内容：${item.body}`
  const streamUrl = `/api/tts/stream?text=${encodeURIComponent(textToRead)}&voice=zh-CN-XiaoxiaoNeural`

  audioPlayer = new Audio(streamUrl)
  audioPlayer.onended = () => {
    currentPlayingUrl.value = null
  }
  audioPlayer.onerror = () => {
    currentPlayingUrl.value = null
  }
  audioPlayer.play().catch(() => {
    currentPlayingUrl.value = null
  })
}

const stopAudio = () => {
  if (audioPlayer) {
    audioPlayer.pause()
    audioPlayer = null
  }
  currentPlayingUrl.value = null
}

// 格式化提取网址域名
const getDomainName = (urlStr: string) => {
  try {
    const parsed = new URL(urlStr)
    return parsed.hostname.replace('www.', '')
  } catch {
    return 'web'
  }
}

onMounted(() => {
  loadHistory()
  // 首次自动检索一次
  triggerSearch()
})

onUnmounted(() => {
  stopAudio()
})
</script>

<template>
  <div class="space-y-6">
    <!-- 主搜索卡片 -->
    <div class="ui-card p-4 sm:p-6 transition-all shadow-xs">
      <!-- 头部介绍与能力标签 -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <div class="flex items-center space-x-2">
            <h2 class="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">DuckDuckGo 智能检索</h2>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              原生双通道 · 免翻直连
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            支持全球中立与中文深度技术过滤，与 Jina 网页阅读器、晓晓流式语音无缝协同。
          </p>
        </div>

        <!-- 引擎标识 -->
        <div v-if="searchEngine" class="self-start sm:self-center">
          <span class="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-[11px] font-mono border border-slate-200">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>引擎: {{ searchEngine }}</span>
          </span>
        </div>
      </div>

      <!-- 检索控制栏 (区域偏好、时间跨度、结果数) -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200/70 mb-4 text-xs">
        <!-- 区域过滤 -->
        <div class="flex items-center space-x-2">
          <Globe class="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span class="text-slate-500 shrink-0">区域偏好:</span>
          <select
            v-model="selectedRegion"
            @change="triggerSearch()"
            class="flex-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="cn-zh">中文精选 (cn-zh)</option>
            <option value="us-en">欧美前沿 (us-en)</option>
            <option value="wt-wt">全球中立 (wt-wt)</option>
          </select>
        </div>

        <!-- 时效限制 -->
        <div class="flex items-center space-x-2">
          <Clock class="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span class="text-slate-500 shrink-0">时效限制:</span>
          <select
            v-model="selectedTimelimit"
            @change="triggerSearch()"
            class="flex-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="">全部时间</option>
            <option value="d">24小时内最新</option>
            <option value="w">过去一周内</option>
            <option value="m">过去一个月内</option>
            <option value="y">一年内前沿</option>
          </select>
        </div>

        <!-- 条数 -->
        <div class="flex items-center space-x-2">
          <SlidersHorizontal class="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span class="text-slate-500 shrink-0">返回条数:</span>
          <select
            v-model="selectedMaxResults"
            @change="triggerSearch()"
            class="flex-1 bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option :value="6">精选 6 条</option>
            <option :value="10">扩展 10 条</option>
            <option :value="15">深度 15 条</option>
          </select>
        </div>
      </div>

      <!-- 搜索主输入行 -->
      <div class="flex space-x-2 mb-3">
        <div class="relative flex-1 min-w-0">
          <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            v-model="searchQuery"
            @keyup.enter="triggerSearch()"
            type="text"
            class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-9 py-2.5 text-slate-900 text-xs sm:text-sm focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-2xs"
            placeholder="输入技术关键词、库名称或前沿动态..."
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
            title="清空输入"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
        <button
          @click="triggerSearch()"
          :disabled="searchLoading"
          class="inline-flex items-center justify-center space-x-1.5 px-5 py-2.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs sm:text-sm font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shrink-0"
        >
          <RefreshCw v-if="searchLoading" class="w-4 h-4 animate-spin" />
          <span v-else>检索</span>
        </button>
      </div>

      <!-- 热门科技热搜词 -->
      <div class="flex items-center space-x-2 py-1 mb-2 overflow-x-auto no-scrollbar">
        <span class="text-[11px] text-slate-400 font-medium shrink-0 flex items-center space-x-1">
          <Sparkles class="w-3 h-3 text-amber-500" />
          <span>推荐词:</span>
        </span>
        <div class="flex items-center space-x-1.5 shrink-0">
          <button
            v-for="tag in trendingTags"
            :key="tag"
            @click="triggerSearch(tag)"
            class="px-2.5 py-1 rounded-full bg-slate-100/80 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[11px] font-normal border border-slate-200/60 transition-all cursor-pointer"
          >
            {{ tag }}
          </button>
        </div>
      </div>

      <!-- 搜索历史 -->
      <div v-if="searchHistory.length" class="flex items-center justify-between pt-2 border-t border-slate-100 mt-2 text-[11px]">
        <div class="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span class="text-slate-400 shrink-0">历史:</span>
          <div
            v-for="(hist, idx) in searchHistory"
            :key="idx"
            @click="triggerSearch(hist)"
            class="group inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/50 cursor-pointer transition-colors shrink-0"
          >
            <span>{{ hist }}</span>
            <button
              @click="(e) => removeHistoryItem(idx, e)"
              class="opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-opacity ml-0.5"
            >
              <X class="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
        <button
          @click="clearAllHistory"
          class="text-slate-400 hover:text-rose-500 transition-colors ml-2 shrink-0 flex items-center space-x-0.5"
          title="清空全部历史"
        >
          <Trash2 class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- 错误异常提示 -->
    <div v-if="errorMessage" class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
      <span>{{ errorMessage }}</span>
      <button
        @click="triggerSearch()"
        class="px-2.5 py-1 rounded bg-white text-rose-700 border border-rose-300 font-medium hover:bg-rose-100/50 cursor-pointer text-[11px]"
      >
        重试
      </button>
    </div>

    <!-- 检索结果列表展示 -->
    <div v-if="searchLoading" class="space-y-3">
      <!-- 骨架屏加载动效 -->
      <div
        v-for="i in 3"
        :key="i"
        class="ui-card p-4 sm:p-5 animate-pulse space-y-3"
      >
        <div class="h-4 bg-slate-200 rounded w-2/5"></div>
        <div class="h-3 bg-slate-100 rounded w-4/5"></div>
        <div class="h-3 bg-slate-100 rounded w-3/5"></div>
      </div>
    </div>

    <div v-else-if="searchResults.length" class="space-y-3">
      <div class="flex items-center justify-between px-1 text-xs text-slate-500">
        <span>共获取到 <strong class="text-slate-800 font-semibold">{{ searchResults.length }}</strong> 条关联内容</span>
        <span class="text-[11px] text-slate-400 font-mono">Clean Results</span>
      </div>

      <div
        v-for="(item, idx) in searchResults"
        :key="idx"
        class="ui-card p-4 sm:p-5 hover:border-slate-300 transition-all shadow-2xs group"
      >
        <!-- 顶部信息栏：域名与序号 -->
        <div class="flex items-center justify-between mb-1.5">
          <div class="inline-flex items-center space-x-1.5">
            <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-mono font-medium">
              {{ idx + 1 }}
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100/80">
              {{ getDomainName(item.href) }}
            </span>
          </div>

          <!-- 工具按钮组 -->
          <div class="flex items-center space-x-1">
            <!-- 晓晓人声流式播报 -->
            <button
              @click="toggleVoiceRead(item)"
              class="inline-flex items-center space-x-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
              :class="currentPlayingUrl === item.href ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'"
              :title="currentPlayingUrl === item.href ? '停止播报' : '使用晓晓人声朗读摘要'"
            >
              <VolumeX v-if="currentPlayingUrl === item.href" class="w-3 h-3 animate-pulse" />
              <Volume2 v-else class="w-3 h-3 text-indigo-500" />
              <span>{{ currentPlayingUrl === item.href ? '正在播报' : '听摘要' }}</span>
            </button>

            <!-- 提取正文 (Jina Reader) -->
            <button
              @click="openWebpageReader(item)"
              class="inline-flex items-center space-x-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200/80 text-slate-600 text-[11px] font-medium transition-colors cursor-pointer"
              title="免翻提取纯净正文 Markdown"
            >
              <FileText class="w-3 h-3 text-emerald-600" />
              <span>提取正文</span>
            </button>

            <!-- 复制链接 -->
            <button
              @click="copyLink(item.href, idx)"
              class="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              title="复制原链接"
            >
              <Check v-if="copiedIndex === idx" class="w-3.5 h-3.5 text-emerald-600" />
              <Copy v-else class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- 标题 -->
        <a
          :href="item.href"
          target="_blank"
          rel="noopener noreferrer"
          class="font-semibold text-slate-900 group-hover:text-indigo-600 text-sm sm:text-base inline-flex items-center space-x-1 leading-snug transition-colors"
        >
          <span>{{ item.title }}</span>
          <ExternalLink class="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity shrink-0 ml-0.5" />
        </a>

        <!-- 摘要正文 -->
        <p class="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
          {{ item.body || '暂无详细摘要，请点击标题直接访问或使用正文提取工具查看。' }}
        </p>

        <!-- 底部原链接 -->
        <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span class="text-slate-400 font-mono truncate max-w-md">
            {{ item.href }}
          </span>
          <a
            :href="item.href"
            target="_blank"
            rel="noopener noreferrer"
            class="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center space-x-0.5 shrink-0 ml-2"
          >
            <span>访问原文</span>
            <ArrowRight class="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>

    <!-- 无搜索结果的空状态 -->
    <div
      v-else-if="!searchLoading"
      class="ui-card p-12 flex flex-col items-center justify-center text-center"
    >
      <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <Search class="w-6 h-6" />
      </div>
      <h3 class="text-sm font-semibold text-slate-800">未检索到关联内容</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-sm">
        可尝试简化搜索关键词，或在上方筛选栏将区域偏好调整为「全球中立 (wt-wt)」以获取更多源。
      </p>
      <div class="mt-4 flex space-x-2">
        <button
          @click="triggerSearch('Vue 3.5')"
          class="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition-colors cursor-pointer"
        >
          搜索 Vue 3.5
        </button>
        <button
          @click="triggerSearch('DeepSeek R1')"
          class="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors cursor-pointer"
        >
          搜索 DeepSeek R1
        </button>
      </div>
    </div>

    <!-- Jina Reader 网页正文阅读模态弹窗 -->
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
                Jina Reader Markdown
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

        <!-- 弹窗内容区 -->
        <div class="p-5 overflow-y-auto flex-1 font-sans text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50/30">
          <div v-if="readerLoading" class="h-60 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <RefreshCw class="w-7 h-7 animate-spin text-indigo-500" />
            <span class="text-xs">正在通过 Jina Reader 清洗并解析纯净 Markdown...</span>
          </div>
          <div v-else class="whitespace-pre-wrap font-mono text-xs sm:text-sm bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs overflow-x-auto selection:bg-indigo-100">
            {{ readerContent }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

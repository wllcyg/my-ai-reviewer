<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RefreshCw, ExternalLink } from 'lucide-vue-next'


const newsList = ref<any[]>([])
const newsLoading = ref(false)

const fetchNews = async () => {
  newsLoading.value = true
  try {
    const res = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'get_tech_news', args: { limit: 8 } })
    })
    const data = await res.json()
    newsList.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error(e)
  } finally {
    newsLoading.value = false
  }
}

onMounted(() => {
  if (!newsList.value.length) {
    fetchNews()
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="ui-card p-6">
      <div class="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <div class="flex items-center space-x-2">
            <h2 class="text-lg font-semibold text-slate-900 tracking-tight">Hacker News 硅谷前沿榜</h2>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              实时热榜 · 开源资讯
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            并发抓取硅谷当前最受关注的开源项目与前沿科技趋势。
          </p>
        </div>
        <button
          @click="fetchNews"
          :disabled="newsLoading"
          class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium shadow-2xs transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw :class="{ 'animate-spin': newsLoading }" class="w-3.5 h-3.5" />
          <span>刷新榜单</span>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          v-for="post in newsList"
          :key="post.title"
          class="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 hover:bg-white transition-all shadow-2xs flex items-center justify-between"
        >
          <div class="flex-1 pr-3">
            <a
              :href="post.url"
              target="_blank"
              class="text-xs font-semibold text-slate-800 hover:text-indigo-600 transition-colors line-clamp-1 inline-flex items-center space-x-1"
            >
              <span>{{ post.title }}</span>
              <ExternalLink class="w-3 h-3 text-slate-400 shrink-0" />
            </a>
            <div class="text-[11px] text-slate-400 mt-1">作者: {{ post.author }}</div>
          </div>
          <div class="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 text-xs font-mono font-semibold shrink-0">
            ▲ {{ post.score }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

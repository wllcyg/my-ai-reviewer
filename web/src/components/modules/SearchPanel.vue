<script setup lang="ts">
import { ref } from 'vue'
import { Search, RefreshCw, ExternalLink } from 'lucide-vue-next'

const searchQuery = ref('Vue 3.5 新特性')
const searchResults = ref<any[]>([])
const searchLoading = ref(false)

const triggerSearch = async () => {
  if (!searchQuery.value.trim()) return
  searchLoading.value = true
  try {
    const res = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'web_search',
        args: { query: searchQuery.value, max_results: 6 }
      })
    })
    const data = await res.json()
    searchResults.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error(e)
  } finally {
    searchLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="ui-card p-6">
      <div class="mb-4">
        <div class="flex items-center space-x-2">
          <h2 class="text-lg font-semibold text-slate-900 tracking-tight">DuckDuckGo 智能检索</h2>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            全球免翻 · 零广告拦截
          </span>
        </div>
        <p class="text-xs text-slate-500 mt-1">
          支持技术文档、最新开源生态与全球中文资讯检索。
        </p>
      </div>

      <div class="flex space-x-2 mb-6">
        <div class="relative flex-1">
          <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            v-model="searchQuery"
            @keyup.enter="triggerSearch"
            type="text"
            class="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3.5 py-2 text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-2xs"
            placeholder="输入搜索关键词..."
          />
        </div>
        <button
          @click="triggerSearch"
          :disabled="searchLoading"
          class="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw v-if="searchLoading" class="w-3.5 h-3.5 animate-spin" />
          <span v-else>搜索</span>
        </button>
      </div>

      <!-- 搜索结果列表 -->
      <div v-if="searchResults.length" class="space-y-2.5">
        <div
          v-for="(item, idx) in searchResults"
          :key="idx"
          class="p-4 rounded-xl bg-slate-50/60 border border-slate-200/80 hover:border-slate-300 hover:bg-white transition-all shadow-2xs"
        >
          <a :href="item.href" target="_blank" class="font-semibold text-indigo-600 hover:text-indigo-800 text-sm inline-flex items-center space-x-1">
            <span>{{ item.title }}</span>
            <ExternalLink class="w-3 h-3 text-slate-400" />
          </a>
          <p class="text-xs text-slate-600 mt-1.5 leading-relaxed">{{ item.body }}</p>
          <span class="text-[11px] text-slate-400 font-mono mt-2 block truncate">{{ item.href }}</span>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
        <Search class="w-8 h-8 mb-2 text-slate-300" />
        <span>输入关键词点击搜索，查看结果列表</span>
      </div>
    </div>
  </div>
</template>

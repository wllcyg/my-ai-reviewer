<script setup lang="ts">
import { ref } from 'vue'
import { Globe, RefreshCw } from 'lucide-vue-next'

const webpageUrl = ref('https://news.ycombinator.com')
const webpageContent = ref('')
const webpageLoading = ref(false)

const triggerFetchWebpage = async () => {
  if (!webpageUrl.value.trim()) return
  webpageLoading.value = true
  webpageContent.value = ''
  try {
    const res = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'fetch_webpage',
        args: { url: webpageUrl.value }
      })
    })
    const data = await res.json()
    webpageContent.value = typeof data === 'string' ? data : (data.result || JSON.stringify(data, null, 2))
  } catch (e: any) {
    webpageContent.value = `抓取失败: ${e.message}`
  } finally {
    webpageLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="ui-card p-6">
      <div class="mb-4">
        <div class="flex items-center space-x-2">
          <h2 class="text-lg font-semibold text-slate-900 tracking-tight">Jina Reader 极净提取</h2>
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
            免Key · 专为 LLM 优化
          </span>
        </div>
        <p class="text-xs text-slate-500 mt-1">
          抓取目标网页，智能过滤冗余噪音与广告，输出干净纯文本 Markdown。
        </p>
      </div>

      <div class="flex space-x-2 mb-4">
        <input
          v-model="webpageUrl"
          type="text"
          class="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-2xs font-mono"
          placeholder="输入目标 URL (如 https://...)"
        />
        <button
          @click="triggerFetchWebpage"
          :disabled="webpageLoading"
          class="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw v-if="webpageLoading" class="w-3.5 h-3.5 animate-spin" />
          <Globe v-else class="w-3.5 h-3.5" />
          <span>解析内容</span>
        </button>
      </div>

      <div
        v-if="webpageContent"
        class="p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-700 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-2xs"
      >
        {{ webpageContent }}
      </div>

      <div v-else class="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
        <Globe class="w-8 h-8 mb-2 text-slate-300" />
        <span>输入任意公开网页 URL，提取清洗后的纯净 Markdown 文本</span>
      </div>
    </div>
  </div>
</template>

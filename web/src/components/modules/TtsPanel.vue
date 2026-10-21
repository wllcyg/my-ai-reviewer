<script setup lang="ts">
import { ref } from 'vue'
import { Play, Square, RefreshCw } from 'lucide-vue-next'


const ttsText = ref('你好！我是微软晓晓，当前语音合成已升级为纯内存流式直推，零磁盘占用且首字秒级播放。')
const ttsVoice = ref('zh-CN-XiaoxiaoNeural')
const ttsMode = ref<'stream' | 'mcp'>('stream')
const ttsLoading = ref(false)
const ttsPlaying = ref(false)
const ttsResult = ref<any>(null)
let currentAudio: HTMLAudioElement | null = null

const voices = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓', tag: '温柔女声', desc: '自然清晰、通用助手首选' },
  { id: 'zh-CN-YunxiNeural', name: '云希', tag: '阳光男声', desc: '影视解说、故事旁白' },
  { id: 'zh-CN-YunjianNeural', name: '云健', tag: '沉稳男声', desc: '新闻播音、专业汇报' },
  { id: 'en-US-JennyNeural', name: 'Jenny', tag: '北美英文', desc: '自然标准美语发音' }
]

const playStreamTts = (textToPlay?: string) => {
  const content = textToPlay || ttsText.value
  if (!content.trim()) return

  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }

  const streamUrl = `/api/tts/stream?text=${encodeURIComponent(content)}&voice=${ttsVoice.value}`
  currentAudio = new Audio(streamUrl)
  ttsPlaying.value = true

  currentAudio.play().catch(e => {
    console.error('播放失败:', e)
    ttsPlaying.value = false
  })

  currentAudio.onended = () => {
    ttsPlaying.value = false
  }
}

const callMcpTts = async () => {
  ttsLoading.value = true
  ttsResult.value = null
  try {
    const res = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'tts_synthesize',
        args: { text: ttsText.value, voice: ttsVoice.value }
      })
    })
    const data = await res.json()
    ttsResult.value = data
    if (data.audio_base64) {
      if (currentAudio) currentAudio.pause()
      currentAudio = new Audio(data.audio_base64)
      ttsPlaying.value = true
      currentAudio.play()
      currentAudio.onended = () => { ttsPlaying.value = false }
    }
  } catch (e: any) {
    ttsResult.value = { status: 'error', message: e.message }
  } finally {
    ttsLoading.value = false
  }
}

const stopAudio = () => {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  ttsPlaying.value = false
}

defineExpose({
  playText: playStreamTts
})
</script>

<template>
  <div class="space-y-6">
    <div class="ui-card p-6">
      <!-- 标题栏 -->
      <div class="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <div class="flex items-center space-x-2">
            <h2 class="text-lg font-semibold text-slate-900 tracking-tight">微软高拟真人声语音工作台</h2>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              免Key · 纯内存 0 磁盘
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            基于 Edge 官方协议直连，集成 1000 字安全熔断保护，支持流式直推与 MCP 双模式。
          </p>
        </div>

        <!-- 模式切换器 -->
        <div class="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200/80 text-xs font-medium">
          <button
            @click="ttsMode = 'stream'"
            :class="ttsMode === 'stream' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'"
            class="px-3 py-1 rounded-md transition-all cursor-pointer"
          >
            流式即时播放
          </button>
          <button
            @click="ttsMode = 'mcp'"
            :class="ttsMode === 'mcp' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'"
            class="px-3 py-1 rounded-md transition-all cursor-pointer"
          >
            MCP Base64 模式
          </button>
        </div>
      </div>

      <!-- 音色选择网格 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div
          v-for="v in voices"
          :key="v.id"
          @click="ttsVoice = v.id"
          :class="[
            'p-3.5 rounded-xl border text-left cursor-pointer transition-all duration-150',
            ttsVoice === v.id
              ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600/20'
              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
          ]"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-slate-900">{{ v.name }}</span>
            <span class="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-normal">
              {{ v.tag }}
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1.5">{{ v.desc }}</p>
        </div>
      </div>

      <!-- 文本输入区 -->
      <div class="relative mb-4">
        <textarea
          v-model="ttsText"
          rows="4"
          class="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 transition-all shadow-2xs leading-relaxed"
          placeholder="输入需要朗读的文本..."
        ></textarea>
        <div class="flex items-center justify-between mt-1 px-1 text-xs">
          <div class="flex items-center space-x-2 text-slate-400">
            <span>预设模板:</span>
            <button
              @click="ttsText = '代码审查完毕，发现2处潜在性能开销，建议将同步文件写入重构为异步内存流。'"
              class="text-indigo-600 hover:underline cursor-pointer"
            >
              审查结论
            </button>
            <span>·</span>
            <button
              @click="ttsText = '注意看，当前系统已全面升级为纯内存流转，绝不占用本地磁盘空间。'"
              class="text-indigo-600 hover:underline cursor-pointer"
            >
              解说旁白
            </button>
          </div>
          <span :class="ttsText.length > 1000 ? 'text-rose-600 font-semibold' : 'text-slate-400'" class="font-mono">
            {{ ttsText.length }} / 1000 字
          </span>
        </div>
      </div>

      <!-- 操作按钮栏 -->
      <div class="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
        <button
          v-if="ttsPlaying"
          @click="stopAudio"
          class="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium shadow-2xs transition-all cursor-pointer"
        >
          <Square class="w-3.5 h-3.5 text-rose-500" />
          <span>停止播放</span>
        </button>

        <button
          @click="ttsMode === 'stream' ? playStreamTts() : callMcpTts()"
          :disabled="ttsLoading || !ttsText.trim()"
          class="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw v-if="ttsLoading" class="w-3.5 h-3.5 animate-spin" />
          <Play v-else-if="!ttsPlaying" class="w-3.5 h-3.5" />
          <span v-if="ttsPlaying" class="inline-flex items-center">
            <span class="voice-wave-bar"></span>
            <span class="voice-wave-bar"></span>
            <span class="voice-wave-bar"></span>
            <span class="voice-wave-bar"></span>
            <span class="ml-2">播放中...</span>
          </span>
          <span v-else>{{ ttsMode === 'stream' ? '立即朗读' : '获取 Base64' }}</span>
        </button>
      </div>

      <!-- MCP 原始响应面板 -->
      <div v-if="ttsResult" class="mt-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs">
        <div class="flex items-center justify-between text-slate-700 font-semibold mb-1">
          <span>MCP 返回 Payload:</span>
          <span class="text-slate-500">{{ ttsResult.size_kb || '0 KB' }}</span>
        </div>
        <pre class="overflow-x-auto text-slate-600 text-[11px] leading-relaxed">{{ JSON.stringify(ttsResult, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  Lock,
  FileText
} from 'lucide-vue-next'
import { VOICES, getVoiceMeta } from './constants'
import type { ExportAudioFormat } from './types'
import { useAudioEngine } from './useAudioEngine'
import {
  getAudioContext,
  exportAndDownloadAudio
} from '@/utils/audioMerger'
import { apiUrl } from '@/utils/api'

const props = defineProps<{
  computedRate: string
  computedPitch: string
  exportFormat: ExportAudioFormat
}>()

const { isAudioPlaying, stopAudio, playStream, fetchAudioBuffer } = useAudioEngine()

const ttsText = ref('你好！我是微软晓晓，当前语音合成已升级为纯内存流式直推，零磁盘占用且首字秒级播放。')
const ttsVoice = ref('zh-CN-XiaoxiaoNeural')
const ttsMode = ref<'stream' | 'mcp'>('stream')
const ttsLoading = ref(false)
const hasPlayedFinished = ref(false)
const ttsResult = ref<any>(null)
const isExportingSingleSrt = ref(false)

watch([ttsText, ttsVoice, () => props.computedRate, () => props.computedPitch], () => {
  hasPlayedFinished.value = false
})

const selectVoice = (voiceId: string) => {
  ttsVoice.value = voiceId
  if (voiceId.startsWith('en-') && ttsText.value.includes('晓晓')) {
    ttsText.value = 'Hello there! I am Jenny, ready to bring your overseas apps to life with crystal-clear voice synthesis.'
  } else if (!voiceId.startsWith('en-') && ttsText.value.includes('Hello there!')) {
    ttsText.value = '你好！我是微软晓晓，当前语音合成已升级为纯内存流式直推，零磁盘占用且首字秒级播放。'
  }
}

const loadSinglePreset = (type: 'dongbei' | 'notice') => {
  if (type === 'dongbei') {
    ttsText.value = '哎妈呀老铁！代码审查已通过，咱们这纯内存流转速度嘎嘎快，磁盘老省心了！'
  } else {
    ttsText.value = '紧急通知：请拨打电话 400-888-9999，您的系统验证码是 89757，请勿将验证码泄露给他人。'
  }
}

// 试听朗读
const playSingle = () => {
  if (!ttsText.value.trim()) return
  hasPlayedFinished.value = false

  playStream(
    ttsText.value,
    ttsVoice.value,
    props.computedRate,
    props.computedPitch,
    () => {
      hasPlayedFinished.value = true
    },
    (err) => {
      console.error('播放失败:', err)
    }
  )
}

// 导出单句音频
const downloadAudio = async () => {
  if (!ttsText.value.trim()) return
  const meta = getVoiceMeta(ttsVoice.value)
  const baseName = `voice_${meta.name}_${Date.now()}`

  try {
    const arrayBuf = await fetchAudioBuffer(ttsText.value, ttsVoice.value, props.computedRate, props.computedPitch)
    const audioCtx = getAudioContext()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuf.slice(0))
    exportAndDownloadAudio(audioBuffer, props.exportFormat, `${baseName}.${props.exportFormat}`)
  } catch (e) {
    console.error('单句导出失败:', e)
    const fallbackUrl = `/api/tts/stream?text=${encodeURIComponent(ttsText.value)}&voice=${ttsVoice.value}&rate=${encodeURIComponent(props.computedRate)}&pitch=${encodeURIComponent(props.computedPitch)}&download=true&filename=${encodeURIComponent(baseName + '.mp3')}`
    window.location.href = fallbackUrl
  }
}

// 杀手锏 1: 单句导出标准 SRT 字幕
const downloadSubtitle = async () => {
  if (!ttsText.value.trim()) return
  isExportingSingleSrt.value = true
  const meta = getVoiceMeta(ttsVoice.value)
  const baseName = `subtitles_${meta.name}_${Date.now()}.srt`

  try {
    const url = apiUrl(`/api/tts/subtitles?text=${encodeURIComponent(ttsText.value)}&voice=${ttsVoice.value}&rate=${encodeURIComponent(props.computedRate)}&pitch=${encodeURIComponent(props.computedPitch)}&download=true`)
    const res = await fetch(url)
    if (!res.ok) throw new Error('字幕生成异常')
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = baseName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch (err: any) {
    alert(`字幕下载失败: ${err.message}`)
  } finally {
    isExportingSingleSrt.value = false
  }
}

// MCP 模式调用
const callMcp = async () => {
  ttsLoading.value = true
  ttsResult.value = null
  hasPlayedFinished.value = false
  try {
    const res = await fetch(apiUrl('/api/mcp/call'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'tts_synthesize',
        args: {
          text: ttsText.value,
          voice: ttsVoice.value,
          rate: props.computedRate,
          pitch: props.computedPitch
        }
      })
    })
    const data = await res.json()
    ttsResult.value = data
    if (data.audio_base64) {
      stopAudio()
      const audio = new Audio(data.audio_base64)
      audio.play()
      audio.onended = () => {
        hasPlayedFinished.value = true
      }
    }
  } catch (e: any) {
    ttsResult.value = { status: 'error', message: e.message }
  } finally {
    ttsLoading.value = false
  }
}

defineExpose({
  playText: (text: string) => {
    ttsText.value = text
    playSingle()
  }
})
</script>

<template>
  <div>
    <!-- 音色选择网格 (8 款特色音色) -->
    <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2.5 mb-5">
      <div
        v-for="v in VOICES"
        :key="v.id"
        @click="selectVoice(v.id)"
        :class="[
          'p-3 rounded-xl border text-left cursor-pointer transition-all duration-150',
          ttsVoice === v.id
            ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600/20'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
        ]"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-slate-900 truncate">{{ v.name }}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-normal truncate">
            {{ v.tag }}
          </span>
        </div>
        <p class="text-[11px] text-slate-500 mt-1 line-clamp-1">{{ v.desc }}</p>
      </div>
    </div>

    <!-- 文本输入区 -->
    <div class="relative mb-4">
      <textarea
        v-model="ttsText"
        rows="4"
        class="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 transition-all shadow-2xs leading-relaxed font-mono"
        placeholder="输入需要朗读的文本内容..."
      ></textarea>
      <div class="flex items-center justify-between mt-1 px-1 text-xs">
        <div class="flex items-center space-x-2 text-slate-400">
          <span>快捷示例:</span>
          <button
            type="button"
            @click="loadSinglePreset('dongbei')"
            class="text-indigo-600 hover:underline cursor-pointer"
          >
            东北特色口音
          </button>
          <span>·</span>
          <button
            type="button"
            @click="loadSinglePreset('notice')"
            class="text-indigo-600 hover:underline cursor-pointer"
          >
            标准客服通知
          </button>
        </div>
        <span :class="ttsText.length > 1000 ? 'text-rose-600 font-semibold' : 'text-slate-400'" class="font-mono">
          {{ ttsText.length }} / 1000 字
        </span>
      </div>
    </div>

    <!-- 操作按钮栏 -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-3 border-t border-slate-100 gap-2.5 sm:gap-3">
      <div class="flex items-center">
        <button
          type="button"
          @click="ttsMode = ttsMode === 'stream' ? 'mcp' : 'stream'"
          class="w-full sm:w-auto px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium cursor-pointer transition-colors text-center"
        >
          当前模式: <span class="text-indigo-600 font-semibold">{{ ttsMode === 'stream' ? '流式直推' : 'MCP Base64' }}</span>
        </button>
      </div>

      <div class="grid grid-cols-2 sm:flex sm:items-center gap-2">
        <!-- 杀手锏 1: 单句导出标准 SRT 字幕 -->
        <button
          type="button"
          @click="downloadSubtitle()"
          :disabled="isExportingSingleSrt || !ttsText.trim()"
          class="inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 text-xs font-medium transition-all shadow-2xs cursor-pointer disabled:opacity-50"
          title="毫秒级时间戳，可直接导入剪映/PR等视频剪辑软件"
        >
          <RefreshCw v-if="isExportingSingleSrt" class="w-3.5 h-3.5 animate-spin" />
          <FileText v-else class="w-3.5 h-3.5 text-indigo-600" />
          <span>{{ isExportingSingleSrt ? '提取中...' : '下载字幕' }}</span>
        </button>

        <!-- 下载音频按钮 (完整播放后解锁) -->
        <button
          type="button"
          @click="downloadAudio()"
          :disabled="!hasPlayedFinished || isAudioPlaying"
          :class="[
            hasPlayedFinished && !isAudioPlaying
              ? 'bg-emerald-50 border-emerald-200/90 text-emerald-700 hover:bg-emerald-100/80 shadow-2xs cursor-pointer'
              : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60'
          ]"
          class="inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all"
          :title="!hasPlayedFinished ? '提示：请在试听播放完成后方可下载音频' : '一键直接导出音频到本地电脑'"
        >
          <CheckCircle2 v-if="hasPlayedFinished && !isAudioPlaying" class="w-3.5 h-3.5 text-emerald-600" />
          <Lock v-else class="w-3.5 h-3.5 text-slate-400" />
          <span>{{ isAudioPlaying ? '播放中...' : (hasPlayedFinished ? `下载 (${exportFormat.toUpperCase()})` : '试听后下载') }}</span>
        </button>

        <!-- 停止按钮 -->
        <button
          type="button"
          v-if="isAudioPlaying"
          @click="stopAudio"
          class="col-span-2 sm:col-span-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium shadow-2xs transition-all cursor-pointer"
        >
          <Square class="w-3.5 h-3.5 text-rose-500" />
          <span>停止播放</span>
        </button>

        <!-- 立即朗读 / 获取 Base64 (小屏跨两列通栏展示) -->
        <button
          type="button"
          v-else
          @click="ttsMode === 'stream' ? playSingle() : callMcp()"
          :disabled="ttsLoading || !ttsText.trim()"
          class="col-span-2 sm:col-span-1 inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw v-if="ttsLoading" class="w-3.5 h-3.5 animate-spin" />
          <Play v-else class="w-3.5 h-3.5" />
          <span>{{ ttsMode === 'stream' ? '立即朗读试听' : '获取 Base64' }}</span>
        </button>
      </div>
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
</template>

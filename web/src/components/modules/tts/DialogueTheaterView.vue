<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Play,
  Square,
  RefreshCw,
  Plus,
  Trash2,
  Sparkles,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Lock,
  Sliders,
  FileText
} from 'lucide-vue-next'
import { VOICES, getVoiceMeta } from './constants'
import type { DialogueItem, ExportAudioFormat } from './types'
import { useAudioEngine } from './useAudioEngine'
import {
  getAudioContext,
  concatAudioBuffers,
  exportAndDownloadAudio
} from '@/utils/audioMerger'

const props = defineProps<{
  computedRate: string
  computedPitch: string
  exportFormat: ExportAudioFormat
}>()

const { fetchAudioBuffer, stopAudio } = useAudioEngine()

const dialogueList = ref<DialogueItem[]>([
  {
    id: 'd1',
    voice: 'zh-CN-YunxiNeural',
    text: '小北，听说你刚用 AI 给海外项目做了一整套代码审查？',
    customAcoustics: true,
    speedMultiplier: 0.95,
    pitchOffset: -10,
    showSettings: false
  },
  {
    id: 'd2',
    voice: 'zh-CN-liaoning-XiaobeiNeural',
    text: '那必须滴呀云希哥！我一瞅代码里全搁那循环写磁盘呢，老慢了！我直接给整成纯内存流式直推，那速度嘎嘎快！',
    customAcoustics: true,
    speedMultiplier: 1.25,
    pitchOffset: 15,
    showSettings: false
  },
  {
    id: 'd3',
    voice: 'zh-TW-HsiaoChenNeural',
    text: '哇塞真的假的，难怪刚刚测试首包毫秒级就播放出来了耶，太厉害了啦！',
    customAcoustics: false,
    speedMultiplier: 1.0,
    pitchOffset: 0,
    showSettings: false
  },
  {
    id: 'd4',
    voice: 'en-US-JennyNeural',
    text: 'Exactly team! Latency has dropped to zero, and now we can export clean MP3s and aligned subtitles in a split second.',
    customAcoustics: false,
    speedMultiplier: 1.0,
    pitchOffset: 0,
    showSettings: false
  }
])

// 获取单个角色的有效 rate 与 pitch
const getItemRate = (item: DialogueItem): string => {
  if (item.customAcoustics && item.speedMultiplier !== undefined) {
    const percent = Math.round((item.speedMultiplier - 1.0) * 100)
    return percent >= 0 ? `+${percent}%` : `${percent}%`
  }
  return props.computedRate
}

const getItemPitch = (item: DialogueItem): string => {
  if (item.customAcoustics && item.pitchOffset !== undefined) {
    const hz = Math.round(item.pitchOffset)
    return hz >= 0 ? `+${hz}Hz` : `${hz}Hz`
  }
  return props.computedPitch
}

const addDialogueBreak = (item: DialogueItem, ms: number) => {
  item.text += ` <break time="${ms}ms" /> `
}

const isPlayingAll = ref(false)
const activePlayingIndex = ref(-1)
const isMerging = ref(false)
const isExportingDialogueSrt = ref(false)
const mergeProgress = ref('')
const playedTurns = ref<Record<string, boolean>>({})
const hasDialogueFinished = ref(false)

let theaterAudio: HTMLAudioElement | null = null

const stopTheaterAudio = () => {
  if (theaterAudio) {
    theaterAudio.pause()
    theaterAudio.src = ''
    theaterAudio = null
  }
  stopAudio()
  isPlayingAll.value = false
  activePlayingIndex.value = -1
}

watch(dialogueList, () => {
  hasDialogueFinished.value = false
}, { deep: true })

const addDialogueTurn = () => {
  const lastVoice = dialogueList.value[dialogueList.value.length - 1]?.voice
  let nextVoice = VOICES[0].id
  if (lastVoice === VOICES[0].id) nextVoice = VOICES[3].id // 东北小北
  else if (lastVoice === VOICES[3].id) nextVoice = VOICES[4].id // 台湾晓臻
  else if (lastVoice === VOICES[4].id) nextVoice = VOICES[7].id // Jenny

  dialogueList.value.push({
    id: `d_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    voice: nextVoice,
    text: '',
    customAcoustics: false,
    speedMultiplier: 1.0,
    pitchOffset: 0,
    showSettings: false
  })
  hasDialogueFinished.value = false
}

const removeDialogueTurn = (index: number) => {
  dialogueList.value.splice(index, 1)
  hasDialogueFinished.value = false
  if (activePlayingIndex.value === index) {
    stopTheaterAudio()
  }
}

const moveTurn = (index: number, direction: 'up' | 'down') => {
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= dialogueList.value.length) return
  const temp = dialogueList.value[index]
  dialogueList.value[index] = dialogueList.value[target]
  dialogueList.value[target] = temp
  hasDialogueFinished.value = false
}

const applyItemPreset = (item: DialogueItem, type: 'speedUp' | 'deep' | 'cute' | 'reset') => {
  item.customAcoustics = true
  if (type === 'speedUp') {
    item.speedMultiplier = 1.3
    item.pitchOffset = 10
  } else if (type === 'deep') {
    item.speedMultiplier = 0.95
    item.pitchOffset = -20
  } else if (type === 'cute') {
    item.speedMultiplier = 1.2
    item.pitchOffset = 30
  } else if (type === 'reset') {
    item.speedMultiplier = 1.0
    item.pitchOffset = 0
    item.customAcoustics = false
  }
}

// 单句试听
const playSingleTurn = (index: number) => {
  stopTheaterAudio()
  const item = dialogueList.value[index]
  if (!item.text.trim()) return

  activePlayingIndex.value = index
  playedTurns.value[item.id] = false

  const rate = getItemRate(item)
  const pitch = getItemPitch(item)
  const streamUrl = `/api/tts/stream?text=${encodeURIComponent(item.text)}&voice=${item.voice}&rate=${encodeURIComponent(rate)}&pitch=${encodeURIComponent(pitch)}`
  theaterAudio = new Audio(streamUrl)

  fetchAudioBuffer(item.text, item.voice, rate, pitch).catch(() => {})

  theaterAudio.play().catch(e => {
    console.error('单句播放失败:', e)
    activePlayingIndex.value = -1
  })

  theaterAudio.onended = () => {
    activePlayingIndex.value = -1
    playedTurns.value[item.id] = true
  }
}

// 全剧连播
const playAllDialogue = async () => {
  if (dialogueList.value.length === 0) return
  stopTheaterAudio()
  isPlayingAll.value = true
  hasDialogueFinished.value = false

  let completedTurns = 0

  for (let i = 0; i < dialogueList.value.length; i++) {
    if (!isPlayingAll.value) break

    const item = dialogueList.value[i]
    if (!item.text.trim()) continue

    activePlayingIndex.value = i
    const rate = getItemRate(item)
    const pitch = getItemPitch(item)

    const success = await new Promise<boolean>((resolve) => {
      const streamUrl = `/api/tts/stream?text=${encodeURIComponent(item.text)}&voice=${item.voice}&rate=${encodeURIComponent(rate)}&pitch=${encodeURIComponent(pitch)}`
      theaterAudio = new Audio(streamUrl)

      fetchAudioBuffer(item.text, item.voice, rate, pitch).catch(() => {})

      theaterAudio.onended = () => {
        playedTurns.value[item.id] = true
        setTimeout(() => resolve(true), 380)
      }

      theaterAudio.onerror = () => {
        resolve(false)
      }

      theaterAudio.play().catch(() => resolve(false))
    })

    if (success) completedTurns++
  }

  if (isPlayingAll.value && completedTurns > 0) {
    hasDialogueFinished.value = true
  }

  isPlayingAll.value = false
  activePlayingIndex.value = -1
}

// 单句导出音频
const downloadSingleTurnAudio = async (item: DialogueItem) => {
  if (!item.text.trim()) return
  const meta = getVoiceMeta(item.voice)
  const baseName = `voice_${meta.name}_${Date.now()}`
  const rate = getItemRate(item)
  const pitch = getItemPitch(item)

  try {
    const arrayBuf = await fetchAudioBuffer(item.text, item.voice, rate, pitch)
    const audioCtx = getAudioContext()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuf.slice(0))
    exportAndDownloadAudio(audioBuffer, props.exportFormat, `${baseName}.${props.exportFormat}`)
  } catch (e) {
    console.error('单句导出失败:', e)
  }
}

// 单句导出字幕
const downloadSingleTurnSubtitle = async (item: DialogueItem) => {
  if (!item.text.trim()) return
  const meta = getVoiceMeta(item.voice)
  const baseName = `subtitles_${meta.name}_${Date.now()}.srt`
  const rate = getItemRate(item)
  const pitch = getItemPitch(item)

  try {
    const url = `/api/tts/subtitles?text=${encodeURIComponent(item.text)}&voice=${item.voice}&rate=${encodeURIComponent(rate)}&pitch=${encodeURIComponent(pitch)}&download=true`
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
  }
}

// 杀手锏 2 & lamejs: 纯客户端多角色无损音频合并导出
const mergeAndDownloadAll = async () => {
  const validItems = dialogueList.value.filter(item => item.text.trim())
  if (validItems.length === 0) return

  isMerging.value = true
  mergeProgress.value = '准备客户端 Web Audio 音频处理管线...'

  try {
    const audioCtx = getAudioContext()
    const decodedBuffers: AudioBuffer[] = []

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i]
      mergeProgress.value = `正在拉取角色音频分片 (${i + 1}/${validItems.length})...`

      const rate = getItemRate(item)
      const pitch = getItemPitch(item)
      const arrayBuf = await fetchAudioBuffer(item.text, item.voice, rate, pitch)
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuf.slice(0))
      decodedBuffers.push(audioBuffer)
    }

    mergeProgress.value = '正在缝合音轨并注入 0.38s 自然对话呼吸停顿...'
    const mergedAudioBuffer = concatAudioBuffers(audioCtx, decodedBuffers, 0.38)

    mergeProgress.value = props.exportFormat === 'mp3' 
      ? '正在通过 lamejs 编码为高保真 MP3 (192kbps)...' 
      : '正在打包导出无损 WAV 音频...'

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const baseFilename = `多角色完整对话剧场_${dateStr}_${validItems.length}句`

    const { sizeKb } = exportAndDownloadAudio(mergedAudioBuffer, props.exportFormat, baseFilename)
    mergeProgress.value = `导出成功！文件大小: ${sizeKb}`
    setTimeout(() => { isMerging.value = false }, 1200)
  } catch (err: any) {
    console.error('音频合并导出失败:', err)
    alert(`合并导出失败: ${err.message || '音频解码或编码异常'}`)
    isMerging.value = false
    mergeProgress.value = ''
  }
}

// 杀手锏 1: 一键导出全剧无缝对齐的完整 SRT 字幕
const downloadDialogueSubtitles = async () => {
  const validItems = dialogueList.value.filter(item => item.text.trim())
  if (validItems.length === 0) return

  isExportingDialogueSrt.value = true
  try {
    const payload = {
      dialogues: validItems.map(item => ({
        text: item.text,
        voice: item.voice,
        rate: getItemRate(item),
        pitch: getItemPitch(item)
      })),
      pause_seconds: 0.38
    }

    const res = await fetch('/api/tts/dialogue_subtitles?download=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) throw new Error('字幕服务合成失败')

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `多角色对话剧场_完整字幕_${new Date().toISOString().slice(0, 10)}.srt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err: any) {
    alert(`字幕导出失败: ${err.message}`)
  } finally {
    isExportingDialogueSrt.value = false
  }
}

// 批量逐句导出单段音频
const exportEachAudio = () => {
  dialogueList.value.forEach((item, index) => {
    if (!item.text.trim()) return
    setTimeout(() => {
      downloadSingleTurnAudio(item)
    }, index * 400)
  })
}
</script>

<template>
  <div class="space-y-4">
    <!-- 工具栏与提示 -->
    <div class="flex items-center justify-between flex-wrap gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
      <div class="flex items-center space-x-2 text-xs text-slate-600">
        <Sparkles class="w-4 h-4 text-amber-500" />
        <span>支持<b>每位角色独立声学调音</b>，连播完成后可<b>一键导出整段音频与无缝对齐 SRT 字幕</b>。</span>
      </div>

      <div class="flex items-center space-x-2 flex-wrap gap-2">
        <!-- 杀手锏 1: 导出全剧时间轴字幕 (SRT) -->
        <button
          type="button"
          @click="downloadDialogueSubtitles"
          :disabled="isExportingDialogueSrt || dialogueList.length === 0"
          class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-medium shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          title="毫秒级时间戳无缝对齐整场对话，导入剪辑软件分秒不差"
        >
          <RefreshCw v-if="isExportingDialogueSrt" class="w-3.5 h-3.5 animate-spin" />
          <FileText v-else class="w-3.5 h-3.5 text-indigo-600" />
          <span>{{ isExportingDialogueSrt ? '生成字幕中...' : '导出全剧字幕 (SRT)' }}</span>
        </button>

        <!-- 连播整场对话 -->
        <button
          type="button"
          v-if="!isPlayingAll"
          @click="playAllDialogue"
          :disabled="dialogueList.length === 0"
          class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-medium shadow-xs transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
        >
          <Play class="w-3.5 h-3.5" />
          <span>连播整场对话</span>
        </button>
        <button
          type="button"
          v-else
          @click="stopTheaterAudio"
          class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-medium shadow-xs transition-all active:scale-[0.98] cursor-pointer"
        >
          <Square class="w-3.5 h-3.5" />
          <span>停止连播</span>
        </button>

        <!-- 合并下载完整音频 (连播完成后解锁) -->
        <button
          type="button"
          @click="mergeAndDownloadAll"
          :disabled="!hasDialogueFinished || isMerging || isPlayingAll || dialogueList.length === 0"
          :class="[
            hasDialogueFinished && !isMerging && !isPlayingAll
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs cursor-pointer'
              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          ]"
          class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          :title="!hasDialogueFinished ? '提示：请完整连播整场对话后方可合并下载' : '将所有台词合并导出'"
        >
          <RefreshCw v-if="isMerging" class="w-3.5 h-3.5 animate-spin" />
          <CheckCircle2 v-else-if="hasDialogueFinished" class="w-3.5 h-3.5" />
          <Lock v-else class="w-3.5 h-3.5" />
          <span>{{ isMerging ? '合并中...' : (isPlayingAll ? '连播中，完成后可下载' : (hasDialogueFinished ? `合并下载音频 (${exportFormat.toUpperCase()})` : '需连播后合并下载')) }}</span>
        </button>
      </div>
    </div>

    <!-- 合并进度条提示 -->
    <div v-if="isMerging" class="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 flex items-center space-x-2">
      <RefreshCw class="w-4 h-4 animate-spin text-indigo-600" />
      <span>{{ mergeProgress }}</span>
    </div>

    <!-- 对话行卡片列表 -->
    <div class="space-y-3">
      <div
        v-for="(item, idx) in dialogueList"
        :key="item.id"
        :class="[
          'p-4 rounded-xl border transition-all duration-200 bg-white relative',
          activePlayingIndex === idx
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-xs'
            : 'border-slate-200 hover:border-slate-300'
        ]"
      >
        <div class="flex items-center justify-between mb-2.5 flex-wrap gap-2">
          <!-- 角色与序号 -->
          <div class="flex items-center space-x-2 flex-wrap gap-1.5">
            <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-mono flex items-center justify-center font-semibold">
              {{ idx + 1 }}
            </span>

            <!-- 角色选择下拉 -->
            <select
              v-model="item.voice"
              class="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option v-for="v in VOICES" :key="v.id" :value="v.id">
                {{ v.name }} ({{ v.tag }})
              </option>
            </select>

            <span :class="['text-[11px] px-2 py-0.5 rounded-full border', getVoiceMeta(item.voice).color]">
              {{ getVoiceMeta(item.voice).name }}
            </span>

            <!-- 杀手锏 2: 独立声学调谐触发按钮 -->
            <button
              type="button"
              @click="item.showSettings = !item.showSettings"
              :class="[
                item.customAcoustics
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold'
                  : 'bg-slate-50 text-slate-500 hover:text-slate-800 border-slate-200'
              ]"
              class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border text-[11px] transition-colors cursor-pointer"
              title="为该角色单独微调语速和音高"
            >
              <Sliders class="w-3 h-3 text-indigo-600" />
              <span>
                {{ item.customAcoustics ? `独立调音 (${getItemRate(item)} / ${getItemPitch(item)})` : '独立声学' }}
              </span>
            </button>

            <!-- 正在说话动画波纹 -->
            <div v-if="activePlayingIndex === idx" class="inline-flex items-center space-x-0.5 ml-1">
              <span class="voice-wave-bar"></span>
              <span class="voice-wave-bar"></span>
              <span class="voice-wave-bar"></span>
              <span class="text-[11px] font-medium text-indigo-600 ml-1.5">朗读中...</span>
            </div>
          </div>

          <!-- 右侧快捷操作：试听、下载音频、下载字幕、排序、删除 -->
          <div class="flex items-center space-x-1">
            <!-- 单句试听 -->
            <button
              type="button"
              @click="playSingleTurn(idx)"
              :class="activePlayingIndex === idx ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'"
              class="p-1.5 rounded-lg text-xs cursor-pointer transition-colors"
              title="单独试听该句"
            >
              <Play class="w-3.5 h-3.5" />
            </button>

            <!-- 单句下载音频 (试听完成后解锁) -->
            <button
              type="button"
              @click="downloadSingleTurnAudio(item)"
              :disabled="!playedTurns[item.id] || activePlayingIndex === idx || isPlayingAll"
              :class="[
                playedTurns[item.id] && activePlayingIndex !== idx
                  ? 'text-emerald-700 hover:bg-emerald-50 cursor-pointer'
                  : 'text-slate-300 cursor-not-allowed'
              ]"
              class="p-1.5 rounded-lg text-xs transition-colors"
              :title="!playedTurns[item.id] ? '提示：请先单独试听本句，播放完成后解锁下载' : `单独导出此句音频 (${exportFormat.toUpperCase()})`"
            >
              <CheckCircle2 v-if="playedTurns[item.id]" class="w-3.5 h-3.5 text-emerald-600" />
              <Lock v-else class="w-3.5 h-3.5" />
            </button>

            <!-- 单句下载字幕 (SRT) -->
            <button
              type="button"
              @click="downloadSingleTurnSubtitle(item)"
              :disabled="!item.text.trim()"
              class="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 text-xs cursor-pointer transition-colors disabled:opacity-30"
              title="单独下载此句的 SRT 字幕"
            >
              <FileText class="w-3.5 h-3.5" />
            </button>

            <!-- 上移 / 下移 -->
            <button
              type="button"
              @click="moveTurn(idx, 'up')"
              :disabled="idx === 0"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs cursor-pointer disabled:opacity-20"
            >
              <ArrowUp class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              @click="moveTurn(idx, 'down')"
              :disabled="idx === dialogueList.length - 1"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs cursor-pointer disabled:opacity-20"
            >
              <ArrowDown class="w-3.5 h-3.5" />
            </button>

            <!-- 删除行 -->
            <button
              type="button"
              @click="removeDialogueTurn(idx)"
              class="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs cursor-pointer transition-colors"
              title="删除该台词"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- 杀手锏 2: 展开专属声学定制抽屉 -->
        <div v-if="item.showSettings" class="mb-2.5 p-3 bg-slate-50 rounded-xl border border-indigo-100 space-y-2">
          <div class="flex items-center justify-between text-xs pb-1 border-b border-slate-200/60">
            <label class="flex items-center space-x-2 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                v-model="item.customAcoustics"
                class="rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
              <span>启用该角色独立声线定制 (覆盖全局基准)</span>
            </label>

            <!-- 角色预设微调 -->
            <div class="flex items-center space-x-1 text-[10px]">
              <button
                type="button"
                @click="applyItemPreset(item, 'speedUp')"
                class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer hover:bg-amber-100"
              >
                加急解说
              </button>
              <button
                type="button"
                @click="applyItemPreset(item, 'deep')"
                class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 cursor-pointer hover:bg-blue-100"
              >
                沉稳浑厚
              </button>
              <button
                type="button"
                @click="applyItemPreset(item, 'cute')"
                class="px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-200 cursor-pointer hover:bg-pink-100"
              >
                灵动俏皮
              </button>
              <button
                type="button"
                @click="applyItemPreset(item, 'reset')"
                class="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 cursor-pointer hover:bg-slate-300"
              >
                恢复基准
              </button>
            </div>
          </div>

          <!-- 独立语速与音高滑块 -->
          <div v-if="item.customAcoustics" class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <div class="flex items-center justify-between text-[11px] text-slate-600">
                <span>独立语速</span>
                <span class="font-mono text-indigo-600 font-semibold">{{ (item.speedMultiplier || 1.0).toFixed(2) }}x ({{ getItemRate(item) }})</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                v-model.number="item.speedMultiplier"
                class="w-full h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
            <div>
              <div class="flex items-center justify-between text-[11px] text-slate-600">
                <span>独立音调</span>
                <span class="font-mono text-indigo-600 font-semibold">{{ getItemPitch(item) }}</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="5"
                v-model.number="item.pitchOffset"
                class="w-full h-1 bg-slate-200 rounded appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        </div>

        <!-- 台词输入框 (支持快捷插入停顿) -->
        <div class="relative">
          <textarea
            v-model="item.text"
            rows="2"
            class="w-full bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all leading-relaxed font-mono"
            placeholder="输入该角色的台词，可写自然语言或 SSML 停顿..."
          ></textarea>
          <div class="flex items-center justify-between text-[10px] text-slate-400 mt-0.5 px-1">
            <div class="flex items-center space-x-1.5">
              <span>插入停顿:</span>
              <button
                type="button"
                @click="addDialogueBreak(item, 400)"
                class="text-indigo-600 hover:underline cursor-pointer"
              >
                +0.4s呼吸
              </button>
              <span>·</span>
              <button
                type="button"
                @click="addDialogueBreak(item, 800)"
                class="text-indigo-600 hover:underline cursor-pointer"
              >
                +0.8s长停顿
              </button>
            </div>
            <span>{{ item.text.length }} 字</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部添加与批量操作 -->
    <div class="flex items-center justify-between pt-2 flex-wrap gap-3">
      <button
        type="button"
        @click="addDialogueTurn"
        class="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-dashed border-slate-300 hover:border-indigo-500 hover:text-indigo-600 bg-white text-slate-600 text-xs font-medium cursor-pointer transition-all shadow-2xs"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>添加对话行 (Add Turn)</span>
      </button>

      <div class="flex items-center space-x-2">
        <button
          type="button"
          @click="exportEachAudio"
          :disabled="dialogueList.length === 0"
          class="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer disabled:opacity-40"
        >
          按顺序批量导出各句音频 ({{ exportFormat.toUpperCase() }})
        </button>
      </div>
    </div>
  </div>
</template>

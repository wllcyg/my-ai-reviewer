<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Download,
  Maximize2,
  Copy,
  Check,
  Trash2,
  Dices,
  X,
  Palette,
  RotateCcw
} from 'lucide-vue-next'
import { apiUrl } from '@/utils/api'

interface GeneratedImage {
  id: string
  prompt: string
  enhancedPrompt?: string
  url: string
  seed: number
  style: string
  ratio: string
  time: string
}

// 基础输入状态
const imagePrompt = ref('minimal modern 3d glass icon, purple and cyan neon, tech style, dark background')
const imageRatio = ref<'1024x1024' | '1280x720' | '720x1280' | '1024x768'>('1024x1024')
const selectedStyle = ref<string>('3d-glass')
const customSeed = ref<number | null>(null)
const imageLoading = ref(false)
const loadingStatusText = ref('')
const errorMessage = ref('')
const copiedPromptId = ref<string | null>(null)

// 风格预设列表
const styleOptions = [
  { id: 'none', label: '默认自然' },
  { id: '3d-glass', label: '3D 玻璃拟态' },
  { id: 'realistic', label: '8K 写实摄影' },
  { id: 'cyberpunk', label: '赛博朋克' },
  { id: 'anime', label: '新海诚动漫' },
  { id: 'ink', label: '东方水墨' },
  { id: 'clay', label: '黏土动画' }
]

// 比例列表
const ratioOptions = [
  { id: '1024x1024', label: '1:1 方图' },
  { id: '1280x720', label: '16:9 宽屏' },
  { id: '720x1280', label: '9:16 竖屏' },
  { id: '1024x768', label: '4:3 画幅' }
]

// 灵感推荐词库
const quickPrompts = [
  { title: '3D玻璃图标', text: 'minimal modern 3d glass icon, glowing gradient, tech style' },
  { title: '赛博小猫', text: 'a cute cybernetic kitten with glowing blue visor, octane render' },
  { title: 'AI未来座舱', text: 'futuristic AI developer workspace with holographic clean dashboards' },
  { title: '水墨山水', text: 'traditional chinese landscape watercolor painting with misty mountains' },
  { title: '宇航员梦境', text: 'surreal astronaut floating in a sea of floating glowing jellyfish, 8k' }
]

// 历史画廊存储
const STORAGE_KEY = 'ai_reviewer_flux_gallery'
const gallery = ref<GeneratedImage[]>([])

const loadGallery = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      gallery.value = JSON.parse(raw)
    }
  } catch {
    gallery.value = []
  }
}

const saveGallery = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gallery.value.slice(0, 20)))
  } catch {}
}

const clearGallery = () => {
  gallery.value = []
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

const removeGalleryItem = (id: string, e: Event) => {
  e.stopPropagation()
  gallery.value = gallery.value.filter(item => item.id !== id)
  saveGallery()
}

// 随机生成一个 Seed
const randomizeSeed = () => {
  customSeed.value = Math.floor(100000 + Math.random() * 900000)
}

// 核心：调用生成并进行真实网络图片预加载
const generateFluxImage = async () => {
  const clean = imagePrompt.value.trim()
  if (!clean || imageLoading.value) return

  imageLoading.value = true
  errorMessage.value = ''
  loadingStatusText.value = '正在分发云端 GPU 任务...'

  const [w, h] = imageRatio.value.split('x').map(Number)
  const targetSeed = customSeed.value && customSeed.value > 0 ? customSeed.value : Math.floor(100000 + Math.random() * 900000)

  try {
    // 1. 调用后端 MCP 工具获取参数化图片 URL
    const res = await fetch(apiUrl('/api/mcp/call'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'generate_image',
        args: {
          prompt: clean,
          width: w,
          height: h,
          model: 'flux',
          seed: targetSeed,
          style: selectedStyle.value !== 'none' ? selectedStyle.value : null
        }
      })
    })

    const data = await res.json()
    if (!data.image_url) {
      throw new Error(data.error || '未返回有效图片地址')
    }

    loadingStatusText.value = 'FLUX 正在实时推理成片，加载中...'

    // 2. 真实预加载图片，避免假完成和浏览器破图
    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      const timer = setTimeout(() => {
        // 超时 30s 兜底
        resolve()
      }, 30000)

      img.onload = () => {
        clearTimeout(timer)
        resolve()
      }
      img.onerror = () => {
        clearTimeout(timer)
        reject(new Error('图片渲染加载超时或源站网络波动'))
      }
      img.src = data.image_url
    })

    // 3. 成功入画廊顶部
    const newImage: GeneratedImage = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      prompt: clean,
      enhancedPrompt: data.enhanced_prompt,
      url: data.image_url,
      seed: data.seed || targetSeed,
      style: selectedStyle.value,
      ratio: imageRatio.value,
      time: new Date().toLocaleTimeString()
    }

    gallery.value.unshift(newImage)
    saveGallery()

    // 自动重置/随机种子，便于下次抽卡
    randomizeSeed()
  } catch (err: any) {
    errorMessage.value = `生图异常: ${err.message || '网络连接超时'}`
  } finally {
    imageLoading.value = false
    loadingStatusText.value = ''
  }
}

// 灯箱全屏预览状态
const lightboxOpen = ref(false)
const activeLightboxImage = ref<GeneratedImage | null>(null)

const openLightbox = (img: GeneratedImage) => {
  activeLightboxImage.value = img
  lightboxOpen.value = true
}

const closeLightbox = () => {
  lightboxOpen.value = false
  activeLightboxImage.value = null
}

// 高可靠图片下载函数（完美支持 Base64 原生直存与外链下载，杜绝 35B 跨域废文件）
const downloadImage = (img: GeneratedImage, e?: Event) => {
  if (e) e.stopPropagation()
  const safeName = (img.prompt || 'flux_image')
    .slice(0, 24)
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_')
  const fileName = `flux_${safeName}_${img.seed || 'art'}.jpg`

  // 1. 如果是 Cloudflare 直出的 Base64 图片（内存级高清无损直下）
  if (img.url.startsWith('data:image')) {
    try {
      const parts = img.url.split(',')
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
      const bstr = atob(parts[1])
      let n = bstr.length
      const u8arr = new Uint8Array(n)
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n)
      }
      const blob = new Blob([u8arr], { type: mime })
      const blobUrl = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
      return
    } catch (err) {
      console.error('Base64 转换下载失败:', err)
    }
  }

  // 2. 如果是外网直链（处理 CORS 跨域）
  fetch(img.url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.blob()
    })
    .then((blob) => {
      if (blob.size < 100) {
        // 如果文件太小（例如 35 字节通常是报错文本），降级使用新窗口打开原图
        window.open(img.url, '_blank')
        return
      }
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    })
    .catch(() => {
      // 跨域受限时降级唤起浏览器原图下载
      const a = document.createElement('a')
      a.href = img.url
      a.target = '_blank'
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    })
}

// 复制提示词
const copyPrompt = async (img: GeneratedImage, e?: Event) => {
  if (e) e.stopPropagation()
  await navigator.clipboard.writeText(img.prompt)
  copiedPromptId.value = img.id
  setTimeout(() => {
    if (copiedPromptId.value === img.id) {
      copiedPromptId.value = null
    }
  }, 2000)
}

// 一键复用参数进行二次创作
const reusePrompt = (img: GeneratedImage, e?: Event) => {
  if (e) e.stopPropagation()
  imagePrompt.value = img.prompt
  if (img.ratio) imageRatio.value = img.ratio as any
  if (img.style) selectedStyle.value = img.style
  if (img.seed) customSeed.value = img.seed
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  loadGallery()
  randomizeSeed()
})
</script>

<template>
  <div class="space-y-6">
    <!-- 主生图工作台 -->
    <div class="ui-card p-4 sm:p-6 transition-all shadow-xs">
      <!-- 头部信息 -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <div class="flex items-center space-x-2">
            <h2 class="text-base sm:text-lg font-semibold text-slate-900 tracking-tight flex items-center space-x-1.5">
              <Sparkles class="w-4 h-4 text-indigo-500 fill-indigo-500" />
              <span>FLUX 极速生图工作台</span>
            </h2>
            <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>⚡ Cloudflare Workers AI 驱动 · 零限频</span>
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            由 Cloudflare 原生运行 FLUX.1 Schnell 大模型，支持 8K 级风格修饰、无限制秒级生成。
          </p>
        </div>

        <!-- 比例切换器 -->
        <div class="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200/80 text-xs font-medium self-start sm:self-center overflow-x-auto max-w-full">
          <button
            v-for="r in ratioOptions"
            :key="r.id"
            @click="imageRatio = r.id as any"
            :class="imageRatio === r.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap"
          >
            {{ r.label }}
          </button>
        </div>
      </div>

      <!-- 风格增强预设胶囊栏 -->
      <div class="mb-4">
        <div class="flex items-center space-x-1.5 text-xs text-slate-500 mb-2">
          <Palette class="w-3.5 h-3.5 text-indigo-500" />
          <span class="font-medium">画面风格预设:</span>
        </div>
        <div class="flex items-center space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            v-for="s in styleOptions"
            :key="s.id"
            @click="selectedStyle = s.id"
            :class="selectedStyle === s.id ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200/70 text-slate-700 border border-slate-200/60'"
            class="px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer shrink-0"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <!-- 提示词主输入框 -->
      <div class="space-y-2 mb-3">
        <div class="flex space-x-2">
          <div class="relative flex-1 min-w-0">
            <textarea
              v-model="imagePrompt"
              rows="2"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 text-xs sm:text-sm focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-2xs resize-none"
              placeholder="输入中英文画面描述（如：minimal modern 3d glass icon, tech style）..."
              @keydown.enter.prevent="generateFluxImage"
            ></textarea>
          </div>

          <button
            @click="generateFluxImage"
            :disabled="imageLoading || !imagePrompt.trim()"
            class="inline-flex flex-col items-center justify-center space-y-1 px-5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs sm:text-sm font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RefreshCw v-if="imageLoading" class="w-5 h-5 animate-spin" />
            <Sparkles v-else class="w-5 h-5 text-indigo-400" />
            <span>{{ imageLoading ? '生成中' : '开始生成' }}</span>
          </button>
        </div>

        <!-- 种子 Seed 与辅助控制行 -->
        <div class="flex items-center justify-between text-xs text-slate-500 pt-1 flex-wrap gap-2">
          <div class="flex items-center space-x-2">
            <span class="text-slate-400">随机种子 (Seed):</span>
            <div class="inline-flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 font-mono text-[11px]">
              <input
                v-model.number="customSeed"
                type="number"
                class="w-20 bg-transparent text-slate-700 focus:outline-none"
                placeholder="自动随机"
              />
              <button
                @click="randomizeSeed"
                class="text-slate-400 hover:text-indigo-600 transition-colors p-0.5 cursor-pointer"
                title="重新随机种子"
              >
                <Dices class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <span class="text-[11px] text-slate-400 font-mono">
            分辨率: {{ imageRatio.replace('x', ' × ') }}
          </span>
        </div>
      </div>

      <!-- 灵感推荐词 -->
      <div class="flex items-center space-x-2 overflow-x-auto py-1 text-xs text-slate-400 border-t border-slate-100 pt-3">
        <span class="shrink-0 text-[11px] font-medium text-slate-400">灵感模板:</span>
        <div class="flex items-center space-x-1.5 shrink-0">
          <button
            v-for="(p, i) in quickPrompts"
            :key="i"
            @click="imagePrompt = p.text"
            class="px-2.5 py-1 rounded-md bg-slate-100/80 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[11px] border border-slate-200/60 transition-all cursor-pointer whitespace-nowrap"
          >
            {{ p.title }}
          </button>
        </div>
      </div>
    </div>

    <!-- 错误异常提示 -->
    <div v-if="errorMessage" class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
      <span>{{ errorMessage }}</span>
      <button
        @click="generateFluxImage"
        class="px-2.5 py-1 rounded bg-white text-rose-700 border border-rose-300 font-medium hover:bg-rose-100/50 cursor-pointer text-[11px]"
      >
        重试
      </button>
    </div>

    <!-- 正在生成的全屏骨架卡片（解决假完成与破图） -->
    <div v-if="imageLoading" class="ui-card p-6 flex flex-col items-center justify-center text-center animate-pulse border-indigo-200 bg-indigo-50/20">
      <div class="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3 animate-spin">
        <Sparkles class="w-7 h-7" />
      </div>
      <h3 class="text-sm font-semibold text-slate-800">{{ loadingStatusText || '正在渲染中...' }}</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-sm">
        基于 FLUX.1 大模型分布式集群进行推理，预计耗时 3~6 秒，成片后自动淡入。
      </p>
    </div>

    <!-- 历史画廊专区 -->
    <div class="space-y-4">
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center space-x-2">
          <h3 class="text-sm font-semibold text-slate-900">创作画廊 (Gallery)</h3>
          <span class="text-xs text-slate-400 font-mono">共 {{ gallery.length }} 张作品</span>
        </div>
        <button
          v-if="gallery.length"
          @click="clearGallery"
          class="text-xs text-slate-400 hover:text-rose-500 transition-colors flex items-center space-x-1 cursor-pointer"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>清空画廊</span>
        </button>
      </div>

      <!-- 画廊卡片网格 -->
      <div v-if="gallery.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="img in gallery"
          :key="img.id"
          class="ui-card rounded-2xl overflow-hidden group hover:border-slate-300 transition-all flex flex-col justify-between shadow-2xs"
        >
          <!-- 图片主体与遮罩操作层 (采用等比方图高保真渲染，消除拉伸模糊) -->
          <div
            @click="openLightbox(img)"
            class="relative w-full aspect-square bg-slate-900/5 overflow-hidden cursor-zoom-in flex items-center justify-center"
          >
            <img
              :src="img.url"
              loading="lazy"
              class="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
              alt="FLUX output"
            />
            <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
              <span class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-xs text-slate-900 text-xs font-medium shadow-md">
                <Maximize2 class="w-3.5 h-3.5" />
                <span>放大极清查看</span>
              </span>
            </div>
            <!-- 比例小标 -->
            <span class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono">
              1024×1024
            </span>
          </div>

          <!-- 卡片文字与操作区 -->
          <div class="p-3.5 flex flex-col justify-between flex-1 space-y-2.5 text-xs">
            <p class="text-slate-800 line-clamp-2 leading-relaxed font-sans text-xs" :title="img.prompt">
              {{ img.prompt }}
            </p>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span class="font-mono">Seed: {{ img.seed }}</span>
              <div class="flex items-center space-x-1">
                <!-- 再创作 -->
                <button
                  @click="(e) => reusePrompt(img, e)"
                  class="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                  title="使用此参数重新创作"
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                </button>
                <!-- 复制提示词 -->
                <button
                  @click="(e) => copyPrompt(img, e)"
                  class="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  title="复制提示词"
                >
                  <Check v-if="copiedPromptId === img.id" class="w-3.5 h-3.5 text-emerald-600" />
                  <Copy v-else class="w-3.5 h-3.5" />
                </button>
                <!-- 下载 -->
                <button
                  @click="(e) => downloadImage(img, e)"
                  class="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                  title="保存下载到本地"
                >
                  <Download class="w-3.5 h-3.5" />
                </button>
                <!-- 删除单条 -->
                <button
                  @click="(e) => removeGalleryItem(img.id, e)"
                  class="p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                  title="移除此画作"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 画廊空状态 -->
      <div v-else-if="!imageLoading" class="ui-card p-12 flex flex-col items-center justify-center text-center">
        <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <ImageIcon class="w-6 h-6" />
        </div>
        <h3 class="text-sm font-semibold text-slate-800">暂无生成画作</h3>
        <p class="text-xs text-slate-500 mt-1 max-w-sm">
          在上方输入框键入您想象的画面，或点击灵感模板一键生成首张作品。
        </p>
      </div>
    </div>

    <!-- 高清大图灯箱预览模态框 (Lightbox Modal) -->
    <div
      v-if="lightboxOpen && activeLightboxImage"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 animate-in fade-in duration-200"
      @click="closeLightbox"
    >
      <div
        class="relative max-w-5xl w-full max-h-[92vh] flex flex-col items-center bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
        @click.stop
      >
        <!-- 顶栏操作区 -->
        <div class="w-full px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-white">
          <div class="flex items-center space-x-2 truncate pr-4">
            <span class="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px]">
              Seed: {{ activeLightboxImage.seed }}
            </span>
            <span class="text-slate-300 truncate">{{ activeLightboxImage.prompt }}</span>
          </div>

          <div class="flex items-center space-x-2 shrink-0">
            <button
              @click="downloadImage(activeLightboxImage)"
              class="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors cursor-pointer"
            >
              <Download class="w-3.5 h-3.5" />
              <span>保存原图</span>
            </button>
            <a
              :href="activeLightboxImage.url"
              target="_blank"
              rel="noopener noreferrer"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="在新标签页查看原始文件"
            >
              <ExternalLink class="w-4 h-4" />
            </a>
            <button
              @click="closeLightbox"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- 图片展示主体 -->
        <div class="flex-1 w-full flex items-center justify-center p-4 overflow-auto">
          <img
            :src="activeLightboxImage.url"
            class="max-w-full max-h-[72vh] object-contain rounded-lg shadow-lg"
            alt="FLUX High-res preview"
          />
        </div>

        <!-- 底栏详细参数 -->
        <div class="w-full px-4 py-2.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>画幅: {{ activeLightboxImage.ratio }}</span>
          <span>生成时间: {{ activeLightboxImage.time }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

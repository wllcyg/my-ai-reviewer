<script setup lang="ts">
import { ref } from 'vue'
import { Image as ImageIcon, Sparkles, RefreshCw, ExternalLink } from 'lucide-vue-next'

const imagePrompt = ref('minimal modern 3d glass icon, purple and cyan neon, tech style, dark background')
const imageRatio = ref<'1024x1024' | '1280x720' | '720x1280'>('1024x1024')
const imageList = ref<Array<{ prompt: string; url: string; time: string }>>([])
const imageLoading = ref(false)

const quickPrompts = [
  'minimal modern 3d glass icon, tech style',
  'a cute cybernetic kitten with glowing blue visor',
  'futuristic AI developer workspace with clean dashboards',
  'traditional chinese landscape watercolor painting'
]

const generateFluxImage = async () => {
  if (!imagePrompt.value.trim()) return
  imageLoading.value = true
  const [w, h] = imageRatio.value.split('x').map(Number)
  try {
    const res = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'generate_image',
        args: { prompt: imagePrompt.value, width: w, height: h, model: 'flux' }
      })
    })
    const data = await res.json()
    if (data.image_url) {
      imageList.value.unshift({
        prompt: imagePrompt.value,
        url: data.image_url,
        time: new Date().toLocaleTimeString()
      })
    }
  } catch (e) {
    console.error(e)
  } finally {
    imageLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="ui-card p-6">
      <div class="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <div class="flex items-center space-x-2">
            <h2 class="text-lg font-semibold text-slate-900 tracking-tight">Pollinations FLUX 图像生成</h2>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              免Key · 秒级出图
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            基于 FLUX 开源社区算力，支持多比例无水印快速出图。
          </p>
        </div>

        <!-- 比例切换 -->
        <div class="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200/80 text-xs font-medium">
          <button
            v-for="r in [
              { id: '1024x1024', label: '1:1 方图' },
              { id: '1280x720', label: '16:9 横屏' },
              { id: '720x1280', label: '9:16 竖屏' }
            ]"
            :key="r.id"
            @click="imageRatio = r.id as any"
            :class="imageRatio === r.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'"
            class="px-2.5 py-1 rounded-md transition-all cursor-pointer"
          >
            {{ r.label }}
          </button>
        </div>
      </div>

      <div class="flex space-x-2 mb-3">
        <input
          v-model="imagePrompt"
          type="text"
          class="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2 text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all shadow-2xs"
          placeholder="输入图像英文提示词..."
        />
        <button
          @click="generateFluxImage"
          :disabled="imageLoading"
          class="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw v-if="imageLoading" class="w-3.5 h-3.5 animate-spin" />
          <Sparkles v-else class="w-3.5 h-3.5" />
          <span>{{ imageLoading ? '生成中...' : '生成图像' }}</span>
        </button>
      </div>

      <!-- 灵感标签 -->
      <div class="flex items-center space-x-2 overflow-x-auto py-1 text-xs text-slate-400 mb-6">
        <span>灵感推荐:</span>
        <button
          v-for="(p, i) in quickPrompts"
          :key="i"
          @click="imagePrompt = p"
          class="px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200/60 whitespace-nowrap cursor-pointer"
        >
          {{ p.slice(0, 28) }}...
        </button>
      </div>

      <!-- 画廊网格 -->
      <div v-if="imageList.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="(img, idx) in imageList"
          :key="idx"
          class="rounded-xl overflow-hidden border border-slate-200 bg-white group shadow-2xs"
        >
          <img :src="img.url" class="w-full h-52 object-cover bg-slate-100" />
          <div class="p-3 text-xs flex flex-col justify-between">
            <p class="text-slate-700 truncate font-mono text-[11px]">{{ img.prompt }}</p>
            <div class="flex items-center justify-between text-slate-400 mt-2">
              <span class="font-mono">{{ img.time }}</span>
              <a :href="img.url" target="_blank" class="text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 font-medium">
                <span>原图</span>
                <ExternalLink class="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
        <ImageIcon class="w-8 h-8 mb-2 text-slate-300" />
        <span>输入 Prompt 点击生成，开始你的 AI 画廊创作</span>
      </div>
    </div>
  </div>
</template>

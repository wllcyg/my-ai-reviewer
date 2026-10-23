<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  CloudSun,
  Search,
  RefreshCw,
  MapPin,
  Wind,
  Droplets,
  Thermometer,
  Umbrella,
  Calendar,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  Terminal,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next'
import { apiUrl } from '@/utils/api'

// 天气数据结构接口
interface LocationInfo {
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
  display: string
  coord_display: string
}

interface CurrentWeather {
  temperature: number
  temperature_unit: string
  apparent_temperature: number
  apparent_temperature_unit: string
  relative_humidity: number
  relative_humidity_unit: string
  wind_speed: number
  wind_speed_unit: string
  weather_code: number
  weather_desc: string
}

interface DailyWeather {
  date: string
  weather_code: number
  weather_desc: string
  temp_max: number | null
  temp_min: number | null
  precip_prob: number
}

interface WeatherData {
  location: LocationInfo
  current: CurrentWeather
  units: {
    temp: string
    humidity: string
    wind: string
    precip: string
  }
  daily: DailyWeather[]
  raw_text: string
  attribution: string
}

interface CandidateLocation {
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

// 状态管理
const searchQuery = ref('北京')
const selectedDays = ref<number>(7)
const loading = ref(false)
const errorMessage = ref('')
const weatherData = ref<WeatherData | null>(null)
const candidates = ref<CandidateLocation[]>([])
const copied = ref(false)
const showRawMcp = ref(false)

// 热门快捷城市标签
const popularCities = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '西安', '东京', '伦敦']

// 根据 WMO weather_code 获取对应图标与主色调
const getWeatherVisual = (code: number) => {
  if (code === 0) {
    return { icon: Sun, colorClass: 'text-amber-500 bg-amber-50 border-amber-200' }
  }
  if (code === 1 || code === 2) {
    return { icon: CloudSun, colorClass: 'text-sky-500 bg-sky-50 border-sky-200' }
  }
  if (code === 3) {
    return { icon: Cloud, colorClass: 'text-slate-500 bg-slate-100 border-slate-200' }
  }
  if (code === 45 || code === 48) {
    return { icon: CloudFog, colorClass: 'text-indigo-400 bg-indigo-50 border-indigo-200' }
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { icon: CloudRain, colorClass: 'text-blue-500 bg-blue-50 border-blue-200' }
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { icon: CloudSnow, colorClass: 'text-cyan-500 bg-cyan-50 border-cyan-200' }
  }
  if (code >= 95) {
    return { icon: CloudLightning, colorClass: 'text-violet-500 bg-violet-50 border-violet-200' }
  }
  return { icon: CloudSun, colorClass: 'text-sky-500 bg-sky-50 border-sky-200' }
}

// 格式化日期为友好显示（例如：今天 / 10月24日 周六）
const formatDailyDate = (dateStr: string, index: number) => {
  if (index === 0) return '今天'
  if (index === 1) return '明天'
  try {
    const d = new Date(dateStr)
    const month = d.getMonth() + 1
    const day = d.getDate()
    const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `${month}月${day}日 ${weekMap[d.getDay()]}`
  } catch {
    return dateStr
  }
}

// 智能出行温馨建议
const travelTips = computed(() => {
  if (!weatherData.value) return null
  const current = weatherData.value.current
  const todayDaily = weatherData.value.daily[0]
  const temp = current.temperature
  const precip = todayDaily?.precip_prob || 0
  const isRain = (current.weather_code >= 51 && current.weather_code <= 67) || precip >= 40

  const tips: { type: string; title: string; content: string; icon: any }[] = []

  if (isRain) {
    tips.push({
      type: 'rain',
      title: '降水预警',
      content: `降水概率 ${precip}%，出门建议携带雨具，路面湿滑请小心慢行。`,
      icon: Umbrella
    })
  } else {
    tips.push({
      type: 'sun',
      title: '天气适宜',
      content: '今日无明显降雨，微风舒适，适合户外出行或开窗通风。',
      icon: Sun
    })
  }

  if (temp <= 10) {
    tips.push({
      type: 'cold',
      title: '防寒保暖',
      content: `当前气温较凉 (${temp}°C)，早晚温差大，建议穿厚外套或风衣。`,
      icon: Thermometer
    })
  } else if (temp >= 28) {
    tips.push({
      type: 'hot',
      title: '防暑降温',
      content: `当前气温较高 (${temp}°C)，紫外线较强，请注意补水防晒。`,
      icon: Sun
    })
  } else {
    tips.push({
      type: 'comfy',
      title: '温度宜人',
      content: `当前气温 ${temp}°C，体感 ${current.apparent_temperature}°C，体感清爽舒适。`,
      icon: Sparkles
    })
  }

  return tips
})

// 核心查询逻辑
const fetchWeather = async (targetLoc?: string) => {
  const loc = (targetLoc || searchQuery.value).trim()
  if (!loc) return

  if (targetLoc) {
    searchQuery.value = targetLoc
  }

  loading.value = true
  errorMessage.value = ''
  candidates.value = []

  try {
    const res = await fetch(
      apiUrl(`/api/weather?location=${encodeURIComponent(loc)}&days=${selectedDays.value}`)
    )
    const data = await res.json()

    if (data.error) {
      errorMessage.value = data.error
      weatherData.value = null
      // 尝试自动查询候选城市供消歧
      checkCandidates(loc)
    } else {
      weatherData.value = data
    }
  } catch (err: any) {
    errorMessage.value = `请求天气服务失败: ${err.message || '网络异常'}`
    weatherData.value = null
  } finally {
    loading.value = false
  }
}

// 检查重名候选地点
const checkCandidates = async (name: string) => {
  try {
    const res = await fetch(
      apiUrl(`/api/weather/search?name=${encodeURIComponent(name)}&count=5`)
    )
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) {
      candidates.value = data
    }
  } catch {
    candidates.value = []
  }
}

// 选择候选地点
const handleSelectCandidate = (item: CandidateLocation) => {
  const queryStr = item.admin1 && item.admin1 !== item.name
    ? `${item.name} ${item.admin1}`
    : item.name
  fetchWeather(queryStr)
}

// 一键复制 MCP 原始文本
const copyRawMcp = async () => {
  if (!weatherData.value?.raw_text) return
  try {
    await navigator.clipboard.writeText(weatherData.value.raw_text)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    copied.value = false
  }
}

// 初始化时自动获取一次北京天气
onMounted(() => {
  fetchWeather('北京')
})
</script>

<template>
  <div class="space-y-6 max-w-5xl mx-auto">
    <!-- 1. 顶部搜索与城市快捷选择栏 -->
    <div class="ui-card p-5 sm:p-6 bg-white/95 backdrop-blur-md">
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <!-- 搜索输入区域 -->
        <div class="relative flex-1">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="输入城市或地名 (如: 北京, 上海, 朝阳, Tokyo, London)..."
            @keydown.enter="fetchWeather()"
            class="w-full pl-10 pr-24 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm bg-slate-50/50 hover:bg-white"
          />
          <Search class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          
          <button
            type="button"
            @click="fetchWeather()"
            :disabled="loading"
            class="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer shadow-2xs"
          >
            <RefreshCw :class="['w-3.5 h-3.5', loading ? 'animate-spin' : '']" />
            <span>{{ loading ? '查询中' : '查询天气' }}</span>
          </button>
        </div>

        <!-- 预报天数切换器 (1天 / 3天 / 7天) -->
        <div class="flex items-center space-x-1.5 bg-slate-100/80 p-1 rounded-xl self-end sm:self-auto shrink-0 border border-slate-200/60">
          <button
            v-for="d in [1, 3, 7]"
            :key="d"
            type="button"
            @click="selectedDays = d; fetchWeather()"
            :class="[
              'px-3 py-1.2 rounded-lg text-xs font-medium transition-all cursor-pointer',
              selectedDays === d
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            ]"
          >
            {{ d === 1 ? '今天' : `${d}天预报` }}
          </button>
        </div>
      </div>

      <!-- 快捷热门城市胶囊标签 -->
      <div class="mt-3.5 flex items-center flex-wrap gap-1.5 text-xs">
        <span class="text-slate-400 flex items-center space-x-1 text-[11px] mr-1">
          <Sparkles class="w-3 h-3 text-amber-500" />
          <span>热门地点:</span>
        </span>
        <button
          v-for="city in popularCities"
          :key="city"
          type="button"
          @click="fetchWeather(city)"
          :class="[
            'px-2.5 py-1 rounded-lg border transition-all cursor-pointer',
            searchQuery === city && !loading
              ? 'bg-sky-50 text-sky-700 border-sky-200 font-medium'
              : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-600'
          ]"
        >
          {{ city }}
        </button>
      </div>

      <!-- 重名消歧候选建议 -->
      <div v-if="candidates.length > 0" class="mt-4 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs space-y-2">
        <div class="flex items-center space-x-1.5 text-amber-800 font-medium">
          <AlertCircle class="w-4 h-4 text-amber-600 shrink-0" />
          <span>检测到有多个同名地点，请点击具体行政区确认：</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(item, idx) in candidates"
            :key="idx"
            type="button"
            @click="handleSelectCandidate(item)"
            class="px-2.5 py-1.5 bg-white hover:bg-amber-100/60 border border-amber-200 text-amber-900 rounded-lg text-xs font-mono transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs"
          >
            <MapPin class="w-3 h-3 text-amber-600" />
            <span>{{ item.name }}</span>
            <span v-if="item.admin1" class="text-amber-600">({{ item.admin1 }})</span>
            <span class="text-slate-400 text-[10px]">{{ item.country }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 2. 错误提示卡片 -->
    <div v-if="errorMessage" class="p-4 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-start space-x-2.5">
      <AlertCircle class="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
      <div class="space-y-1">
        <div class="font-semibold">查询提示</div>
        <div class="leading-relaxed">{{ errorMessage }}</div>
      </div>
    </div>

    <!-- 3. 主气象卡片体系 -->
    <div v-if="weatherData" class="space-y-6">
      <!-- 3.1 当前天气巨幅看板 (Hero Weather Card) -->
      <div class="ui-card p-6 sm:p-8 bg-gradient-to-br from-sky-50/70 via-white to-slate-50/60 border-sky-100/80 relative overflow-hidden">
        <!-- 背景微光气象装饰 -->
        <div class="absolute -right-8 -top-8 w-44 h-44 rounded-full bg-sky-200/20 blur-3xl pointer-events-none"></div>

        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <!-- 左侧：城市与当前主温度 -->
          <div class="space-y-3">
            <div class="flex items-center space-x-2 text-slate-700">
              <MapPin class="w-5 h-5 text-sky-600 shrink-0" />
              <h2 class="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {{ weatherData.location.display }}
              </h2>
              <span class="text-[11px] px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 font-mono">
                {{ weatherData.location.coord_display }}
              </span>
            </div>

            <!-- 温度大字号展示与天气状况 -->
            <div class="flex items-baseline space-x-4">
              <div class="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tighter">
                {{ weatherData.current.temperature }}
                <span class="text-2xl sm:text-3xl font-semibold text-slate-500 font-sans">
                  {{ weatherData.current.temperature_unit }}
                </span>
              </div>
              <div class="flex flex-col">
                <span class="text-lg font-semibold text-slate-800">
                  {{ weatherData.current.weather_desc }}
                </span>
                <span class="text-xs text-slate-500">
                  体感温度 {{ weatherData.current.apparent_temperature }} {{ weatherData.current.apparent_temperature_unit }}
                </span>
              </div>
            </div>
          </div>

          <!-- 右侧：动态天气图腾勋章 -->
          <div class="flex items-center space-x-4 self-start md:self-auto">
            <div :class="['w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center border shadow-xs transition-transform hover:scale-105', getWeatherVisual(weatherData.current.weather_code).colorClass]">
              <component :is="getWeatherVisual(weatherData.current.weather_code).icon" class="w-10 h-10 sm:w-12 sm:h-12" />
            </div>
          </div>
        </div>

        <!-- 3.2 四大微指标矩阵卡片 -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-200/60">
          <!-- 体感温度 -->
          <div class="p-3.5 rounded-xl bg-white/80 border border-slate-100 shadow-2xs flex items-center space-x-3">
            <div class="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Thermometer class="w-4 h-4" />
            </div>
            <div>
              <div class="text-[11px] text-slate-400">体感气温</div>
              <div class="text-sm font-semibold text-slate-800 font-mono">
                {{ weatherData.current.apparent_temperature }} {{ weatherData.current.apparent_temperature_unit }}
              </div>
            </div>
          </div>

          <!-- 相对湿度 -->
          <div class="p-3.5 rounded-xl bg-white/80 border border-slate-100 shadow-2xs flex items-center space-x-3">
            <div class="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Droplets class="w-4 h-4" />
            </div>
            <div>
              <div class="text-[11px] text-slate-400">空气湿度</div>
              <div class="text-sm font-semibold text-slate-800 font-mono">
                {{ weatherData.current.relative_humidity }} {{ weatherData.current.relative_humidity_unit }}
              </div>
            </div>
          </div>

          <!-- 风速 -->
          <div class="p-3.5 rounded-xl bg-white/80 border border-slate-100 shadow-2xs flex items-center space-x-3">
            <div class="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <Wind class="w-4 h-4" />
            </div>
            <div>
              <div class="text-[11px] text-slate-400">实时风速</div>
              <div class="text-sm font-semibold text-slate-800 font-mono">
                {{ weatherData.current.wind_speed }} {{ weatherData.current.wind_speed_unit }}
              </div>
            </div>
          </div>

          <!-- 今日降水概率 -->
          <div class="p-3.5 rounded-xl bg-white/80 border border-slate-100 shadow-2xs flex items-center space-x-3">
            <div class="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Umbrella class="w-4 h-4" />
            </div>
            <div>
              <div class="text-[11px] text-slate-400">降水概率</div>
              <div class="text-sm font-semibold text-slate-800 font-mono">
                {{ weatherData.daily[0]?.precip_prob || 0 }} {{ weatherData.units.precip }}
              </div>
            </div>
          </div>
        </div>

        <!-- 3.3 智能生活出行贴士 -->
        <div v-if="travelTips && travelTips.length > 0" class="mt-4 pt-4 border-t border-slate-200/50 flex flex-col sm:flex-row gap-3">
          <div
            v-for="(tip, idx) in travelTips"
            :key="idx"
            class="flex-1 p-3 rounded-lg bg-slate-50/70 border border-slate-200/60 flex items-start space-x-2.5 text-xs text-slate-700"
          >
            <component :is="tip.icon" class="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div>
              <span class="font-semibold text-slate-900 mr-1.5">{{ tip.title }}:</span>
              <span class="text-slate-600 leading-relaxed">{{ tip.content }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. 未来预报矩阵 (逐日卡片) -->
      <div class="ui-card p-5 sm:p-6 bg-white">
        <div class="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div class="flex items-center space-x-2">
            <Calendar class="w-4 h-4 text-indigo-600" />
            <h3 class="font-semibold text-sm text-slate-900">未来 {{ weatherData.daily.length }} 天趋势预报</h3>
          </div>
          <span class="text-[11px] text-slate-400 font-mono">Open-Meteo 全球高精度气象模型</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div
            v-for="(day, idx) in weatherData.daily"
            :key="day.date"
            class="p-4 rounded-xl border border-slate-200/70 bg-slate-50/40 hover:bg-white hover:border-slate-300 hover:shadow-xs transition-all space-y-3"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-800">{{ formatDailyDate(day.date, idx) }}</span>
              <span class="text-[10px] text-slate-400 font-mono">{{ day.date }}</span>
            </div>

            <div class="flex items-center space-x-3">
              <div :class="['w-9 h-9 rounded-lg flex items-center justify-center border', getWeatherVisual(day.weather_code).colorClass]">
                <component :is="getWeatherVisual(day.weather_code).icon" class="w-4.5 h-4.5" />
              </div>
              <div>
                <div class="text-xs font-medium text-slate-900">{{ day.weather_desc }}</div>
                <div class="text-[11px] text-slate-500 font-mono">
                  最高 {{ day.temp_max }}{{ weatherData.units.temp }} / 最低 {{ day.temp_min }}{{ weatherData.units.temp }}
                </div>
              </div>
            </div>

            <!-- 降水概率轻量进度条 -->
            <div class="space-y-1 pt-1">
              <div class="flex justify-between text-[10px] text-slate-400">
                <span>降水概率</span>
                <span class="font-mono font-medium" :class="day.precip_prob > 30 ? 'text-blue-600' : 'text-slate-500'">
                  {{ day.precip_prob }}%
                </span>
              </div>
              <div class="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
                <div
                  class="bg-blue-500 h-full rounded-full transition-all duration-500"
                  :style="{ width: `${Math.min(100, Math.max(0, day.precip_prob))}%` }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. MCP 原始协议格式化视图 (开发者与大模型对齐) -->
      <div class="ui-card p-5 bg-white border-slate-200/80">
        <div class="flex items-center justify-between">
          <button
            type="button"
            @click="showRawMcp = !showRawMcp"
            class="flex items-center space-x-2 text-xs font-semibold text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer"
          >
            <Terminal class="w-4 h-4 text-slate-500" />
            <span>MCP Server 原始格式化文本</span>
            <ChevronUp v-if="showRawMcp" class="w-3.5 h-3.5 text-slate-400" />
            <ChevronDown v-else class="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            v-if="showRawMcp"
            type="button"
            @click="copyRawMcp"
            class="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer"
          >
            <Check v-if="copied" class="w-3 h-3 text-emerald-600" />
            <Copy v-else class="w-3 h-3" />
            <span>{{ copied ? '已复制' : '复制文本' }}</span>
          </button>
        </div>

        <div v-if="showRawMcp" class="mt-3.5">
          <pre class="p-3.5 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed selection:bg-indigo-500 selection:text-white">{{ weatherData.raw_text }}</pre>
        </div>
      </div>

      <!-- 6. 官方署名与许可协议 -->
      <div class="text-center text-[11px] text-slate-400 font-mono pt-2">
        <span>{{ weatherData.attribution }} (CC BY 4.0 免费非商业气象服务)</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Code2, Play, Volume2, AlertTriangle, ShieldCheck } from 'lucide-vue-next'
import { apiUrl } from '@/utils/api'


const emit = defineEmits<{
  (e: 'read-summary', text: string): void
}>()

const codeSnippet = ref(`def process_items(items):
    # 模拟潜在性能瓶颈与异常处理缺失
    results = []
    for item in items:
        # 同步读取无缓存
        with open("log.txt", "a") as f:
            f.write(str(item) + "\\n")
        results.append(item * 2)
    return results`)

const reviewLoading = ref(false)
const reviewReport = ref<any>(null)

const triggerCodeReview = async () => {
  reviewLoading.value = true
  try {
    const res = await fetch(apiUrl('/api/review'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeSnippet.value, language: 'python' })
    })
    reviewReport.value = await res.json()
  } catch (e) {
    console.error(e)
  } finally {
    reviewLoading.value = false
  }
}

const handleReadSummary = () => {
  if (reviewReport.value?.summary) {
    emit('read-summary', reviewReport.value.summary)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 源码编辑卡片 -->
      <div class="ui-card p-4 sm:p-5 flex flex-col">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center space-x-2">
            <Code2 class="w-4 h-4 text-slate-700" />
            <h3 class="text-sm font-semibold text-slate-900">源代码输入</h3>
          </div>
          <button
            @click="triggerCodeReview"
            :disabled="reviewLoading"
            class="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-medium transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Play class="w-3 h-3" />
            <span>{{ reviewLoading ? '静态分析中...' : '开始审查' }}</span>
          </button>
        </div>

        <textarea
          v-model="codeSnippet"
          rows="14"
          class="flex-1 w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 leading-relaxed"
        ></textarea>
      </div>

      <!-- 审查结论卡片 -->
      <div class="ui-card p-5 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div class="flex items-center space-x-2">
              <ShieldCheck class="w-4 h-4 text-emerald-600" />
              <h3 class="text-sm font-semibold text-slate-900">审计报告</h3>
            </div>
            <button
              v-if="reviewReport"
              @click="handleReadSummary"
              class="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
            >
              <Volume2 class="w-3.5 h-3.5" />
              <span>语音播报结论</span>
            </button>
          </div>

          <!-- 报告详情 -->
          <div v-if="reviewReport" class="space-y-4">
            <!-- 综合评分 -->
            <div class="flex items-center space-x-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
              <div class="w-12 h-12 rounded-lg bg-emerald-600 text-white font-mono font-bold text-xl flex items-center justify-center shadow-xs">
                {{ reviewReport.score }}
              </div>
              <div class="flex-1 text-xs text-slate-600 leading-relaxed">
                {{ reviewReport.summary }}
              </div>
            </div>

            <!-- 维度评分 -->
            <div class="grid grid-cols-2 gap-2">
              <div
                v-for="d in reviewReport.dimensions"
                :key="d.name"
                class="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs"
              >
                <span class="text-slate-500">{{ d.name }}</span>
                <span class="font-mono font-semibold text-slate-900">{{ d.score }}分</span>
              </div>
            </div>

            <!-- 优化建议 -->
            <div class="space-y-2 mt-3">
              <div
                v-for="(s, idx) in reviewReport.suggestions"
                :key="idx"
                class="p-3 rounded-lg bg-amber-50/50 border border-amber-200/80 text-xs text-slate-700"
              >
                <div class="flex items-center space-x-1.5 font-semibold text-amber-900 mb-0.5">
                  <AlertTriangle class="w-3.5 h-3.5 text-amber-600" />
                  <span>{{ s.title }}</span>
                </div>
                <p class="text-slate-600 leading-normal">{{ s.desc }}</p>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else class="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
            <Code2 class="w-8 h-8 mb-2 text-slate-300" />
            <span>输入源码并点击「开始审查」即可获取分析报告</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

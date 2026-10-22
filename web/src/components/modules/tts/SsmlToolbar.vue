<script setup lang="ts">
import {
  Wand2,
  Clock,
  Volume2,
  Phone,
  Hash,
  Type,
  Eraser
} from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'insert', startTag: string, endTag?: string): void
  (e: 'clear'): void
}>()
</script>

<template>
  <div class="mb-2 p-2 bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
    <div class="flex items-center space-x-1.5 flex-wrap gap-1">
      <span class="text-slate-500 font-medium flex items-center space-x-1 mr-1">
        <Wand2 class="w-3.5 h-3.5 text-indigo-500" />
        <span>SSML 标记:</span>
      </span>
      <button
        type="button"
        @click="emit('insert', '<break time=&quot;500ms&quot; />')"
        class="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1"
        title="在光标处插入 0.5s 停顿呼吸"
      >
        <Clock class="w-3 h-3 text-amber-500" />
        <span>停顿 0.5s</span>
      </button>
      <button
        type="button"
        @click="emit('insert', '<break time=&quot;1000ms&quot; />')"
        class="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1"
        title="在光标处插入 1s 长呼吸停顿"
      >
        <Clock class="w-3 h-3 text-amber-600" />
        <span>停顿 1s</span>
      </button>
      <button
        type="button"
        @click="emit('insert', '<emphasis level=&quot;strong&quot;>', '</emphasis>')"
        class="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1"
        title="对选中文字施加重音强调"
      >
        <Volume2 class="w-3 h-3 text-emerald-500" />
        <span>语气强调</span>
      </button>
      <button
        type="button"
        @click="emit('insert', '<say-as interpret-as=&quot;telephone&quot;>', '</say-as>')"
        class="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1"
        title="按电话号码分段连续念出"
      >
        <Phone class="w-3 h-3 text-blue-500" />
        <span>电话号码</span>
      </button>
      <button
        type="button"
        @click="emit('insert', '<say-as interpret-as=&quot;digits&quot;>', '</say-as>')"
        class="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1"
        title="单个数字逐位读出"
      >
        <Hash class="w-3 h-3 text-purple-500" />
        <span>逐位数字</span>
      </button>
      <button
        type="button"
        @click="emit('insert', '<say-as interpret-as=&quot;characters&quot;>', '</say-as>')"
        class="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1"
        title="英文单词逐字母拼读"
      >
        <Type class="w-3 h-3 text-indigo-500" />
        <span>字母拼读</span>
      </button>
    </div>

    <!-- 清除标签 -->
    <button
      type="button"
      @click="emit('clear')"
      class="px-2 py-1 text-slate-500 hover:text-rose-600 hover:bg-white rounded-md text-[11px] font-medium transition-colors cursor-pointer flex items-center space-x-1 border border-transparent hover:border-slate-200"
      title="一键清除文本中所有 SSML 标签还原纯文本"
    >
      <Eraser class="w-3 h-3" />
      <span>清除标签</span>
    </button>
  </div>
</template>

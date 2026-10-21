<script setup lang="ts">
import type { Component } from 'vue'

export interface NavItem {
  id: string
  label: string
  icon: Component
}

defineProps<{
  tabs: NavItem[]
  currentTab: string
}>()

const emit = defineEmits<{
  (e: 'change', tabId: string): void
}>()
</script>

<template>
  <div class="border-b border-slate-200/80 bg-white">
    <div class="max-w-7xl mx-auto px-6 flex space-x-2 overflow-x-auto py-2.5">
      <button
        v-for="item in tabs"
        :key="item.id"
        @click="emit('change', item.id)"
        :class="[
          'flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 whitespace-nowrap cursor-pointer',
          currentTab === item.id
            ? 'bg-slate-100 text-slate-900 shadow-xs border border-slate-200/60 font-semibold'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
        ]"
      >
        <component :is="item.icon" class="w-3.5 h-3.5" />
        <span>{{ item.label }}</span>
      </button>
    </div>
  </div>
</template>

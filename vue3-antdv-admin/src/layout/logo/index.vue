<template>
  <div class="logo">
    <img src="~@/assets/images/logo.png" alt="" />
    <h2 v-show="!collapsed" class="title">{{ title }}</h2>
  </div>
</template>

<script setup>
  defineProps({
    collapsed: {
      type: Boolean,
    },
  });

  const title = import.meta.env.VITE_APP_TITLE || 'AI Reviewer';
</script>

<style lang="less" scoped>
  .logo {
    @apply flex overflow-hidden whitespace-nowrap items-center;

    height: 64px;
    padding-left: 24px;
    line-height: 64px;

    img {
      height: 32px;
      margin-right: 8px;
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    .title {
      @apply mb-0 text-xl;

      color: var(--app-primary-color);
    }
  }
</style>

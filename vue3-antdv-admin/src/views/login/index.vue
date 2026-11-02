<template>
  <div class="login-box">
    <div class="login-logo">
      <!-- <svg-icon name="logo" :size="45" /> -->
      <img src="~@/assets/images/logo.png" width="45" />
      <h1 class="mb-0 ml-2 text-3xl font-bold">{{ appTitle }}</h1>
    </div>
    <a-form layout="horizontal" :model="loginFormModel" @submit.prevent="handleSubmit">
      <a-form-item>
        <a-input v-model:value="loginFormModel.username" size="large" placeholder="admin">
          <template #prefix> <Icon icon="ant-design:user-outlined" /> </template>
        </a-input>
      </a-form-item>
      <a-form-item>
        <a-input
          v-model:value="loginFormModel.password"
          size="large"
          type="password"
          placeholder="a123456"
          autocomplete="new-password"
        >
          <template #prefix> <Icon icon="ant-design:lock-outlined" /></template>
        </a-input>
      </a-form-item>
      <a-form-item>
        <div class="flex items-center gap-3">
          <a-input
            v-model:value="loginFormModel.verifyCode"
            placeholder="计算结果"
            :maxlength="4"
            size="large"
            class="flex-1"
          >
            <template #prefix> <Icon icon="ant-design:safety-outlined" /> </template>
          </a-input>
          <a-tooltip title="看不清？点击更换">
            <div
              class="h-[40px] w-[120px] shrink-0 overflow-hidden rounded-md border border-gray-200 bg-slate-50 flex items-center justify-center cursor-pointer transition-all hover:border-blue-400 hover:shadow-sm select-none"
              @click="updateCaptcha"
            >
              <img v-if="captcha" :src="captcha" class="h-full w-full object-contain" alt="验证码" />
              <a-spin v-else size="small" />
            </div>
          </a-tooltip>
        </div>
      </a-form-item>
      <a-form-item>
        <a-button type="primary" html-type="submit" size="large" :loading="loading" block>
          登录
        </a-button>
      </a-form-item>
    </a-form>
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { message, Modal } from 'ant-design-vue';
  import { Icon } from '@/components/basic/icon';
  import { useUserStore } from '@/store/modules/user';
  import Api from '@/api/';
  import { to } from '@/utils/awaitTo';

  const route = useRoute();
  const router = useRouter();

  const appTitle = import.meta.env.VITE_APP_TITLE || 'AI Reviewer';
  const userStore = useUserStore();

  const loading = ref(false);
  const captcha = ref('');
  const loginFormModel = ref({
    username: 'admin',
    password: 'a123456',
    verifyCode: '',
    captchaId: '',
  });

  const updateCaptcha = async () => {
    const data = await Api.captcha.captchaCaptchaByImg({ width: 120, height: 40 });
    captcha.value = data.img;
    loginFormModel.value.captchaId = data.id;
  };
  updateCaptcha();

  const handleSubmit = async () => {
    const { username, password, verifyCode } = loginFormModel.value;
    if (username.trim() == '' || password.trim() == '') {
      return message.warning('用户名或密码不能为空！');
    }
    if (!verifyCode) {
      return message.warning('请输入验证码！');
    }
    message.loading('登录中...', 0);
    loading.value = true;
    console.log(loginFormModel.value);
    // params.password = md5(password)

    const [err] = await to(userStore.login(loginFormModel.value));
    if (err) {
      Modal.error({
        title: () => '提示',
        content: () => err.message,
      });
      updateCaptcha();
    } else {
      message.success('登录成功！');
      setTimeout(() => router.replace((route.query.redirect as string) || '/'));
    }
    loading.value = false;
    message.destroy();
  };
</script>

<style lang="less" scoped>
  .login-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100vw;
    height: 100vh;
    padding-top: 240px;
    background: url('@/assets/login.svg');
    background-size: 100%;

    .login-logo {
      display: flex;
      align-items: center;
      margin-bottom: 30px;

      img {
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      .svg-icon {
        font-size: 48px;
      }
    }

    :deep(.ant-form) {
      width: 400px;

      .ant-col {
        width: 100%;
      }

      .ant-form-item-label {
        padding-right: 6px;
      }
    }
  }
</style>

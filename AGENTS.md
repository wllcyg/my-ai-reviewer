# 项目开发规范与行为准则

## 1. 单文件代码体量红线（硬性规定）

- **严禁任何单文件代码超过 1200 行**：
  - 包括但不限于 `.vue` 单文件组件、`.ts` 服务模块、IPC 桥接层及样式文件。
  - **预防性拆分**：当单一文件超过 600~800 行时，应立即按照单一职责原则进行重构拆分：
    - Vue 组件拆分为清晰的子组件（Sub-components）与专用组合式函数（Composables）。
    - 业务逻辑抽离至独立的 `services/` 或 `utils/` 模块。
    - 类型声明统一维护在 `types/` 目录下。

## 2. 架构与性能底线

- **主进程（Node.js 端）**：
  - 严禁使用任何同步阻塞操作（如 `execSync`、`readFileSync`），所有 I/O、Git 与外部网络调用必须采用 `async/await` 异步执行。
- **渲染进程（Vue 3 端）**：
  - 严格采用 Vue 3 Composition API 与 `<script setup lang="ts">`。
  - 流式打字与大文本渲染必须配合 `requestAnimationFrame` 合并帧缓冲池，防响应式频繁触发造成的界面掉帧。
- **Monaco Editor**：
  - Worker 按需裁剪，仅打包核心 Workers（如 `typescript`、`json`），杜绝全量打包。

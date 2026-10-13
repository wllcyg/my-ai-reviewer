# Zed 风格桌面端 AI 代码审查工具开发计划

本项目旨在基于 **Electron + Vue 3 + @earendil-works/pi-ai** 构建一款轻量、极简暗黑质感、支持流式打字、一键自动修复，并深度打通**企业私有 GitLab 远程 MR 审查**的现代化桌面端 AI 代码审查工具。

### 核心工程红线
- **文件体积限制**：**严禁任何单文件代码超过 1200 行**。超过 600~800 行时必须主动拆分为独立的 Service、Composable 或子组件。
- **主进程零阻塞**：严禁同步 I/O 与 `execSync`，统一采用异步 Promise 执行。
- **UI 响应性保障**：AI 流式打字与大差异渲染使用 `requestAnimationFrame` 缓冲帧，杜绝界面卡顿掉帧。

---

## 阶段一：项目骨架与极简暗黑窗口（Day 1）

### 目标
搭建基于 `electron-vite` 的开发环境，完成类似 Zed 的无边框暗黑窗口与基础 IPC 通信。

### 详细任务
- [x] **项目环境初始化**
  - 使用 `pnpm create @quick-start/electron my-ai-reviewer --template vue-ts` 初始化。
  - 配置 `.npmrc`（加入 `electron_mirror` 镜像防止安装卡死）。
  - 安装基础依赖：`tailwindcss`, `postcss`, `autoprefixer`, `lucide-vue-next`, `@vueuse/core`。
- [x] **Zed 风格主窗口配置**
  - 在 `src/main/index.ts` 中配置 `BrowserWindow`：
    - `frame: false`（隐藏系统标题栏）
    - `titleBarStyle: 'hiddenInset'`（macOS 红绿灯按钮自适应）
    - `backgroundColor: '#18181b'`（炭黑底色防闪烁）
- [x] **Tailwind 极简暗黑设计系统搭建**
  - 配置 `tailwind.config.js`：定义 `zinc-900`/`zinc-950` 底色系统。
  - 引入等宽编程字体（JetBrains Mono 或 Geist Mono）。
  - 封装自定义顶部拖拽工具栏（包含窗口最小化、关闭和项目路径选择器）。

### 验收标准
- 窗口启动无边框、无白屏闪烁，拖拽平滑，呈现 Zed 级炭黑质感。

---

## 阶段二：本地 Git 扫描与 Monaco Diff 视图（Day 2）

### 目标
在主进程实现异步 Git Diff 提取，在渲染进程通过 Monaco Diff Editor 实现高性能双栏差异对比。

### 详细任务
- [x] **主进程异步 Git 模块开发**
  - 在 `src/main/services/git.ts` 中实现：
    - `getRepoStatus(projectPath)`：异步获取当前分支、变更文件列表。
    - `getFileDiff(projectPath, filePath)`：异步获取指定文件的前后差异内容。
  - 严禁使用 `execSync`，统一采用 `promisify(exec)` + 异常捕获。
- [x] **集成 Monaco Diff 编辑器**
  - 安装并配置 `@guolao/vue-monaco-editor` 与 `monaco-editor`。
  - 绑定本地 Monaco 引擎脱离外部 CDN 依赖，支持双栏与行内模式无缝切换。
- [x] **前端双栏 Diff 页面实现**
  - 左侧边栏（宽度 220px）：已变更文件树列表（带 Modified / Added 状态标记）。
  - 右侧主体区：`<vue-monaco-diff-editor>` 暗黑主题双栏虚拟视口渲染。
- [x] **多审查源扩展支持（分支对比与指定提交）**
  - 支持工作区修改（Working Tree）、历史提交（Commit Review）、两分支差异（Branch Diff）三大模式一键无缝切换。
  - 封装独立的 `CommitPicker.vue` 与 `BranchPicker.vue` 轻量子组件。

### 验收标准
- 点选不同文件，Monaco 秒级切换并精准呈现语法高亮差异，滚动维持 60fps。

---

## 阶段三：AI 审查引擎接入与 RAF 打字机（Day 3）

### 目标
主进程按需集成 `@earendil-works/pi-ai`，通过 IPC 实现思考链展示与无卡顿流式审查。

### 详细任务
- [x] **按需集成 `@earendil-works/pi-ai`**
  - 遵循 Tree-shaking 规范，从 `@earendil-works/pi-ai/models` 按需引入 `createModels`，并挂载 `openaiProvider` / `anthropicProvider` / `deepseekProvider`。
  - 严禁全量引入 `providers/all`。
- [x] **审查主循环与 IPC 管道**
  - 主进程编写 `startReview(diffText, modelId)` 与中断控制接口。
  - 发射流式事件：`review:thinking_delta`、`review:text_delta`、`review:done`。
- [x] **渲染端 RAF 节流打字机组件**
  - 编写 `ReviewPanel.vue` 审查侧边栏。
  - 实现基于 `requestAnimationFrame` 的批量帧合并缓冲池，杜绝 Vue 响应式频繁触发造成的掉帧。
  - 实现可折叠的 **Thinking (思维链)** 徽章卡片与状态指示。
  - 使用 `markdown-it` 渲染审查建议，配合 `AIConfigModal.vue` 提供快捷预设。

### 验收标准
- 审查过程中，思考过程与流式文字高速输出，CPU 占用低于 10%，主窗口拖拽丝滑无卡顿。

---

## 阶段四：“审查并自动修复”闭环（Day 4）

### 目标
实现 Zed 风格的行内建议卡片，支持用户一键将修复应用到本地磁盘，并刷新 Diff。

### 详细任务
- [ ] **结构化审查提示词设计**
  - 设计 Prompt，强制模型在输出解释的同时，附带标准修复补丁块（文件名、行号、原始代码、修复代码）。
- [ ] **一键采纳（Apply Fix）功能**
  - 前端审查卡片渲染 `[采纳修复 (Apply)]` 按钮。
  - 主进程实现 `applyCodeFix(projectPath, filePath, originalCode, fixCode)`：
    - 读取磁盘文件并进行原子化替换。
    - 触发 `getFileDiff` 重新拉取最新的本地 Diff。
- [ ] **Monaco 视图响应式热刷新**
  - 采纳后，Monaco Diff 视图立即平滑过渡为最新内容，对应审查问题自动标记为已解决。

### 验收标准
- 点击单条建议的“采纳修复”后，磁盘文件被准确修改，Diff 视图立刻实时同步更新。

---

## 阶段五：企业私有 GitLab 联动与远程 MR 审查回评（Day 5）

### 目标
支持登录公司自建 GitLab，无需本地 Clone 代码即可远程拉取 Merge Request（MR）变更，执行 AI 审查，并将审查意见直接回评到 GitLab 代码行上。

### 详细任务
- [ ] **GitLab 鉴权与配置管理**
  - 支持配置私有 GitLab 域名（如 `https://gitlab.mycorp.com`）与个人访问令牌（PAT / Personal Access Token）。
  - 主进程提供凭证安全持久化（基于 Electron safeStorage 或加密存储）。
- [ ] **远程 MR 与 Diff 拉取引擎**
  - 接入 GitLab REST API v4：
    - `GET /api/v4/merge_requests?scope=assigned_to_me&state=opened`：拉取分配给当前用户的待审查 MR。
    - `GET /api/v4/projects/:id/merge_requests/:mr_iid/diffs`：拉取指定 MR 的全量结构化变更。
- [ ] **GitLab MR 审查专属界面**
  - 顶部增加“本地仓库 / 远程 GitLab MR”切换标签。
  - 点击指定 MR，左侧渲染 MR 变更文件树，中间渲染线上最新 Diff，右侧自动触发 AI 审查。
- [ ] **AI 意见一键回评到 GitLab**
  - 在 AI 审查建议卡片旁增加 `[提交到 GitLab 评论]` 按钮。
  - 调用 `POST /api/v4/projects/:id/merge_requests/:mr_iid/discussions`：
    - 携带精确定位参数 `position`（`base_sha`, `start_sha`, `head_sha`, `new_path`, `new_line`）。
    - 将 AI 发现的安全漏洞、逻辑缺陷自动转化为 GitLab 页面上的行级代码审查评论。

### 验收标准
- 成功拉取公司 GitLab 的私有 MR，AI 审查完成后点击一键评论，GitLab 网页端对应代码行下能准确看到 AI 生成的格式化 Review 意见。

---

## 阶段六：性能优化、打包瘦身与生产构建（Day 6）

### 目标
优化最终的分发包体积，确保安装包大小控制在最佳范围内，支持全离线模式。

### 详细任务
- [ ] **打包配置文件调优**
  - 配置 `electron-builder.yml`：
    - 启用 `asar: true`。
    - 精确配置 `files` 白名单，过滤测试代码与未打包的原始资源。
- [ ] **打包构建与产物校验**
  - 执行 `pnpm build && pnpm build:win` 打包 `.exe` 安装程序。
  - 检查解压后体积与安装包体积是否符合预期（目标压缩至 60~80MB 范围）。
- [ ] **离线兜底验证**
  - 测试无网络环境下对接本地 Ollama（`http://localhost:11434/v1`）审查功能。

### 验收标准
- 生成干净的独立安装包，启动时间小于 1 秒，内存初始占用低于 120MB。

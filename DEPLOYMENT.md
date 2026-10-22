# 🚀 全栈部署指南 (Docker 后端 + Cloudflare Pages 前端)

本项目采用现代前后端分离架构：
- **后端服务**：基于 Docker / Docker Compose 容器化部署在您的 Linux 云服务器或 VPS。
- **前端页面**：基于 Vue 3 + Vite，静态打包并一键部署至 Cloudflare Pages 全球 CDN。

---

## 目录
1. [第一部分：后端 Docker 部署（云服务器）](#第一部分后端-docker-部署云服务器)
2. [第二部分：前端 Cloudflare Pages 部署](#第二部分前端-cloudflare-pages-部署)
3. [第三部分：前后端联调与跨域代理配置](#第三部分前后端联调与跨域代理配置)
4. [常见问题与排错](#常见问题与排错)

---

## 第一部分：后端 Docker 部署（云服务器）

### 1. 准备代码与环境
确保服务器已安装 Docker 与 Docker Compose：
```bash
docker --version
docker compose version
```

将后端项目文件上传至云服务器的工作目录（例如 `/opt/overseas-hub`），核心文件清单如下：
```text
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .dockerignore
├── .env                 # 生产环境变量（密钥敏感）
├── config.py
├── main.py
├── 01_base_agent/
├── 02_mcp/
└── core/
```

### 2. 配置服务器 `.env` 文件
在服务器项目根目录下创建或编辑 `.env`：
```bash
cp .env.example .env
nano .env
```
配置您的核心密钥：
```ini
APP_ENV=production
DEBUG=false
HOST=0.0.0.0
PORT=8000

# 智算 / 大模型 API Key（用于 AI 代码审查等）
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Cloudflare Workers AI 生图密钥（FLUX 生图引擎）
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
```

### 3. 一键启动容器
在服务器项目根目录下执行：
```bash
# 构建镜像并在后台启动
docker compose up -d --build

# 查看运行状态
docker compose ps

# 查看实时日志
docker compose logs -f backend
```

### 4. 开放服务器防火墙端口
确保云服务商（腾讯云 / 阿里云 / AWS 等）的安全组已放行 **8000** 端口（TCP）。
测试访问：
```bash
curl http://<YOUR_SERVER_IP>:8000/health
# 返回: {"status":"ok","mcp":{"name":"OverseasFreeHub","status":"mounted"}} 即代表启动成功！
```

---

## 第二部分：前端 Cloudflare Pages 部署

前端可以直接部署在 Cloudflare Pages 上，无需任何服务器维护，全球秒级加载。

### 方法 A：直接拖拽上传（最快，零配置）
1. 在本地机器的 `web` 目录下执行打包：
   ```bash
   cd web
   npm run build
   ```
   打包完成后会生成 `web/dist` 文件夹。
2. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
3. 进入 **Workers & Pages** -> 点击 **Create application** -> 选择 **Pages** 选项卡。
4. 选择 **Upload assets**（上传静态资产）。
5. 输入项目名称（如 `my-ai-reviewer`）。
6. 将本地 `web/dist` 文件夹拖入上传区域，点击 **Deploy site**。
7. 部署完成后，Cloudflare 会分配一个类似 `https://my-ai-reviewer.pages.dev` 的免费 HTTPS 域名！

---

### 方法 B：Git 仓库自动持续集成（推荐长久维护）
1. 将项目代码推送到 GitHub / GitLab 仓库。
2. 在 Cloudflare 控制台 -> **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**。
3. 选择你的项目仓库，进入构建配置页面：
   - **Framework preset**: `Vite`
   - **Root directory**: `web`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. 点击 **Save and Deploy**，以后每次 git push 都会自动构建上线！

---

## 第三部分：前后端联调与跨域代理配置

前端部署在 Cloudflare Pages（强制 HTTPS：`https://xxx.pages.dev`），而后端如果在未配置 SSL 的云服务器（`http://IP:8000`），浏览器直接发起跨域请求会触发 **Mixed Content** 拦截。

**最优雅的解决方案**：利用 Cloudflare Pages 原生支持的 `_redirects` 边缘代理！

### 步骤：
1. 打开项目 `web/public/_redirects`（或已构建的 `web/dist/_redirects`）。
2. 将其中的代理规则取消注释，并替换为你后端服务器的公网 IP 或域名：
   ```apache
   # 将前端发送到 Cloudflare Pages 的 /api 请求无缝代理转发给你的 Docker 后端
   /api/*  http://<YOUR_SERVER_IP>:8000/api/:splat  200
   /health http://<YOUR_SERVER_IP>:8000/health  200

   # Vue Router 单页应用路由回退（避免刷新 404）
   /*  /index.html  200
   ```
3. 重新执行 `npm run build` 并将 `dist` 更新到 Cloudflare Pages；如果是 Git 方式，直接 push 即可。
4. 现在，访问你的 Cloudflare Pages 网站，无论是语音试听、搜索、硅谷资讯还是代码审计，全部由 Cloudflare 边缘节点反代，**彻底消除跨域与浏览器安全报错**！

---

## 常见问题与排错

### Q1: 页面刷新出现 404 怎么办？
确保 `dist` 目录下存在 `_redirects` 文件，且包含规则 `/* /index.html 200`。项目中已经默认配置并自动打包输出。

### Q2: Docker 后端服务如何重启或更新代码？
在服务器端修改代码或拉取最新代码后：
```bash
docker compose down
docker compose up -d --build
```

### Q3: 想绑定自定义域名？
在 Cloudflare Pages 项目设置中点击 **Custom domains**，即可一键绑定你自己的域名（免去申请 SSL 证书的繁琐流程，Cloudflare 自动颁发且全生命周期续签）。

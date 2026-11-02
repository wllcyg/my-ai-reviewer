# 🤖 AI Core Service (知识库 AI 核心服务)

本项目是 `my-ai-reviewer` 知识库系统的 AI 核心计算引擎，基于 **FastAPI + LangChain + ChromaDB** 构建。

## 一、核心职责

1. **文档多模态解析**：从 Cloudflare R2 拉取并提取 PDF、DOCX、Markdown、TXT 结构化文本；
2. **AI 合规自动初审**：调用大模型进行涉密、合规审查与质量打分；
3. **带权限语义分块（Chunking）**：注入部门与角色 Metadata，入库向量数据库；
4. **企业级 RAG 预过滤问答**：带租户与部门身份预过滤（Pre-Filtering）的语义问答检索。

## 二、快速启动

可以直接复用项目根目录的 Python 虚拟环境与依赖：

```bash
# 1. 切换到 ai-service 目录
cd ai-service

# 2. 启动服务 (默认端口 8001，热重载)
uvicorn app.main:app --reload --port 8001
```

- API 交互文档 (Swagger)：`http://127.0.0.1:8001/docs`
- 服务健康探针：`http://127.0.0.1:8001/health`

# 基础镜像：采用轻量且稳定的 Python 3.11 Slim
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量，防止 Python 生成 .pyc 文件以及启用无缓冲输出
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# 安装系统级依赖（curl 用于容器健康检查）
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 优先复制依赖清单，利用 Docker 分层缓存加速二次构建
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 复制后端核心代码目录与配置文件
COPY config.py /app/
COPY main.py /app/
COPY 01_base_agent /app/01_base_agent
COPY 02_mcp /app/02_mcp
COPY core /app/core
COPY .env.example /app/

# 暴露后端 API 服务端口
EXPOSE 8000

# 容器健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动 Uvicorn ASGI 服务，监听 0.0.0.0
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

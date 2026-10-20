# My Agent Study

从零开始的 **AI Agent 学习与实战演练** 项目，基于 **FastAPI** 和 **uv** 构建。

## 快速开始

### 1. 安装依赖
```bash
uv sync
```

### 2. 启动开发服务器
两种启动方式任选其一：

- 方式一：通过 `main.py`
  ```bash
  uv run python main.py
  ```

- 方式二：直接通过 `uvicorn` 热重载
  ```bash
  uv run uvicorn main:app --reload --port 8000
  ```

### 3. 访问接口文档
服务启动后，可在浏览器中打开：
- Swagger UI 交互式文档：[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- ReDoc 接口文档：[http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- 根路径测试：[http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- 健康检查：[http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### 4. 添加新依赖
```bash
uv add <package_name>
```

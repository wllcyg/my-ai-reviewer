from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.api.v1.document import router as document_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="企业知识库 AI 核心引擎 (文档多模态解析、自动化合规初审、RAG 向量切块与检索)",
    version="1.0.0",
)

# 跨域配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check():
    """轻量健康检查探针"""
    return {
        "status": "ok",
        "service": settings.app_name,
        "env": settings.app_env,
        "model": settings.model_name,
    }


# 注册 v1 路由
app.include_router(document_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )

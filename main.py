from fastapi import FastAPI, Depends
import uvicorn
from config import Settings, get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="AI 代码审查服务 API",
    version="0.1.0",
)


@app.get("/")
def read_root(cfg: Settings = Depends(get_settings)):
    return {
        "message": f"Hello from {cfg.app_name}",
        "environment": cfg.app_env,
        "debug": cfg.debug,
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}


def main():
    uvicorn.run("main:app", host="127.0.0.1", port=settings.port, reload=settings.debug)


if __name__ == "__main__":
    main()

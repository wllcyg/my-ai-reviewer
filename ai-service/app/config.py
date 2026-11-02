from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_ENV = BASE_DIR.parent / ".env"
LOCAL_ENV = BASE_DIR / ".env"


class Settings(BaseSettings):
    app_name: str = "AI Reviewer Core Service"
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8001

    # 大模型配置 (默认读取 DeepSeek)
    model_name: str = "deepseek-chat"
    llm_key: str = ""
    llm_base_url: str = "https://api.deepseek.com"

    # Cloudflare R2 / S3 存储配置 (用于拉取待解析文档)
    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "my-ai-reviewer"

    # RabbitMQ 消息队列配置
    rabbitmq_url: str = ""
    rabbitmq_queue: str = "kh.doc.process.queue"
    rabbitmq_prefetch_count: int = 1

    # 优先读本地 .env，其次读父级根目录 .env
    model_config = SettingsConfigDict(
        env_file=(LOCAL_ENV, ROOT_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

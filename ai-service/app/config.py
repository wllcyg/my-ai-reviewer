import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.infisical import load_infisical_secrets

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_ENV = BASE_DIR.parent / ".env"
LOCAL_ENV = BASE_DIR / ".env"
NEST_ENV = BASE_DIR.parent / "nest-admin" / ".env"

# 1. 优先加载引导配置文件 (优先读取本地，其次根目录，最后共享 nest-admin 凭据)
for env_path in (LOCAL_ENV, ROOT_ENV, NEST_ENV):
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=False)

# 2. 从私有 Infisical 云端拉取最新全量机密并注入到 os.environ
load_infisical_secrets()


class Settings(BaseSettings):
    """全局应用配置类，自动合并本地环境与 Infisical 远端密钥"""

    app_name: str = "AI Reviewer Core Service"
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8001

    # Infisical 远端配置中心引导项
    infisical_site_url: str = "https://env.cheatppf.xyz"
    infisical_client_id: str = ""
    infisical_client_secret: str = ""
    infisical_project_id: str = ""
    infisical_environment: str = "dev"

    # 大模型配置 (自动从 Infisical 加载)
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

    model_config = SettingsConfigDict(
        env_file=(LOCAL_ENV, ROOT_ENV, NEST_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

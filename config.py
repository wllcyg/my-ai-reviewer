from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "My AI Reviewer"
    app_env: str = "development"
    debug: bool = True
    port: int = 8000

    # 优先读取系统环境变量，其次读取 .env 文件
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """使用 lru_cache 保证配置单例，避免重复读取 .env 文件"""
    return Settings()

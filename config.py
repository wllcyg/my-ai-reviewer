from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# 定位项目根目录，无论在哪个子目录运行脚本都能准确找到 .env
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"


class Settings(BaseSettings):
    app_name: str = "My Agent Study"
    app_env: str = "development"
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # 模型配置
    model_name: str = "deepseek-chat"
    llm_key: str = ""
    llm_base_url: str = "https://api.deepseek.com"

    # 优先读取系统环境变量，其次读取项目根目录下的 .env 文件
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """使用 lru_cache 保证配置单例，避免重复读取 .env 文件"""
    return Settings()

from openai import OpenAI
from config import get_settings

# 读取项目统一配置（自动加载 .env 环境变量）
settings = get_settings()

# 初始化基础 OpenAI 客户端（支持 DeepSeek 等兼容 OpenAI 协议的模型厂商）
client = OpenAI(
    api_key=settings.llm_key,
    base_url=settings.llm_base_url,
)


def get_client() -> OpenAI:
    """获取 OpenAI 客户端单例实例"""
    return client

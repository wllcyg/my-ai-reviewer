from functools import lru_cache
from langchain_openai import ChatOpenAI
from openai import OpenAI
from app.config import get_settings

settings = get_settings()


@lru_cache
def get_openai_client() -> OpenAI:
    """原生 OpenAI 客户端"""
    return OpenAI(
        api_key=settings.llm_key,
        base_url=settings.llm_base_url,
    )


def get_llm(temperature: float = 0.3) -> ChatOpenAI:
    """获取 LangChain ChatOpenAI 实例"""
    return ChatOpenAI(
        model=settings.model_name,
        api_key=settings.llm_key,
        base_url=settings.llm_base_url,
        temperature=temperature,
    )

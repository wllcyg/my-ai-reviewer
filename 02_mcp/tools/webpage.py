import os
from typing import Any, Dict, Optional
import httpx
from mcp.server.fastmcp import FastMCP


async def fetch_webpage(
    url: str,
    max_chars: Optional[int] = 100000,
    proxy: Optional[str] = None
) -> str:
    """抓取任意网页并提取为纯净的 Markdown 格式，自动去除杂乱标签与广告。
    
    Args:
        url: 需要抓取的目标网页 URL
        max_chars: 最大保留字符数，默认 100,000 字符 (支持超长技术长文阅读，传 None 则不限制)
        proxy: 代理服务器地址，可选
    Returns:
        清洗后的纯文本 Markdown 全文内容
    """
    clean_url = url.strip()
    if not clean_url:
        return "抓取失败: URL 不能为空"

    jina_url = f"https://r.jina.ai/{clean_url}"
    effective_proxy = proxy or os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("ALL_PROXY")
    
    client_kwargs: Dict[str, Any] = {
        "timeout": 35.0,
        "follow_redirects": True,
        "headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/plain, text/markdown, text/html, */*",
            "X-No-Cache": "true"
        }
    }
    if effective_proxy:
        client_kwargs["proxy"] = effective_proxy

    async with httpx.AsyncClient(**client_kwargs) as client:
        try:
            resp = await client.get(jina_url)
            resp.raise_for_status()
            content = resp.text
            
            # 若内容超过指定上限（如 10 万字符），进行安全截断保护
            if max_chars and len(content) > max_chars:
                content = content[:max_chars] + f"\n\n...(内容已达安全上限 {max_chars} 字符已截断)..."
            return content
        except Exception as e:
            return f"抓取失败: {str(e)}。请检查目标网址是否可达。"


def register_webpage_tool(mcp: FastMCP):
    """向 FastMCP 服务注册网页抓取工具"""
    mcp.tool()(fetch_webpage)


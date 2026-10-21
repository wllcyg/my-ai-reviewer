import httpx
from mcp.server.fastmcp import FastMCP


async def fetch_webpage(url: str) -> str:
    """抓取任意网页并提取为纯净的 Markdown 格式，自动去除杂乱标签与广告。
    
    Args:
        url: 需要抓取的目标网页 URL
    Returns:
        清洗后的纯文本 Markdown 内容
    """
    jina_url = f"https://r.jina.ai/{url}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(jina_url)
            resp.raise_for_status()
            # 截取前 4000 字符防止上下文爆炸
            content = resp.text
            if len(content) > 4000:
                content = content[:4000] + "\n\n...(内容过长已截断)..."
            return content
        except Exception as e:
            return f"抓取失败: {str(e)}"


def register_webpage_tool(mcp: FastMCP):
    """向 FastMCP 服务注册网页抓取工具"""
    mcp.tool()(fetch_webpage)

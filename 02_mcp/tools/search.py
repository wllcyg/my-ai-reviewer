import json
from mcp.server.fastmcp import FastMCP
from duckduckgo_search import DDGS


def web_search(query: str, max_results: int = 5) -> str:
    """全球免翻搜索引擎检索，支持最新技术、海外资讯与中文搜索。
    
    Args:
        query: 搜索关键词
        max_results: 返回结果条数，默认 5 条
    Returns:
        JSON 格式的搜索结果列表 (包含 title, href, body)
    """
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
        return json.dumps(results, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": f"搜索失败: {str(e)}"}, ensure_ascii=False)


def register_search_tool(mcp: FastMCP):
    """向 FastMCP 服务注册网络搜索工具"""
    mcp.tool()(web_search)

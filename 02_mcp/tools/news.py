import json
import asyncio
import httpx
from mcp.server.fastmcp import FastMCP


async def get_tech_news(limit: int = 10) -> str:
    """获取硅谷 Hacker News 当前最热的前沿科技与开源项目热帖。
    
    Args:
        limit: 获取帖子数量，默认 10 条
    Returns:
        热门帖子列表 (包含标题、得分、链接)
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # 1. 获取 Top story IDs
            top_ids_res = await client.get("https://hacker-news.firebaseio.com/v0/topstories.json")
            story_ids = top_ids_res.json()[:limit]
            
            # 2. 并发抓取详情
            tasks = [client.get(f"https://hacker-news.firebaseio.com/v0/item/{sid}.json") for sid in story_ids]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            articles = []
            for resp in responses:
                if isinstance(resp, httpx.Response) and resp.status_code == 200:
                    item = resp.json()
                    articles.append({
                        "title": item.get("title"),
                        "url": item.get("url", f"https://news.ycombinator.com/item?id={item.get('id')}"),
                        "score": item.get("score"),
                        "author": item.get("by")
                    })
            return json.dumps(articles, ensure_ascii=False, indent=2)
        except Exception as e:
            return json.dumps({"error": f"获取技术趋势失败: {str(e)}"}, ensure_ascii=False)


def register_news_tool(mcp: FastMCP):
    """向 FastMCP 服务注册热点新闻工具"""
    mcp.tool()(get_tech_news)

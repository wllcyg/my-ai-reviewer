import asyncio
import json
import os
from typing import Any, Dict, List, Optional
import httpx
from mcp.server.fastmcp import FastMCP


async def get_tech_news(limit: int = 10, proxy: Optional[str] = None) -> str:
    """获取硅谷 Hacker News 当前最热的前沿科技与开源项目热帖。
    
    Args:
        limit: 获取帖子数量，默认 10 条 (建议 5-25)
        proxy: 代理服务器地址，可选
    Returns:
        JSON 格式的热门帖子列表 (包含标题、得分、链接、作者、发布时间等)
    """
    clean_limit = max(1, min(limit, 30))
    effective_proxy = proxy or os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("ALL_PROXY")
    client_kwargs: Dict[str, Any] = {
        "timeout": 15.0,
        "follow_redirects": True,
        "headers": {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    }
    if effective_proxy:
        client_kwargs["proxy"] = effective_proxy

    async with httpx.AsyncClient(**client_kwargs) as client:
        try:
            # 1. 获取 Top story IDs
            top_ids_res = await client.get("https://hacker-news.firebaseio.com/v0/topstories.json")
            top_ids_res.raise_for_status()
            story_ids = top_ids_res.json()[:clean_limit]
            
            # 2. 并发抓取详情
            tasks = [client.get(f"https://hacker-news.firebaseio.com/v0/item/{sid}.json") for sid in story_ids]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            articles: List[Dict[str, Any]] = []
            for resp in responses:
                if isinstance(resp, httpx.Response) and resp.status_code == 200:
                    item = resp.json()
                    if not item:
                        continue
                    articles.append({
                        "id": item.get("id"),
                        "title": item.get("title", "无标题"),
                        "url": item.get("url") or f"https://news.ycombinator.com/item?id={item.get('id')}",
                        "score": item.get("score", 0),
                        "author": item.get("by", "匿名"),
                        "time": item.get("time"),
                        "comments_count": item.get("descendants", 0)
                    })
            return json.dumps(articles, ensure_ascii=False, indent=2)
        except Exception as e:
            return json.dumps({"error": f"获取硅谷热榜失败: {str(e)}"}, ensure_ascii=False)


def register_news_tool(mcp: FastMCP):
    """向 FastMCP 服务注册热点新闻工具"""
    mcp.tool()(get_tech_news)


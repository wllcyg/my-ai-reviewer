import html
import json
import os
import re
from typing import Any, Dict, List, Optional
from urllib.parse import unquote
import httpx
from mcp.server.fastmcp import FastMCP


def _clean_text(text: str) -> str:
    """清理并反转义 HTML 实体标签"""
    if not text:
        return ""
    unescaped = html.unescape(text)
    # 去除多余连续空白符
    return re.sub(r"\s+", " ", unescaped).strip()


def _search_ddg_lite(
    query: str,
    max_results: int = 6,
    region: Optional[str] = "cn-zh",
    timelimit: Optional[str] = None,
    proxy: Optional[str] = None
) -> List[Dict[str, str]]:
    """通过 DuckDuckGo 官方 Lite 原生端点抓取结果，免翻直连且出词率高"""
    url = "https://lite.duckduckgo.com/lite/"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://lite.duckduckgo.com/",
    }
    data: Dict[str, str] = {"q": query}
    if region and region != "wt-wt":
        data["kl"] = region
    if timelimit in ("d", "w", "m", "y"):
        data["df"] = timelimit

    effective_proxy = proxy or os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("ALL_PROXY")
    client_kwargs: Dict[str, Any] = {"timeout": 12.0, "headers": headers, "follow_redirects": True}
    if effective_proxy:
        client_kwargs["proxy"] = effective_proxy

    with httpx.Client(**client_kwargs) as client:
        resp = client.post(url, data=data)
        resp.raise_for_status()

    from lxml.html import document_fromstring

    tree = document_fromstring(resp.text)
    link_nodes = tree.xpath("//a[@class='result-link']")
    snippet_nodes = tree.xpath("//td[@class='result-snippet']")

    results: List[Dict[str, str]] = []
    seen_urls = set()

    for i, link_node in enumerate(link_nodes):
        raw_href = link_node.attrib.get("href", "")
        if not raw_href:
            continue

        # 解码 DuckDuckGo 的跳转外链
        if "uddg=" in raw_href:
            clean_href = unquote(raw_href.split("uddg=")[1].split("&")[0])
        else:
            clean_href = raw_href

        if clean_href in seen_urls:
            continue
        seen_urls.add(clean_href)

        title = _clean_text(link_node.text_content())
        body = ""
        if i < len(snippet_nodes):
            body = _clean_text(snippet_nodes[i].text_content())

        results.append({
            "title": title,
            "href": clean_href,
            "body": body
        })

        if len(results) >= max_results:
            break

    return results


def _search_ddgs_fallback(
    query: str,
    max_results: int = 6,
    region: Optional[str] = "cn-zh",
    timelimit: Optional[str] = None,
    proxy: Optional[str] = None
) -> List[Dict[str, str]]:
    """备用通道：通过 duckduckgo_search 库检索"""
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        return []

    effective_proxy = proxy or os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("ALL_PROXY")
    ddgs_kwargs: Dict[str, Any] = {}
    if effective_proxy:
        ddgs_kwargs["proxy"] = effective_proxy

    with DDGS(**ddgs_kwargs) as ddgs:
        raw_results = ddgs.text(
            keywords=query,
            region=region,
            safesearch="moderate",
            timelimit=timelimit,
            max_results=max_results
        )
        return [
            {
                "title": _clean_text(item.get("title", "")),
                "href": item.get("href", ""),
                "body": _clean_text(item.get("body", ""))
            }
            for item in raw_results
            if item.get("href")
        ]


def web_search(
    query: str,
    max_results: int = 6,
    region: Optional[str] = "cn-zh",
    timelimit: Optional[str] = None,
    proxy: Optional[str] = None
) -> str:
    """全球免翻搜索引擎检索，支持区域过滤、时间跨度、海外资讯与中文技术搜索。
    
    Args:
        query: 搜索关键词
        max_results: 返回结果条数，默认 6 条 (建议 1-20)
        region: 搜索区域偏好:
                - 'cn-zh': 中文优先 (中国大陆/简体)
                - 'us-en': 欧美英文优先 (官方文档与海外前沿)
                - 'wt-wt': 全球中立
        timelimit: 时间范围过滤:
                - 'd': 过去 24 小时内最新
                - 'w': 过去 1 周内
                - 'm': 过去 1 个月内
                - 'y': 过去 1 年内
                - None: 全部时间
        proxy: 代理服务器地址 (例如 'http://127.0.0.1:7890')，可选
    Returns:
        JSON 格式的搜索结果列表 (包含 status, count, query, engine, results)
    """
    clean_query = query.strip()
    if not clean_query:
        return json.dumps({"error": "搜索关键词不能为空", "status": "error"}, ensure_ascii=False)

    clean_region = region if region in ("cn-zh", "us-en", "wt-wt") else "cn-zh"
    clean_timelimit = timelimit if timelimit in ("d", "w", "m", "y") else None
    target_count = max(1, min(max_results, 20))

    results: List[Dict[str, str]] = []
    used_engine = "duckduckgo-lite"

    # 第一通道：DuckDuckGo Lite 原生通道
    try:
        results = _search_ddg_lite(
            query=clean_query,
            max_results=target_count,
            region=clean_region,
            timelimit=clean_timelimit,
            proxy=proxy
        )
    except Exception:
        results = []

    # 若特定 region 无结果且为 cn-zh，尝试以全球中立 'wt-wt' 检索一次提高出词率
    if not results and clean_region != "wt-wt":
        try:
            results = _search_ddg_lite(
                query=clean_query,
                max_results=target_count,
                region="wt-wt",
                timelimit=clean_timelimit,
                proxy=proxy
            )
            if results:
                used_engine = "duckduckgo-lite (global fallback)"
        except Exception:
            pass

    # 第二通道：DDGS 降级通道
    if not results:
        try:
            results = _search_ddgs_fallback(
                query=clean_query,
                max_results=target_count,
                region=clean_region if clean_region != "wt-wt" else None,
                timelimit=clean_timelimit,
                proxy=proxy
            )
            if results:
                used_engine = "ddgs"
        except Exception:
            pass

    return json.dumps({
        "status": "success",
        "query": clean_query,
        "region": clean_region,
        "timelimit": clean_timelimit,
        "count": len(results),
        "engine": used_engine,
        "results": results
    }, ensure_ascii=False, indent=2)


def register_search_tool(mcp: FastMCP):
    """向 FastMCP 服务注册网络搜索工具"""
    mcp.tool()(web_search)


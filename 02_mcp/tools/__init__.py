from mcp.server.fastmcp import FastMCP

from .tts import register_tts_tool, tts_synthesize
from .search import register_search_tool, web_search
from .webpage import register_webpage_tool, fetch_webpage
from .image import register_image_tool, generate_image
from .news import register_news_tool, get_tech_news
from .weather import register_weather_tools, search_location, get_weather, get_weather_details


def register_all_tools(mcp: FastMCP):
    """一键向指定的 FastMCP 实例注册所有子工具"""
    register_tts_tool(mcp)
    register_search_tool(mcp)
    register_webpage_tool(mcp)
    register_image_tool(mcp)
    register_news_tool(mcp)
    register_weather_tools(mcp)


__all__ = [
    "register_all_tools",
    "tts_synthesize",
    "web_search",
    "fetch_webpage",
    "generate_image",
    "get_tech_news",
    "search_location",
    "get_weather",
    "get_weather_details",
    "register_tts_tool",
    "register_search_tool",
    "register_webpage_tool",
    "register_image_tool",
    "register_news_tool",
    "register_weather_tools",
]



"""
本地直接测试 02_mcp 里的各个工具逻辑，不需要启动 MCP 客户端即可单测验证。
"""
import asyncio
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from tools import (
    tts_synthesize,
    web_search,
    fetch_webpage,
    generate_image,
    get_tech_news,
    search_location,
    get_weather
)


async def main():
    print("=" * 60)
    print("1. 测试 DuckDuckGo 搜索能力:")
    search_res = web_search("DeepSeek V3", max_results=2)
    print(search_res[:300] + "...\n")

    print("=" * 60)
    print("2. 测试 Pollinations AI 生图能力:")
    img_res = generate_image("a cute cyber panda drinking coffee, 3d render", width=512, height=512)
    print(img_res + "\n")

    print("=" * 60)
    print("3. 测试 Jina Reader 网页极净提取:")
    jina_res = await fetch_webpage("https://example.com")
    print(jina_res[:200] + "...\n")

    print("=" * 60)
    print("4. 测试 Hacker News 硅谷前沿趋势:")
    news_res = await get_tech_news(limit=3)
    print(news_res + "\n")

    print("=" * 60)
    print("5. 测试微软 Edge-TTS 语音合成:")
    tts_res = await tts_synthesize("你好，海外零元能力 MCP 服务已成功部署！", voice="zh-CN-XiaoxiaoNeural")
    print(tts_res + "\n")

    print("=" * 60)
    print("6. 测试 Open-Meteo 天气预报能力:")
    weather_res = await get_weather("北京", days=1)
    print(weather_res + "\n")


if __name__ == "__main__":
    asyncio.run(main())


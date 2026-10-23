"""
天气工具本地快速测试脚本
用于验证 Open-Meteo 真实接口、参数校验、缓存生效及格式化。
"""

import asyncio
import os
import sys

# 保证 Windows 终端在打印 emoji 和中文时不触发 gbk 编码错误
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# 确保能正常引用 tools
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)


from tools.weather import get_weather, search_location


async def test_weather_tools():
    print("=" * 60)
    print("1. 测试 search_location('朝阳', count=3):")
    res1 = await search_location("朝阳", count=3)
    print(res1)
    assert "朝阳" in res1
    assert "latitude" in res1

    print("\n" + "=" * 60)
    print("2. 测试 get_weather('北京', days=1):")
    res2 = await get_weather("北京", days=1)
    print(res2)
    assert "📍 北京" in res2
    assert "当前天气:" in res2
    assert "Weather data by Open-Meteo.com" in res2

    print("\n" + "=" * 60)
    print("3. 测试 get_weather 缓存命中 (第二次查询 '北京'):")
    res2_cached = await get_weather("北京", days=1)
    assert res2 == res2_cached
    print("缓存验证通过！")

    print("\n" + "=" * 60)
    print("4. 测试 get_weather('上海', days=3) 多天预报:")
    res3 = await get_weather("上海", days=3)
    print(res3)
    assert "未来预报:" in res3

    print("\n" + "=" * 60)
    print("5. 测试不存在的地名 ('不存在的地名xyz999'):")
    res4 = await get_weather("不存在的地名xyz999")
    print(res4)
    assert "未找到地点" in res4
    assert "search_location" in res4

    print("\n" + "=" * 60)
    print("6. 测试非法参数校验 (days=10 超界):")
    res5 = await get_weather("北京", days=10)
    print(res5)
    assert "参数错误: days 必须在 1~7 之间" in res5

    print("\n" + "=" * 60)
    print("所有天气工具测试用例全部顺利通过！")


if __name__ == "__main__":
    asyncio.run(test_weather_tools())

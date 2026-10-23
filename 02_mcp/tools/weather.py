"""
Open-Meteo 天气预报与地理编码服务模块
提供 search_location 与 get_weather 两个核心工具，支持 8s 超时控制、LRU 内存缓存与标准格式化输出。
"""

import os
import sys
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Tuple
import httpx
from mcp.server.fastmcp import FastMCP

# ==========================================
# 1. 内存 LRU 缓存 (保护免费额度)
# ==========================================
class SimpleLRUCache:
    def __init__(self, max_items: int = 500):
        self.max_items = max_items
        self._cache: OrderedDict[str, Tuple[float, Any]] = OrderedDict()

    def get(self, key: str) -> Optional[Any]:
        if key not in self._cache:
            return None
        expire_at, value = self._cache[key]
        if time.time() > expire_at:
            del self._cache[key]
            return None
        self._cache.move_to_end(key)
        return value

    def set(self, key: str, value: Any, ttl_seconds: float):
        if key in self._cache:
            del self._cache[key]
        elif len(self._cache) >= self.max_items:
            self._cache.popitem(last=False)
        self._cache[key] = (time.time() + ttl_seconds, value)

    def clear(self):
        self._cache.clear()


# 地理编码缓存 24 小时，天气缓存 10 分钟
_geo_cache = SimpleLRUCache(max_items=500)
_weather_cache = SimpleLRUCache(max_items=500)


def _log(tool_name: str, duration_ms: float, hit_cache: bool, is_error: bool = False, msg: str = ""):
    """所有日志统一写入 stderr，绝对禁止写 stdout 以避免破坏 stdio 传输"""
    status = "ERROR" if is_error else "OK"
    cache_str = "CACHE_HIT" if hit_cache else "CACHE_MISS"
    log_line = f"[WeatherTool][{tool_name}] status={status} duration={duration_ms:.1f}ms {cache_str} {msg}".strip()
    try:
        print(log_line, file=sys.stderr)
    except Exception:
        pass



# ==========================================
# 2. WMO weather_code 映射表
# ==========================================
WMO_CODE_MAP = {
    0: "晴",
    1: "大部晴朗",
    2: "多云",
    3: "阴",
    45: "雾",
    48: "雾",
    51: "毛毛雨(小)",
    53: "毛毛雨(中)",
    55: "毛毛雨(大)",
    56: "冻毛毛雨",
    57: "冻毛毛雨",
    61: "雨(小)",
    63: "雨(中)",
    65: "雨(大)",
    66: "冻雨",
    67: "冻雨",
    71: "雪(小)",
    73: "雪(中)",
    75: "雪(大)",
    77: "冰粒",
    80: "阵雨(小)",
    81: "阵雨(中)",
    82: "阵雨(强)",
    85: "阵雪",
    86: "阵雪",
    95: "雷暴",
    96: "雷暴伴冰雹",
    99: "雷暴伴冰雹",
}


def get_weather_description(code: int) -> str:
    """根据 WMO 天气编码获取中文释义，未知代码兜底返回"""
    return WMO_CODE_MAP.get(code, f"未知天气(代码 {code})")


def _format_coord(lat: float, lon: float) -> str:
    """格式化经纬度，例如 39.91°N, 116.40°E"""
    lat_dir = "N" if lat >= 0 else "S"
    lon_dir = "E" if lon >= 0 else "W"
    return f"{abs(lat):.2f}°{lat_dir}, {abs(lon):.2f}°{lon_dir}"


def _get_httpx_client_kwargs(timeout_sec: float = 8.0) -> Dict[str, Any]:
    """构建统一的 httpx 客户端参数，自动识别系统网络代理与超时"""
    proxy = (
        os.environ.get("HTTPS_PROXY")
        or os.environ.get("HTTP_PROXY")
        or os.environ.get("ALL_PROXY")
    )
    kwargs: Dict[str, Any] = {
        "timeout": httpx.Timeout(timeout_sec),
        "follow_redirects": True,
        "headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 weather-mcp/1.0"
        }
    }
    if proxy:
        kwargs["proxy"] = proxy
    return kwargs


# ==========================================
# 3. 核心 API 服务封装
# ==========================================
async def fetch_geocoding(name: str, count: int = 5) -> List[Dict[str, Any]]:
    """调用 Open-Meteo 地理编码 API，返回规范化候选地点 (带一次自动重试)"""
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {
        "name": name,
        "count": count,
        "language": "zh"
    }
    client_kwargs = _get_httpx_client_kwargs(8.0)
    
    last_exc = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 429 or resp.status_code >= 500:
                    raise RuntimeError(f"天气服务暂时不可用(状态码 {resp.status_code}),请稍后重试。")
                resp.raise_for_status()
                data = resp.json()
                results = data.get("results")
                if not results:
                    return []
                
                candidates = []
                for item in results:
                    candidates.append({
                        "name": item.get("name", ""),
                        "admin1": item.get("admin1") or "",
                        "country": item.get("country") or "",
                        "latitude": item.get("latitude", 0.0),
                        "longitude": item.get("longitude", 0.0),
                    })
                return candidates
        except httpx.TimeoutException as te:
            last_exc = te
            if attempt == 0:
                continue
            raise
        except Exception:
            raise
            
    if last_exc:
        raise last_exc
    return []


async def fetch_forecast(lat: float, lon: float, days: int = 1) -> Dict[str, Any]:
    """调用 Open-Meteo 天气预报 API (带一次自动重试)"""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "forecast_days": days,
        "timezone": "auto"
    }
    client_kwargs = _get_httpx_client_kwargs(8.0)
    
    last_exc = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                resp = await client.get(url, params=params)
                if resp.status_code == 429 or resp.status_code >= 500:
                    raise RuntimeError(f"天气服务暂时不可用(状态码 {resp.status_code}),请稍后重试。")
                resp.raise_for_status()
                return resp.json()
        except httpx.TimeoutException as te:
            last_exc = te
            if attempt == 0:
                continue
            raise
        except Exception:
            raise

    if last_exc:
        raise last_exc
    return {}



# ==========================================
# 4. 工具逻辑实现
# ==========================================
async def search_location(name: str, count: int = 5) -> str:
    """按名称搜索地点,返回候选地点的名称、行政区、国家和经纬度。
    Use when: 用户给出的地名可能有重名(如“朝阳”“南京路”),需要先确认是哪一个;或 get_weather 提示未找到地点时。
    Do NOT use when: 只是想查天气且地名明确(直接调用 get_weather)。
    Returns: 候选列表 [{ name, admin1, country, latitude, longitude }],最多 count 条。
    Notes: 支持中英文地名;区县、乡镇等小地名可能搜不到。
    """
    start_time = time.time()
    clean_name = (name or "").strip()
    if not clean_name:
        _log("search_location", (time.time() - start_time) * 1000, False, is_error=True, msg="empty name")
        return "参数错误: name 不能为空且长度须在 1~100 字符之间。"
    if len(clean_name) > 100:
        _log("search_location", (time.time() - start_time) * 1000, False, is_error=True, msg="name too long")
        return "参数错误: name 长度须在 1~100 字符之间。"

    clean_count = int(count)
    if clean_count < 1 or clean_count > 10:
        _log("search_location", (time.time() - start_time) * 1000, False, is_error=True, msg="invalid count")
        return "参数错误: count 必须在 1~10 之间。"

    cache_key = f"{clean_name.lower()}__count_{clean_count}"
    cached_res = _geo_cache.get(cache_key)
    if cached_res is not None:
        _log("search_location", (time.time() - start_time) * 1000, True)
        return cached_res

    try:
        candidates = await fetch_geocoding(clean_name, count=clean_count)
        if not candidates:
            msg = f"未找到地点 '{clean_name}'。请检查拼写,或换用更大的地名(如城市名),也可调用 search_location 查看候选。"
            _log("search_location", (time.time() - start_time) * 1000, False, is_error=True, msg=f"not found: {clean_name}")
            return msg

        import json
        formatted_json = json.dumps(candidates, ensure_ascii=False, indent=2)
        _geo_cache.set(cache_key, formatted_json, ttl_seconds=86400)  # 缓存 24 小时
        _log("search_location", (time.time() - start_time) * 1000, False)
        return formatted_json

    except httpx.TimeoutException:
        err_msg = "天气服务暂时无响应,请稍后重试。"
        _log("search_location", (time.time() - start_time) * 1000, False, is_error=True, msg="timeout")
        return err_msg
    except RuntimeError as re:
        err_msg = str(re)
        _log("search_location", (time.time() - start_time) * 1000, False, is_error=True, msg=err_msg)
        return err_msg
    except Exception as e:
        err_msg = f"查询失败:{str(e)}"
        _log("search_location", (time.time() - start_time) * 1000, False, is_error=True, msg=err_msg)
        return err_msg


async def get_weather(location: str, days: int = 1) -> str:
    """查询指定城市的当前天气和未来几天预报,返回温度、体感、湿度、风速、天气状况。
    Use when: 用户询问某地当前或未来几天的天气、气温、是否下雨、是否需要带伞。
    Do NOT use when: 需要历史天气、气象预警或空气质量(本工具不支持);地名有歧义时先调用 search_location 确认。
    Returns: 文本,包含解析到的地点全称、当前天气、逐日预报(最高/最低温、天气状况、降水概率),末尾附数据来源署名。
    Notes: 地名会取搜索结果的第一个匹配项,返回中会写明实际解析到的地点,请核对是否正确;预报天数最多 7 天。
    """
    start_time = time.time()
    clean_location = (location or "").strip()
    if not clean_location:
        _log("get_weather", (time.time() - start_time) * 1000, False, is_error=True, msg="empty location")
        return "参数错误: location 不能为空且长度须在 1~100 字符之间。"
    if len(clean_location) > 100:
        _log("get_weather", (time.time() - start_time) * 1000, False, is_error=True, msg="location too long")
        return "参数错误: location 长度须在 1~100 字符之间。"

    clean_days = int(days)
    if clean_days < 1 or clean_days > 7:
        _log("get_weather", (time.time() - start_time) * 1000, False, is_error=True, msg="invalid days")
        return "参数错误: days 必须在 1~7 之间。"

    # 1. 地理编码解析 (支持 24 小时缓存)
    geo_key = f"first_loc__{clean_location.lower()}"
    target_loc = _geo_cache.get(geo_key)
    
    if target_loc is None:
        try:
            candidates = await fetch_geocoding(clean_location, count=1)
            if not candidates:
                msg = f"未找到地点 '{clean_location}'。请检查拼写,或换用更大的地名(如城市名),也可调用 search_location 查看候选。"
                _log("get_weather", (time.time() - start_time) * 1000, False, is_error=True, msg=f"geo not found: {clean_location}")
                return msg
            target_loc = candidates[0]
            _geo_cache.set(geo_key, target_loc, ttl_seconds=86400)
        except httpx.TimeoutException:
            err_msg = "天气服务暂时无响应,请稍后重试。"
            _log("get_weather", (time.time() - start_time) * 1000, False, is_error=True, msg="geo timeout")
            return err_msg
        except RuntimeError as re:
            err_msg = str(re)
            _log("get_weather", (time.time() - start_time) * 1000, False, is_error=True, msg=err_msg)
            return err_msg
        except Exception as e:
            err_msg = f"查询失败:{str(e)}"
            _log("get_weather", (time.time() - start_time) * 1000, False, is_error=True, msg=err_msg)
            return err_msg

    # 2. 天气预报查询 (支持 10 分钟缓存)
    lat = target_loc["latitude"]
    lon = target_loc["longitude"]
    weather_cache_key = f"forecast__{lat:.4f}_{lon:.4f}_{clean_days}"
    cached_forecast_text = _weather_cache.get(weather_cache_key)

    if cached_forecast_text is not None:
        _log("get_weather", (time.time() - start_time) * 1000, True)
        return cached_forecast_text

    try:
        forecast_data = await fetch_forecast(lat, lon, days=clean_days)
    except httpx.TimeoutException:
        err_msg = "天气服务暂时无响应,请稍后重试。"
        _log("get_weather", (time.time() - start_time) * 1000, False, is_error=True, msg="forecast timeout")
        return err_msg
    except RuntimeError as re:
        err_msg = str(re)
        _log("get_weather", (time.time() - start_time) * 1000, False, is_error=True, msg=err_msg)
        return err_msg
    except Exception as e:
        err_msg = f"查询失败:{str(e)}"
        _log("get_weather", (time.time() - start_time) * 1000, False, is_error=True, msg=err_msg)
        return err_msg

    # 3. 格式化输出 (按规范要求提取 units，末尾附来源署名)
    loc_parts = []
    if target_loc.get("name"):
        loc_parts.append(target_loc["name"])
    if target_loc.get("admin1") and target_loc["admin1"] != target_loc.get("name"):
        loc_parts.append(target_loc["admin1"])
    if target_loc.get("country"):
        loc_parts.append(target_loc["country"])
    loc_display = ",".join(loc_parts)
    coord_display = _format_coord(lat, lon)

    current = forecast_data.get("current", {})
    c_units = forecast_data.get("current_units", {})
    temp = current.get("temperature_2m", "N/A")
    temp_u = c_units.get("temperature_2m", "°C")
    app_temp = current.get("apparent_temperature", "N/A")
    app_temp_u = c_units.get("apparent_temperature", "°C")
    humidity = current.get("relative_humidity_2m", "N/A")
    humidity_u = c_units.get("relative_humidity_2m", "%")
    wind = current.get("wind_speed_10m", "N/A")
    wind_u = c_units.get("wind_speed_10m", "km/h")
    w_code = current.get("weather_code", 0)
    w_desc = get_weather_description(w_code)

    lines = [
        f"📍 {loc_display}({coord_display})",
        "",
        f"当前天气:{w_desc},{temp}{temp_u}(体感 {app_temp}{app_temp_u}),湿度 {humidity}{humidity_u},风速 {wind} {wind_u}",
        "",
        "未来预报:"
    ]

    daily = forecast_data.get("daily", {})
    d_units = forecast_data.get("daily_units", {})
    daily_times = daily.get("time", [])
    daily_codes = daily.get("weather_code", [])
    max_temps = daily.get("temperature_2m_max", [])
    min_temps = daily.get("temperature_2m_min", [])
    precip_probs = daily.get("precipitation_probability_max", [])
    d_temp_u = d_units.get("temperature_2m_max", "°C")
    d_precip_u = d_units.get("precipitation_probability_max", "%")

    for i in range(len(daily_times)):
        date_str = daily_times[i]
        code_val = daily_codes[i] if i < len(daily_codes) else 0
        desc_val = get_weather_description(code_val)
        max_t = max_temps[i] if i < len(max_temps) else "N/A"
        min_t = min_temps[i] if i < len(min_temps) else "N/A"
        p_prob = precip_probs[i] if (precip_probs and i < len(precip_probs) and precip_probs[i] is not None) else 0
        lines.append(f"- {date_str}:{desc_val},最高 {max_t}{d_temp_u} / 最低 {min_t}{d_temp_u},降水概率 {p_prob}{d_precip_u}")

    lines.append("")
    lines.append("Weather data by Open-Meteo.com")

    result_text = "\n".join(lines)
    _weather_cache.set(weather_cache_key, result_text, ttl_seconds=600)  # 缓存 10 分钟
    _log("get_weather", (time.time() - start_time) * 1000, False)
    return result_text


async def get_weather_details(location: str, days: int = 1) -> Dict[str, Any]:
    """查询指定城市的结构化天气数据，同时包含当前气象、逐日预报和标准 MCP 格式化文本"""
    raw_text = await get_weather(location=location, days=days)
    if "未找到地点" in raw_text or "参数错误" in raw_text or "天气服务暂时" in raw_text or "查询失败" in raw_text:
        return {"error": raw_text, "raw_text": raw_text}

    clean_location = (location or "").strip()
    geo_key = f"first_loc__{clean_location.lower()}"
    target_loc = _geo_cache.get(geo_key)
    if not target_loc:
        candidates = await fetch_geocoding(clean_location, count=1)
        if not candidates:
            return {"error": f"未找到地点 '{clean_location}'", "raw_text": raw_text}
        target_loc = candidates[0]

    lat = target_loc["latitude"]
    lon = target_loc["longitude"]
    clean_days = max(1, min(int(days), 7))
    forecast_data = await fetch_forecast(lat, lon, days=clean_days)

    current = forecast_data.get("current", {})
    c_units = forecast_data.get("current_units", {})
    daily = forecast_data.get("daily", {})
    d_units = forecast_data.get("daily_units", {})

    daily_times = daily.get("time", [])
    daily_codes = daily.get("weather_code", [])
    max_temps = daily.get("temperature_2m_max", [])
    min_temps = daily.get("temperature_2m_min", [])
    precip_probs = daily.get("precipitation_probability_max", [])

    daily_list = []
    for i in range(len(daily_times)):
        code_val = daily_codes[i] if i < len(daily_codes) else 0
        p_prob = precip_probs[i] if (precip_probs and i < len(precip_probs) and precip_probs[i] is not None) else 0
        daily_list.append({
            "date": daily_times[i],
            "weather_code": code_val,
            "weather_desc": get_weather_description(code_val),
            "temp_max": max_temps[i] if i < len(max_temps) else None,
            "temp_min": min_temps[i] if i < len(min_temps) else None,
            "precip_prob": p_prob,
        })

    w_code = current.get("weather_code", 0)
    loc_parts = []
    if target_loc.get("name"):
        loc_parts.append(target_loc["name"])
    if target_loc.get("admin1") and target_loc["admin1"] != target_loc.get("name"):
        loc_parts.append(target_loc["admin1"])
    if target_loc.get("country"):
        loc_parts.append(target_loc["country"])

    return {
        "location": {
            "name": target_loc.get("name", clean_location),
            "admin1": target_loc.get("admin1", ""),
            "country": target_loc.get("country", ""),
            "latitude": lat,
            "longitude": lon,
            "display": ",".join(loc_parts),
            "coord_display": _format_coord(lat, lon)
        },
        "current": {
            "temperature": current.get("temperature_2m"),
            "temperature_unit": c_units.get("temperature_2m", "°C"),
            "apparent_temperature": current.get("apparent_temperature"),
            "apparent_temperature_unit": c_units.get("apparent_temperature", "°C"),
            "relative_humidity": current.get("relative_humidity_2m"),
            "relative_humidity_unit": c_units.get("relative_humidity_2m", "%"),
            "wind_speed": current.get("wind_speed_10m"),
            "wind_speed_unit": c_units.get("wind_speed_10m", "km/h"),
            "weather_code": w_code,
            "weather_desc": get_weather_description(w_code),
        },
        "units": {
            "temp": c_units.get("temperature_2m", "°C"),
            "humidity": c_units.get("relative_humidity_2m", "%"),
            "wind": c_units.get("wind_speed_10m", "km/h"),
            "precip": d_units.get("precipitation_probability_max", "%")
        },
        "daily": daily_list,
        "raw_text": raw_text,
        "attribution": "Weather data by Open-Meteo.com"
    }


# ==========================================
# 5. 向 FastMCP 服务注册工具
# ==========================================
def register_weather_tools(mcp: FastMCP):
    """向 FastMCP 服务注册 search_location 与 get_weather 工具"""
    mcp.tool(name="search_location")(search_location)
    mcp.tool(name="get_weather")(get_weather)


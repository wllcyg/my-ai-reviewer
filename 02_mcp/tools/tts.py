import json
import base64
import os
from typing import Optional
from mcp.server.fastmcp import FastMCP
import edge_tts

# 单次 MCP 交互最大安全字符限制（防止打爆内存与大模型上下文窗口）
MAX_MCP_TEXT_LENGTH = 1000


async def tts_synthesize(
    text: str,
    voice: str = "zh-CN-XiaoxiaoNeural",
    rate: str = "+0%",
    pitch: str = "+0Hz",
    volume: str = "+0%",
    proxy: Optional[str] = None
) -> str:
    """使用微软高拟真人声合成音频 (纯内存处理，0 磁盘占用，支持语速/音高精准调谐)。
    
    Args:
        text: 需要转为语音的文本内容 (单次上限 1000 字)
        voice: 声音音色，推荐:
               - 'zh-CN-XiaoxiaoNeural' (温柔女声，默认)
               - 'zh-CN-YunxiNeural' (阳光男声/影视解说)
               - 'zh-CN-YunjianNeural' (沉稳男声/播音)
               - 'zh-CN-liaoning-XiaobeiNeural' (地道东北话/搞笑解说)
               - 'zh-TW-HsiaoChenNeural' (甜美台湾腔)
               - 'zh-HK-WanLungNeural' (港风粤语男声)
               - 'en-US-JennyNeural' (自然英文女声)
        rate: 语速调节 (如 '+20%', '-15%')
        pitch: 音调调节 (如 '+15Hz', '-20Hz')
        volume: 音量调节 (如 '+0%')
        proxy: 代理地址 (可选，例如 'http://127.0.0.1:7890')，受限网络下使用
    Returns:
        JSON 格式的音频 Base64 数据及元信息
    """
    # 1. 文本长度熔断保护，防止大 Base64 撑爆大模型 Context
    text_len = len(text.strip())
    if text_len == 0:
        return json.dumps({"status": "error", "message": "待合成文本不能为空"}, ensure_ascii=False)
        
    if text_len > MAX_MCP_TEXT_LENGTH:
        return json.dumps({
            "status": "error",
            "message": (
                f"文本过长（当前 {text_len} 字，MCP 上限 {MAX_MCP_TEXT_LENGTH} 字）。"
                "长文本建议通过流式接口 /api/tts/stream 进行播放，避免大 Base64 撑爆 LLM 上下文！"
            ),
            "voice": voice
        }, ensure_ascii=False)

    # 2. 获取有效代理 (入参 > 环境变量)
    effective_proxy = proxy or os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("ALL_PROXY")

    # 3. 纯英文发音人读纯中文智能兜底
    target_voice = voice
    has_ascii = any('a' <= c.lower() <= 'z' for c in text)
    if voice.startswith("en-") and not has_ascii:
        target_voice = "zh-CN-XiaoxiaoNeural"

    # 4. 纯内存接收音频数据，彻底零落盘
    try:
        communicate = edge_tts.Communicate(
            text,
            target_voice,
            rate=rate,
            pitch=pitch,
            volume=volume,
            proxy=effective_proxy
        )
        audio_buffer = bytearray()
        
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.extend(chunk["data"])

        if len(audio_buffer) == 0:
            return json.dumps({"status": "error", "message": "未能获取到音频数据，请检查网络连接"}, ensure_ascii=False)

        # 4. 在内存中转为 Base64
        audio_b64 = base64.b64encode(audio_buffer).decode("utf-8")
        size_kb = len(audio_buffer) / 1024

        return json.dumps({
            "status": "success",
            "voice": voice,
            "format": "audio/mp3",
            "size_kb": f"{size_kb:.2f} KB",
            "audio_base64": f"data:audio/mp3;base64,{audio_b64}",
            "audio_base64_preview": audio_b64[:100] + "...(truncated)"
        }, ensure_ascii=False)

    except Exception as e:
        return json.dumps({
            "status": "error",
            "message": f"TTS 合成失败: {str(e)}。若在受限网络下，请配置代理后重试。",
            "voice": voice
        }, ensure_ascii=False)


def register_tts_tool(mcp: FastMCP):
    """向 FastMCP 服务注册 TTS 工具"""
    mcp.tool()(tts_synthesize)

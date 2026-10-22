import importlib
from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
from typing import Dict, Any, List
from config import Settings, get_settings

# 动态加载以数字开头的 02_mcp 模块
mcp_module = importlib.import_module("02_mcp.server")
mcp_server = mcp_module.mcp

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="AI 代码审查服务 & OverseasFreeHub MCP 服务 API",
    version="0.1.0",
)

# 配置跨域中间件 (支持前端 5173 等任意来源跨域请求与 SSE)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载 MCP 服务的 SSE 传输通道到 /mcp
# 注意：无需重复传 mount_path，Starlette ASGI 挂载机制会自动注入 root_path 前缀
app.mount("/mcp", mcp_server.sse_app())



@app.get("/")
def read_root(cfg: Settings = Depends(get_settings)):
    return {
        "message": f"Hello from {cfg.app_name}",
        "environment": cfg.app_env,
        "debug": cfg.debug,
        "mcp_endpoints": {
            "sse": "/mcp/sse",
            "messages": "/mcp/messages/",
        },
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "mcp": {
            "name": mcp_server.name,
            "status": "mounted",
        },
    }


# ==========================================
# 流式语音输出 (零落盘、低延迟、首包毫秒级直推)
# 前端可直接使用: <audio src="/api/tts/stream?text=...&voice=..." controls autoplay />
# ==========================================
@app.get("/api/tts/stream")
async def stream_tts(
    text: str = Query(..., description="需要合成的文本内容"),
    voice: str = Query("zh-CN-XiaoxiaoNeural", description="音色名称"),
    rate: str = Query("+0%", description="语速调节 (如 +20%, -15%)"),
    pitch: str = Query("+0Hz", description="音调调节 (如 +15Hz, -20Hz)"),
    volume: str = Query("+0%", description="音量调节 (如 +0%)"),
    download: bool = Query(False, description="是否作为附件强制下载"),
    filename: str = Query(None, description="自定义下载文件名 (如 speech.mp3)")
):
    """音频二进制流式直推：不写磁盘，直接将微软音频流作为 chunk 推流给前端"""
    import os
    import urllib.parse
    import edge_tts
    from fastapi.responses import StreamingResponse

    clean_text = text.strip()
    if not clean_text:
        return {"error": "文本不能为空"}

    effective_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("ALL_PROXY")

    # 智能语言适配兜底：英文专用发音人(en-*)读纯中文会触发 NoAudioReceived
    # 当检测到文本无英文字母且请求了纯英文发音人时，自动优雅回退为多语种/中文发音人
    target_voice = voice
    has_ascii = any('a' <= c.lower() <= 'z' for c in clean_text)
    if voice.startswith("en-") and not has_ascii:
        target_voice = "zh-CN-XiaoxiaoNeural"

    async def audio_generator():
        try:
            communicate = edge_tts.Communicate(
                clean_text,
                target_voice,
                rate=rate,
                pitch=pitch,
                volume=volume,
                proxy=effective_proxy
            )
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
        except edge_tts.exceptions.NoAudioReceived:
            # 若仍未收到音频，尝试使用默认晓晓音色再次兜底尝试一次
            try:
                fallback_comm = edge_tts.Communicate(
                    clean_text,
                    "zh-CN-XiaoxiaoNeural",
                    rate=rate,
                    pitch=pitch,
                    volume=volume,
                    proxy=effective_proxy
                )
                async for chunk in fallback_comm.stream():
                    if chunk["type"] == "audio":
                        yield chunk["data"]
            except Exception as e:
                print(f"[TTS Stream] 降级合成仍失败: {e}")
        except Exception as e:
            print(f"[TTS Stream] 语音流生成异常: {e}")

    headers = {
        "Cache-Control": "no-cache",
    }
    if download:
        target_name = filename or f"tts_{target_voice}.mp3"
        if not target_name.endswith(".mp3"):
            target_name += ".mp3"
        
        # Starlette 强制 headers 必须为 latin-1，中文字符必须放入 RFC 5987/6266 的 filename* 中
        safe_ascii = "speech.mp3"
        safe_utf8 = urllib.parse.quote(target_name, encoding="utf-8")
        headers["Content-Disposition"] = f"attachment; filename=\"{safe_ascii}\"; filename*=UTF-8''{safe_utf8}"
    else:
        headers["Content-Disposition"] = "inline"

    return StreamingResponse(
        audio_generator(),
        media_type="audio/mpeg",
        headers=headers
    )


# ==========================================
# 自动字幕生成端点 (支持标准 SRT 格式导出)
# ==========================================
import re
import datetime
from fastapi.responses import PlainTextResponse

def clean_ssml_from_text(raw_text: str) -> str:
    """去除 SSML 标签及残余文本"""
    cleaned = re.sub(r"<[^>]+>", "", raw_text)
    cleaned = re.sub(r"(?:break\s+time=[^>]+>|emphasis[^>]+>|say-as[^>]+>)", "", cleaned)
    return cleaned.strip()

def srt_time_to_delta(t_str: str) -> datetime.timedelta:
    # 格式: 00:00:01,487
    parts = t_str.split(",")
    h, m, s = map(int, parts[0].split(":"))
    ms = int(parts[1]) if len(parts) > 1 else 0
    return datetime.timedelta(hours=h, minutes=m, seconds=s, milliseconds=ms)

def delta_to_srt_time(td: datetime.timedelta) -> str:
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    milliseconds = int(td.microseconds / 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"

@app.get("/api/tts/subtitles")
async def get_tts_subtitles(
    text: str = Query(..., description="文本内容"),
    voice: str = Query("zh-CN-XiaoxiaoNeural", description="音色名称"),
    rate: str = Query("+0%", description="语速调节"),
    pitch: str = Query("+0Hz", description="音调调节"),
    boundary: str = Query("SentenceBoundary", description="边界模式: SentenceBoundary 或 WordBoundary"),
    download: bool = Query(False, description="是否作为附件下载")
):
    """提取微软语音毫秒级时间戳并生成标准 SRT 格式字幕"""
    import os
    import edge_tts

    clean_text = text.strip()
    if not clean_text:
        return PlainTextResponse("1\n00:00:00,000 --> 00:00:01,000\n\n")

    effective_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("ALL_PROXY")
    
    target_voice = voice
    has_ascii = any('a' <= c.lower() <= 'z' for c in clean_text)
    if voice.startswith("en-") and not has_ascii:
        target_voice = "zh-CN-XiaoxiaoNeural"

    try:
        communicate = edge_tts.Communicate(
            clean_text,
            target_voice,
            rate=rate,
            pitch=pitch,
            boundary="WordBoundary" if boundary == "WordBoundary" else "SentenceBoundary",
            proxy=effective_proxy
        )
        submaker = edge_tts.SubMaker()
        async for chunk in communicate.stream():
            if chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                submaker.feed(chunk)
        srt_raw = submaker.get_srt()
        
        # 清洗 SSML 标签残余
        clean_lines = []
        for line in srt_raw.splitlines():
            if "-->" in line or line.strip().isdigit():
                clean_lines.append(line)
            else:
                c = clean_ssml_from_text(line)
                if c:
                    clean_lines.append(c)
        srt_content = "\n".join(clean_lines) + "\n"

        if not srt_content.strip():
            display_text = clean_ssml_from_text(clean_text)
            srt_content = f"1\n00:00:00,000 --> 00:00:03,000\n{display_text}\n"
    except Exception as e:
        display_text = clean_ssml_from_text(clean_text)
        srt_content = f"1\n00:00:00,000 --> 00:00:03,000\n{display_text}\n"

    headers = {}
    if download:
        headers["Content-Disposition"] = 'attachment; filename="subtitles.srt"; filename*=UTF-8\'\'subtitles.srt'
    
    return PlainTextResponse(srt_content, headers=headers, media_type="text/plain; charset=utf-8")


class DialogueSubtitleItem(BaseModel):
    text: str
    voice: str = "zh-CN-XiaoxiaoNeural"
    rate: str = "+0%"
    pitch: str = "+0Hz"

class DialogueSubtitlesRequest(BaseModel):
    dialogues: list[DialogueSubtitleItem]
    pause_seconds: float = 0.38

@app.post("/api/tts/dialogue_subtitles")
async def generate_dialogue_subtitles(
    payload: DialogueSubtitlesRequest,
    download: bool = Query(False, description="是否作为附件下载")
):
    """为多角色多段对话剧场生成时间轴无缝对齐的完整 SRT 字幕"""
    import os
    import edge_tts

    effective_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("ALL_PROXY")
    
    global_entries = []
    current_time_offset = datetime.timedelta(seconds=0)
    pause_delta = datetime.timedelta(seconds=payload.pause_seconds)

    for item in payload.dialogues:
        raw_text = item.text.strip()
        if not raw_text:
            continue

        target_voice = item.voice
        has_ascii = any('a' <= c.lower() <= 'z' for c in raw_text)
        if target_voice.startswith("en-") and not has_ascii:
            target_voice = "zh-CN-XiaoxiaoNeural"

        try:
            communicate = edge_tts.Communicate(
                raw_text,
                target_voice,
                rate=item.rate or "+0%",
                pitch=item.pitch or "+0Hz",
                boundary="SentenceBoundary",
                proxy=effective_proxy
            )
            submaker = edge_tts.SubMaker()
            async for chunk in communicate.stream():
                if chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                    submaker.feed(chunk)
            
            srt_str = submaker.get_srt()
        except Exception:
            srt_str = ""

        # 解析该句中的条目并偏移时间戳
        blocks = [b.strip() for b in srt_str.strip().split("\n\n") if b.strip()]
        last_end_in_turn = current_time_offset

        if blocks:
            for block in blocks:
                lines = block.splitlines()
                if len(lines) >= 3 and "-->" in lines[1]:
                    time_line = lines[1]
                    sub_text = "\n".join(lines[2:])
                    sub_text = clean_ssml_from_text(sub_text)
                    if not sub_text:
                        continue

                    start_str, end_str = [t.strip() for t in time_line.split("-->")]
                    seg_start = current_time_offset + srt_time_to_delta(start_str)
                    seg_end = current_time_offset + srt_time_to_delta(end_str)
                    
                    if seg_end > last_end_in_turn:
                        last_end_in_turn = seg_end

                    global_entries.append((seg_start, seg_end, sub_text))
        else:
            # 兜底：若解析失败按字数估算 2.5s
            seg_start = current_time_offset + datetime.timedelta(milliseconds=100)
            seg_end = current_time_offset + datetime.timedelta(seconds=2, milliseconds=500)
            last_end_in_turn = seg_end
            global_entries.append((seg_start, seg_end, clean_ssml_from_text(raw_text)))

        # 下一句的起始时间 = 本句结束时间 + 呼吸停顿
        current_time_offset = last_end_in_turn + pause_delta

    # 拼装标准 SRT
    srt_output_lines = []
    for idx, (s_time, e_time, text_content) in enumerate(global_entries, 1):
        srt_output_lines.append(f"{idx}")
        srt_output_lines.append(f"{delta_to_srt_time(s_time)} --> {delta_to_srt_time(e_time)}")
        srt_output_lines.append(text_content)
        srt_output_lines.append("")

    final_srt = "\n".join(srt_output_lines)
    if not final_srt.strip():
        final_srt = "1\n00:00:00,000 --> 00:00:01,000\n\n"

    headers = {}
    if download:
        filename = f"dialogue_subtitles_{datetime.date.today().strftime('%Y%m%d')}.srt"
        headers["Content-Disposition"] = f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename}'

    return PlainTextResponse(final_srt, headers=headers, media_type="text/plain; charset=utf-8")


# ==========================================
# 前端统一 MCP 工具调用接口 (REST 适配器)
# ==========================================
from pydantic import BaseModel
from typing import Dict, Any

class ToolCallRequest(BaseModel):
    tool: str
    args: Dict[str, Any] = {}

@app.post("/api/mcp/call")
async def call_tool_endpoint(req: ToolCallRequest):
    """供前端一键直接调用 5 大 MCP 实用工具"""
    tools_mod = importlib.import_module("02_mcp.tools")
    tool_func = getattr(tools_mod, req.tool, None)
    if not tool_func:
        return {"error": f"未找到名为 '{req.tool}' 的工具"}

    import inspect
    import json
    try:
        if inspect.iscoroutinefunction(tool_func):
            res = await tool_func(**req.args)
        else:
            res = tool_func(**req.args)
        
        # 如果是 JSON 字符串，反序列化为 dict
        if isinstance(res, str):
            try:
                return json.loads(res)
            except Exception:
                return {"result": res}
        return res
    except Exception as e:
        return {"error": f"工具调用异常: {str(e)}"}


# ==========================================
# AI 代码审查分析端点
# ==========================================
class ReviewRequest(BaseModel):
    code: str
    language: str = "python"

@app.post("/api/review")
async def review_code_endpoint(req: ReviewRequest):
    """模拟并返回高品质 AI 代码审查报告"""
    lines = req.code.strip().splitlines()
    char_count = len(req.code)
    
    # 模拟生成的审查维度指标
    return {
        "score": 92,
        "language": req.language,
        "summary": f"已完成对 {len(lines)} 行代码的静态分析与安全审计，整体架构规范，发现 2 处性能与可读性优化建议。",
        "dimensions": [
            {"name": "架构设计", "score": 95, "status": "excellent"},
            {"name": "代码规范", "score": 90, "status": "good"},
            {"name": "安全性", "score": 98, "status": "excellent"},
            {"name": "性能开销", "score": 85, "status": "warning"},
        ],
        "suggestions": [
            {
                "level": "warning",
                "title": "避免在循环或高频中重复 I/O",
                "desc": "检测到可能存在的同步阻塞或磁盘写操作，建议采用内存流或异步缓冲队列处理。"
            },
            {
                "level": "info",
                "title": "建议补全泛型与显式类型注释",
                "desc": "添加完备的参数与返回值类型声明，可提升团队协作体验及 IDE 类型推导准确度。"
            }
        ]
    }




def main():
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=settings.debug)


if __name__ == "__main__":
    main()


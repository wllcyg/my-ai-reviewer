import importlib
from fastapi import FastAPI, Depends
import uvicorn
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
    voice: str = Query("zh-CN-XiaoxiaoNeural", description="音色名称")
):
    """音频二进制流式直推：不写磁盘，直接将微软音频流作为 chunk 推流给前端"""
    import os
    import edge_tts
    from fastapi.responses import StreamingResponse

    clean_text = text.strip()
    if not clean_text:
        return {"error": "文本不能为空"}

    effective_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("ALL_PROXY")
    communicate = edge_tts.Communicate(clean_text, voice, proxy=effective_proxy)

    async def audio_generator():
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                yield chunk["data"]

    return StreamingResponse(
        audio_generator(),
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "no-cache",
            "Content-Disposition": "inline",
        }
    )


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
    uvicorn.run("main:app", host="127.0.0.1", port=settings.port, reload=settings.debug)


if __name__ == "__main__":
    main()


"""
02_mcp: 轻量实用的 MCP 服务
聚合 5 大高性价比/零成本能力，支持本地 stdio 与远程 sse 双模式运行，已模块化拆分至 tools/ 目录。
"""

import os
from pathlib import Path
from mcp.server.fastmcp import FastMCP
from .tools import register_all_tools

# 实例化 FastMCP 服务
mcp = FastMCP("OverseasFreeHub", dependencies=["edge-tts", "duckduckgo-search", "httpx"])

# 临时文件存放目录
TEMP_DIR = Path(__file__).parent / "output"
TEMP_DIR.mkdir(exist_ok=True)

# 注册所有已模块化拆分的工具
register_all_tools(mcp)


# ==========================================
# 独立启动入口
# ==========================================
if __name__ == "__main__":
    import sys
    # 如果指定了 --sse 参数，则启动 HTTP SSE 远程服务器模式
    if "--sse" in sys.argv:
        port = int(os.environ.get("PORT", 8000))
        print(f"[OverseasFreeHub] 启动 SSE 模式，监听端口: {port}")
        mcp.run(transport="sse")
    else:
        # 默认使用 stdio 模式，供 Cursor / Claude 命令行直接拉起
        mcp.run(transport="stdio")

import json
import urllib.parse
from mcp.server.fastmcp import FastMCP


def generate_image(prompt: str, width: int = 1024, height: int = 1024, model: str = "flux") -> str:
    """根据英文或中文提示词快速生成图片，无需充值，秒级出图。
    
    Args:
        prompt: 图像描述词 (英文效果更佳，例如 'minimal modern 3d glass icon, tech style')
        width: 宽度，默认 1024
        height: 高度，默认 1024
        model: 模型选择，默认 'flux' (也可选 'turbo')
    Returns:
        生成的图片公网直链 URL 及 Markdown 预览代码
    """
    encoded_prompt = urllib.parse.quote(prompt)
    image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width={width}&height={height}&model={model}&nologo=true"
    
    return json.dumps({
        "status": "success",
        "prompt": prompt,
        "image_url": image_url,
        "markdown": f"![{prompt}]({image_url})"
    }, ensure_ascii=False)


def register_image_tool(mcp: FastMCP):
    """向 FastMCP 服务注册生图工具"""
    mcp.tool()(generate_image)

import json
import os
import random
import urllib.parse
from typing import Any, Dict, Optional
import httpx
from mcp.server.fastmcp import FastMCP

# 风格提示词修饰增强字典（强化超清锐利细节）
STYLE_PRESETS = {
    "realistic": ", 8k resolution, photorealistic, highly detailed, sharp focus, professional photography, studio lighting, ultra high quality, 8k uhd",
    "3d-glass": ", modern 3d glassmorphism render, octane render, sharp edges, smooth transparent glass, vibrant gradient refraction, crisp 8k",
    "cyberpunk": ", cyberpunk aesthetic, ultra sharp neon glowing lights, volumetric smoke, high tech city, futuristic, octane 3d render, 8k",
    "anime": ", makoto shinkai anime style, ultra detailed, crisp lines, vibrant colors, studio ghibli lighting, masterpiece, 4k",
    "ink": ", traditional chinese ink wash painting, shan shui style, artistic brush strokes, elegant, watercolor on rice paper, high resolution",
    "clay": ", cute stop-motion claymation, sharp plasticine texture, soft studio lighting, tilt-shift photography, miniature scene",
}


def _generate_cloudflare_flux(
    prompt: str,
    account_id: str,
    api_token: str,
    steps: int = 8
) -> Optional[str]:
    """通过 Cloudflare Workers AI 原生运行 FLUX.1 Schnell 模型生成图片 Base64 (使用 8 步满血极清模式)"""
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/black-forest-labs/flux-1-schnell"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    # 追加全局清晰度词保障画面锐利
    clarity_prompt = f"{prompt}, highly detailed, sharp focus, 8k uhd, masterpiece"
    payload = {
        "prompt": clarity_prompt,
        "steps": max(4, min(steps, 8))
    }
    effective_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or os.environ.get("ALL_PROXY")
    client_kwargs: Dict[str, Any] = {"timeout": 45.0, "headers": headers}
    if effective_proxy:
        client_kwargs["proxy"] = effective_proxy

    with httpx.Client(**client_kwargs) as client:
        resp = client.post(url, json=payload)
        if resp.status_code == 200:
            data = resp.json()
            result = data.get("result", {})
            b64_image = result.get("image")
            if b64_image:
                return f"data:image/jpeg;base64,{b64_image}"
    return None


def generate_image(
    prompt: str,
    width: int = 1024,
    height: int = 1024,
    model: str = "flux",
    seed: Optional[int] = None,
    style: Optional[str] = None
) -> str:
    """根据英文或中文提示词快速生成高质图片，支持 Cloudflare Workers AI 极速直连与 Pollinations 备用降级。
    
    Args:
        prompt: 图像描述词 (例如 'cybernetic kitten with glowing blue visor')
        width: 宽度，默认 1024
        height: 高度，默认 1024
        model: 模型选择，默认 'flux'
        seed: 随机种子 (整数)，留空则自动随机生成
        style: 预设风格修饰 ('realistic', '3d-glass', 'cyberpunk', 'anime', 'ink', 'clay')
    Returns:
        JSON 格式的生图结果 (包含 image_url, seed, enhanced_prompt, engine 等)
    """
    clean_prompt = prompt.strip()
    if not clean_prompt:
        return json.dumps({"status": "error", "error": "提示词不能为空"}, ensure_ascii=False)

    effective_seed = seed if seed is not None and seed > 0 else random.randint(100000, 999999)
    clean_model = model if model in ("flux", "turbo") else "flux"

    # 注入风格增强词
    enhanced_prompt = clean_prompt
    if style and style in STYLE_PRESETS:
        enhanced_prompt = clean_prompt + STYLE_PRESETS[style]

    cf_account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    cf_api_token = os.environ.get("CLOUDFLARE_API_TOKEN")

    image_url = None
    used_engine = "pollinations"

    # 1. 优先使用 Cloudflare Workers AI（企业级、零等待、免受 45s 限频影响）
    if cf_account_id and cf_api_token:
        try:
            cf_b64 = _generate_cloudflare_flux(enhanced_prompt, cf_account_id, cf_api_token, steps=4)
            if cf_b64:
                image_url = cf_b64
                used_engine = "cloudflare-workers-ai"
        except Exception:
            pass

    # 2. 备用通道：Pollinations 社区公共免费通道
    if not image_url:
        encoded_prompt = urllib.parse.quote(enhanced_prompt)
        image_url = (
            f"https://image.pollinations.ai/prompt/{encoded_prompt}"
            f"?width={width}&height={height}&model={clean_model}&seed={effective_seed}&nologo=true&safe=true"
        )
        used_engine = "pollinations-public"

    return json.dumps({
        "status": "success",
        "prompt": clean_prompt,
        "enhanced_prompt": enhanced_prompt,
        "seed": effective_seed,
        "model": "flux-1-schnell" if used_engine == "cloudflare-workers-ai" else clean_model,
        "width": width,
        "height": height,
        "style": style or "none",
        "engine": used_engine,
        "image_url": image_url,
        "markdown": f"![{clean_prompt}]({image_url})"
    }, ensure_ascii=False, indent=2)


def register_image_tool(mcp: FastMCP):
    """向 FastMCP 服务注册生图工具"""
    mcp.tool()(generate_image)



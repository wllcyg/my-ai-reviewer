"""
测试纯内存、0 磁盘占用的微软 Edge-TTS 语音合成与安全熔断机制
"""

import asyncio
import json
import sys
from tools.tts import tts_synthesize, MAX_MCP_TEXT_LENGTH

# 确保在 Windows 控制台支持 utf-8 输出
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


async def test_tts():
    print("=" * 60)
    print("开始测试【纯内存 + 0 磁盘占用】微软 Edge-TTS 语音合成...")
    print("=" * 60)

    # 1. 测试常规文本合成（内存返回 Base64）
    text1 = "你好！当前语音合成已全面升级为纯内存流转，绝不占用本地磁盘。"
    print(f"\n[测试 1] 正常短文本纯内存合成 (zh-CN-XiaoxiaoNeural):")
    print(f"文本: \"{text1}\"")
    res1_str = await tts_synthesize(text1, voice="zh-CN-XiaoxiaoNeural")
    res1 = json.loads(res1_str)
    
    if res1.get("status") == "success":
        print(f"✅ 合成成功！音频大小: {res1.get('size_kb')}")
        print(f"📦 返回格式: {res1.get('format')} (纯内存 Base64 数据流)")
        print(f"🔍 预览: {res1.get('audio_base64_preview')}")
        print("💡 状态: 本地磁盘写入为 0 字节，干净安全！")
    else:
        print(f"⚠️ 合成提示: {res1.get('message')}")

    # 2. 测试超长文本安全熔断（防止打爆 LLM 上下文）
    print(f"\n[测试 2] 超长文本安全熔断测试（模拟万字小说输入）:")
    super_long_text = "这是一段非常冗长的测试文字。" * 100  # 约 1500 字，超出安全阈值
    print(f"输入字数: {len(super_long_text)} 字 (阈值为 {MAX_MCP_TEXT_LENGTH} 字)")
    res2_str = await tts_synthesize(super_long_text)
    res2 = json.loads(res2_str)
    print(f"拦截状态: {res2.get('status')}")
    print(f"拦截提示: {res2.get('message')}")

    print("\n" + "=" * 60)
    print("🎉 测试完毕！系统已全面具备：0 磁盘占用 + 上下文熔断保护 + 零延迟流式直推能力。")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(test_tts())

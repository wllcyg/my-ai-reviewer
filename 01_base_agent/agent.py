import json
import sys
from pathlib import Path

# 确保项目根目录与当前脚本所在目录都在搜索路径中
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR.parent))
sys.path.insert(0, str(CURRENT_DIR))

from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt

from config import get_settings
from core.client import get_client
from core.tools import WorkspaceFileTools
from prompts import DEMO_USER_PROMPT, SYSTEM_PROMPT

# 初始化 Rich 控制台
console = Console()
client = get_client()
tools = WorkspaceFileTools(".")


def run_agent(user_query: str, max_turns: int = 30):
    """
    Agent 主循环：思考(Thought) -> 行动(Action/Tool) -> 观察(Observation) -> 再思考 -> 回答
    """
    console.print()
    console.print(Panel(user_query, title="[bold cyan]👤 用户提问[/bold cyan]", border_style="cyan"))

    # 构建初始对话上下文
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_query},
    ]

    turn = 0
    while turn < max_turns:
        turn += 1
        console.rule(f"[bold blue]第 {turn} 轮思考[/bold blue]")

        # 1. 发起大模型流式请求
        response_stream = client.chat.completions.create(
            model=get_settings().model_name,
            messages=messages,
            tools=tools.get_openai_tool_definitions(),
            stream=True,
        )

        collected_content = []
        collected_tool_calls = {}  # 结构: index -> {"id": ..., "type": "function", "function": {"name": ..., "arguments": ...}}
        has_printed_reply_header = False
        has_printed_reasoning_header = False

        # 实时消费流式数据块
        for chunk in response_stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta

            # 1.1 深度推理思维链 (DeepSeek-R1 / o1 等模型的 reasoning_content)
            if hasattr(delta, "reasoning_content") and delta.reasoning_content:
                if not has_printed_reasoning_header:
                    console.print("\n[dim bold]🧠 思维推演中:[/dim bold]")
                    has_printed_reasoning_header = True
                console.print(delta.reasoning_content, end="", style="dim", markup=False)

            # 1.2 普通文本回复 (打字机效果实时逐字流式输出)
            if delta.content:
                if has_printed_reasoning_header:
                    console.print("\n")
                    has_printed_reasoning_header = False

                if not has_printed_reply_header:
                    console.print("\n[bold green]💬 Agent 回复:[/bold green]\n")
                    has_printed_reply_header = True

                console.print(delta.content, end="", style="green", markup=False)
                collected_content.append(delta.content)

            # 1.3 收集工具调用切片 (Tool Call 碎片拼装)
            if delta.tool_calls:
                for tc_delta in delta.tool_calls:
                    idx = tc_delta.index
                    if idx not in collected_tool_calls:
                        collected_tool_calls[idx] = {
                            "id": tc_delta.id or "",
                            "type": "function",
                            "function": {
                                "name": tc_delta.function.name or "",
                                "arguments": "",
                            },
                        }
                    if tc_delta.id:
                        collected_tool_calls[idx]["id"] = tc_delta.id
                    if tc_delta.function and tc_delta.function.name:
                        collected_tool_calls[idx]["function"]["name"] = tc_delta.function.name
                    if tc_delta.function and tc_delta.function.arguments:
                        collected_tool_calls[idx]["function"]["arguments"] += tc_delta.function.arguments

        # 换行收尾
        if has_printed_reasoning_header:
            console.print()
        if has_printed_reply_header:
            console.print("\n")

        # 构造完整的大模型助手消息并存入历史上下文
        full_content = "".join(collected_content) if collected_content else None
        final_tool_calls = list(collected_tool_calls.values()) if collected_tool_calls else None

        assistant_message = {
            "role": "assistant",
            "content": full_content,
        }
        if final_tool_calls:
            assistant_message["tool_calls"] = final_tool_calls

        messages.append(assistant_message)

        # 2. 判断是否触发了工具调用
        if final_tool_calls:
            console.print(f"[bold yellow]🤖 [模型决定调用 {len(final_tool_calls)} 个工具][/bold yellow]")
            for tool_call in final_tool_calls:
                func_name = tool_call["function"]["name"]
                args_str = tool_call["function"]["arguments"]
                try:
                    func_args = json.loads(args_str) if args_str else {}
                except json.JSONDecodeError:
                    func_args = {"raw_arguments": args_str}

                console.print(f"  🛠️  [yellow]执行工具:[/yellow] [bold white]{func_name}[/bold white]")
                # 美化打印 JSON 格式入参
                console.print_json(json.dumps(func_args, ensure_ascii=False))

                # 3. 实际执行工具获取观察结果
                tool_result = tools.execute_tool(func_name, func_args)
                tool_result_str = str(tool_result)

                # 内容过长时进行折叠预览
                preview = (
                    tool_result_str[:400] + "\n[dim]... (内容较长，已省略显示剩余字符) ...[/dim]"
                    if len(tool_result_str) > 400
                    else tool_result_str
                )
                console.print(
                    Panel(
                        preview,
                        title=f"[magenta]📥 工具返回: {func_name}[/magenta]",
                        border_style="magenta",
                        expand=False,
                    )
                )

                # 4. 把工具执行结果追加回上下文（role 为 tool，必须对应 tool_call_id）
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "content": tool_result_str,
                    }
                )
            # 拿到工具结果后，继续循环，让模型重新思考
            continue
        else:
            # 5. 没有工具调用，且流式回答已直接展示完毕，任务圆满结束
            console.print("[bold green]✨ [任务处理完成][/bold green]\n")
            break
    else:
        console.print("[bold red]⚠️ 达到最大思考轮次限制，结束任务。[/bold red]\n")


def main():
    console.print(
        Panel(
            "[bold cyan]✨ 欢迎使用 AI Agent 智能交互终端 ✨[/bold cyan]\n"
            "[dim]• 直接输入提示词回车即可执行\n"
            "• 直接按回车将使用默认示例提示词\n"
            "• 输入 'exit' 或 'q' 退出程序[/dim]",
            border_style="bright_blue",
        )
    )

    while True:
        try:
            prompt_input = Prompt.ask(
                "[bold yellow]请输入提示词[/bold yellow]",
                default=DEMO_USER_PROMPT,
                show_default=False,
            ).strip()

            if prompt_input.lower() in ("exit", "quit", "q"):
                console.print("[bold red]👋 已退出程序。[/bold red]")
                break

            run_agent(prompt_input)

        except KeyboardInterrupt:
            console.print("\n[bold red]🛑 检测到中断信号 (Ctrl+C)，已退出。[/bold red]")
            break
        except Exception as e:
            console.print(f"\n[bold red]❌ 运行出错: {e}[/bold red]\n")


if __name__ == "__main__":
    main()


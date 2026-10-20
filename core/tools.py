import os
import queue
import re
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict, List

# 匹配 cd 命令（如 "cd xxx"、"cd ..", "&& cd ", "; cd " 等），不区分大小写
CD_PATTERN = re.compile(r'(?:^|[;&|]\s*)cd(?:\s+|$)', re.IGNORECASE)


class WorkspaceFileTools:
    """工作区文件与命令工具集，限定大模型的所有操作都在指定的 workspace_dir 内"""

    DEFAULT_IGNORES = {
        ".git",
        ".venv",
        "__pycache__",
        "node_modules",
        ".idea",
        ".vscode",
        ".DS_Store",
    }

    def __init__(self, workspace_dir: str | Path):
        self.workspace_dir = Path(workspace_dir).resolve()
        if not self.workspace_dir.exists():
            raise ValueError(f"工作区目录不存在: {self.workspace_dir}")
        self.background_processes: List[subprocess.Popen] = []

    def _resolve_safe_path(self, relative_path: str) -> Path:
        """
        安全路径解析：
        1. 自动清洗首尾空格及开头的 '/' 或 '\\'，容错 './' 相对前缀
        2. 严格校验是否越出 workspace_dir
        """
        clean_path = relative_path.strip().lstrip("/\\")
        if clean_path.startswith("./") or clean_path.startswith(".\\"):
            clean_path = clean_path[2:]

        target = (self.workspace_dir / clean_path).resolve()
        try:
            target.relative_to(self.workspace_dir)
        except ValueError:
            raise PermissionError(
                f"访问被拒绝：路径 '{relative_path}' 超出工作区边界！"
                f"工作区根目录已经是顶层目录，严禁使用 '..' 向上跳出，请直接传入工作区内的相对路径。"
            )
        return target

    def list_files(self, sub_dir: str = ".") -> List[str]:
        """列出指定目录下的文件和文件夹列表"""
        try:
            target_dir = self._resolve_safe_path(sub_dir)
        except PermissionError as e:
            return [str(e)]

        if not target_dir.exists():
            return [f"错误: 目录 '{sub_dir}' 不存在"]
        if not target_dir.is_dir():
            return [f"错误: '{sub_dir}' 不是一个有效目录（它可能是一个文件）"]

        results = []
        for item in sorted(target_dir.iterdir()):
            if item.name in self.DEFAULT_IGNORES:
                continue
            item_type = "[DIR]" if item.is_dir() else "[FILE]"
            results.append(f"{item_type} {item.name}")
        return results

    def read_file(self, file_path: str, max_lines: int = 500) -> str:
        """安全读取文件内容，默认限制最大行数防止上下文撑爆"""
        try:
            target_file = self._resolve_safe_path(file_path)
        except PermissionError as e:
            return str(e)

        if not target_file.exists():
            return f"错误: 文件 '{file_path}' 不存在，请先使用 list_files 查看真实文件名"
        if not target_file.is_file():
            return f"错误: '{file_path}' 是一个目录而不是文件，请改用 list_files 查看"

        try:
            with open(target_file, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            content = "".join(lines[:max_lines])
            if len(lines) > max_lines:
                content += f"\n\n... (文件共 {len(lines)} 行，已截断至前 {max_lines} 行)"
            return content if content else "(文件为空)"
        except Exception as e:
            return f"读取文件失败: {str(e)}"

    def write_file(self, file_path: str, content: str) -> str:
        """安全写入文件内容（覆盖写入），父目录不存在时会自动创建"""
        try:
            target_file = self._resolve_safe_path(file_path)
            target_file.parent.mkdir(parents=True, exist_ok=True)
            with open(target_file, "w", encoding="utf-8") as f:
                f.write(content)
            return f"成功写入文件 '{file_path}' (共 {len(content)} 个字符)"
        except PermissionError as e:
            return str(e)
        except Exception as e:
            return f"写入文件失败: {str(e)}"

    def run_command(
        self,
        command: str,
        relative_dir: str = ".",
        timeout: int = 30,
        is_background: bool = False,
    ) -> str:
        """
        在工作区指定目录下执行系统命令，并将命令输出直接输出到控制台，同时捕获后返回给模型。
        支持 is_background=True 后台常驻服务模式（捕获启动 URL 后立即非阻塞返回）。
        自带 cd 命令硬拦截、越界检查、超时防卡死和输出截断保护。
        """
        if not command or not command.strip():
            return "错误: 传入的命令为空，请提供要执行的命令。"

        # 1. 严格硬拦截 cd 命令，防止状态混乱与乱跳
        if CD_PATTERN.search(command):
            return (
                "错误: 严禁在命令行中使用 'cd' 指令！\n"
                "原因：每次命令执行均为独立子进程，cd 无法保留目录状态且容易引起路径混乱与越界风险。\n"
                "正确做法：如需在特定子目录下执行命令，请传入 'relative_dir' 参数；或直接使用相对路径，例如 'python snake_game/script.py'。"
            )

        # 2. 安全解析目标工作目录
        try:
            target_cwd = self._resolve_safe_path(relative_dir)
        except PermissionError as e:
            return str(e)

        if not target_cwd.exists() or not target_cwd.is_dir():
            return f"错误: 指定的执行目录 '{relative_dir}' 不存在或不是有效目录。"

        # 3. 后台守护服务模式 (如启动 pnpm dev，捕获访问地址后立即返回，杜绝死锁)
        if is_background:
            print(f"\n🚀 [启动后台常驻服务 (cwd: {relative_dir})]: {command}")
            print("─" * 50)
            try:
                env = {**os.environ, "CI": "true", "FORCE_COLOR": "1"}
                process = subprocess.Popen(
                    command,
                    shell=True,
                    cwd=target_cwd,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    env=env,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    bufsize=1,
                )
                self.background_processes.append(process)

                log_queue = queue.Queue()

                def _reader():
                    try:
                        for line in iter(process.stdout.readline, ""):
                            if not line:
                                break
                            log_queue.put(line)
                    except Exception:
                        pass

                t = threading.Thread(target=_reader, daemon=True)
                t.start()

                startup_lines = []
                start_time = time.time()
                # 监听最多 5 秒，捕获包含 http:// 或 localhost 的访问地址
                while time.time() - start_time < 5.0:
                    try:
                        line = log_queue.get(timeout=0.3)
                        print(line, end="", flush=True)
                        startup_lines.append(line)
                        if any(k in line.lower() for k in ["http://", "localhost", "127.0.0.1", "ready in"]):
                            time.sleep(0.5)
                            while not log_queue.empty():
                                extra = log_queue.get_nowait()
                                print(extra, end="", flush=True)
                                startup_lines.append(extra)
                            break
                    except queue.Empty:
                        if process.poll() is not None:
                            break

                print("─" * 50)
                if process.poll() is not None:
                    return f"错误: 服务启动失败并退出 (退出码: {process.returncode})\n输出:\n{''.join(startup_lines)}"

                captured_str = "".join(startup_lines).strip() or "服务已成功在后台运行。"
                return (
                    f"服务已成功在后台启动并持续运行！\n"
                    f"【启动日志与访问信息】:\n{captured_str}\n"
                    f"请直接将捕获到的本地预览 URL（如 http://localhost:5173）在最终回复中呈现给用户体验！"
                )
            except Exception as e:
                print(f"\n❌ [后台启动服务异常]: {e}")
                print("─" * 50)
                return f"启动后台服务发生异常: {str(e)}"

        # 4. 常规命令模式（同步阻塞等待退出，如 build / install / test）
        print(f"\n⚡ [控制台命令执行 (cwd: {relative_dir})]: {command}")
        print("─" * 50)

        output_lines = []
        try:
            env = {**os.environ, "CI": "true"}
            process = subprocess.Popen(
                command,
                shell=True,
                cwd=target_cwd,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                env=env,
                text=True,
                encoding="utf-8",
                errors="replace",
                bufsize=1,
            )

            # 实时流式读取并直接打到控制台
            if process.stdout:
                for line in process.stdout:
                    print(line, end="", flush=True)
                    output_lines.append(line)

            process.wait(timeout=timeout)
            print("─" * 50)

            full_output = "".join(output_lines).strip()
            if not full_output:
                full_output = "(命令执行完成，无任何终端输出)"

            # 安全截断，防止大日志或长列表撑爆 LLM 上下文
            max_len = 2000
            if len(full_output) > max_len:
                model_output = full_output[:max_len] + f"\n\n... (输出过长，已截断前 {max_len} 个字符) ..."
            else:
                model_output = full_output

            status = "成功" if process.returncode == 0 else f"失败 (退出码: {process.returncode})"
            return f"命令执行状态: {status}\n【终端输出】:\n{model_output}"

        except subprocess.TimeoutExpired:
            if "process" in locals():
                process.kill()
            print("\n❌ [命令执行超时已被强行终止]")
            print("─" * 50)
            return f"错误: 命令执行超时（超过 {timeout} 秒限制）已被强行终止。请避免对普通命令执行长期等待；若为长驻服务请设置 is_background=True。"
        except Exception as e:
            print(f"\n❌ [执行命令异常]: {e}")
            print("─" * 50)
            return f"执行命令发生异常: {str(e)}"

    def get_openai_tool_definitions(self) -> List[Dict[str, Any]]:
        """生成供大模型识别的 tools 参数定义 (增加了清晰的路径规范与禁令)"""
        return [
            {
                "type": "function",
                "function": {
                    "name": "list_files",
                    "description": "查看指定子目录下的文件和文件夹列表。默认查看工作区根目录。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "sub_dir": {
                                "type": "string",
                                "description": (
                                    "工作区内的相对子目录路径。查看根目录直接传 '.'；查看子目录如 'core' 或 'docs'。"
                                    "【禁止】严禁使用 '../' 向上跳出根目录，严禁以 '/' 开头。"
                                ),
                                "default": ".",
                            }
                        },
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "read_file",
                    "description": "读取工作区中指定代码或文本文件的内容。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "file_path": {
                                "type": "string",
                                "description": (
                                    "文件的相对路径，基准为当前工作区根目录（例如 'main.py'、'core/client.py'）。"
                                    "【注意】严禁使用 '../' 向上越界，严禁使用绝对路径（如 '/etc/...' 或 'C:\\...'）。"
                                ),
                            }
                        },
                        "required": ["file_path"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "write_file",
                    "description": "写入或覆盖工作区中指定文件的文本内容，如果所在子目录不存在会自动创建。",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "file_path": {
                                "type": "string",
                                "description": (
                                    "要写入的目标文件相对路径（例如 'notes.md'、'output/result.txt'）。"
                                    "【注意】只能在当前工作区内创建，严禁使用 '../'。"
                                ),
                            },
                            "content": {
                                "type": "string",
                                "description": "要写入文件的完整文本内容。",
                            },
                        },
                        "required": ["file_path", "content"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "run_command",
                    "description": (
                        "在工作区指定目录下执行系统终端命令（如运行脚本、语法检查、打包构建、启动后台服务等）。"
                        "【绝对禁令】严禁使用 'cd' 命令！如需在特定子目录下执行，传入 'relative_dir' 参数。"
                        "【启动服务支持】若要启动网页开发服务器（如 'pnpm dev'）让用户预览，务必将 'is_background' 设为 True，工具会自动捕获本地访问链接（如 http://localhost:5173）并立即返回！"
                    ),
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "command": {
                                "type": "string",
                                "description": "要在终端中执行的具体命令行字符串（【严禁包含 cd 命令】）。例如 'git status'、'pnpm build'、'pnpm dev'。",
                            },
                            "relative_dir": {
                                "type": "string",
                                "description": "命令执行的目标子目录相对路径，默认为工作区根目录 '.'。严禁使用 '..' 越界跳出工作区。",
                                "default": ".",
                            },
                            "timeout": {
                                "type": "integer",
                                "description": "命令最大执行等待时间（秒），默认 30 秒（仅在 is_background=False 时生效）。",
                                "default": 30,
                            },
                            "is_background": {
                                "type": "boolean",
                                "description": (
                                    "是否作为后台常驻服务运行（例如启动网页开发服务器 'pnpm dev'）。"
                                    "当为 True 时，命令会在后台持续运行，工具在捕获到本地预览链接（如 http://localhost:5173）后会立即返回，绝对不会死锁阻塞！"
                                    "默认为 False。"
                                ),
                                "default": False,
                            },
                        },
                        "required": ["command"],
                    },
                },
            },
        ]

    def execute_tool(self, name: str, arguments: Dict[str, Any]) -> str:
        """根据大模型返回的 tool_call 函数名与参数进行分发执行"""
        if name == "list_files":
            files = self.list_files(sub_dir=arguments.get("sub_dir", "."))
            return "\n".join(files)
        elif name == "read_file":
            return self.read_file(file_path=arguments.get("file_path", ""))
        elif name == "write_file":
            return self.write_file(
                file_path=arguments.get("file_path", ""),
                content=arguments.get("content", ""),
            )
        elif name == "run_command":
            return self.run_command(
                command=arguments.get("command", ""),
                relative_dir=arguments.get("relative_dir", "."),
                timeout=arguments.get("timeout", 30),
                is_background=arguments.get("is_background", False),
            )
        else:
            return f"未知的工具名称: {name}"

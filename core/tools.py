import os
from pathlib import Path
from typing import Any, Dict, List


class WorkspaceFileTools:
    """工作区文件工具集，限定大模型的所有操作都在指定的 workspace_dir 内"""

    # 默认忽略的无关目录/文件
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

    def _resolve_safe_path(self, relative_path: str) -> Path:
        """安全路径解析：确保请求的路径永远在 workspace_dir 范围内，防止跨目录攻击"""
        target = (self.workspace_dir / relative_path).resolve()
        try:
            target.relative_to(self.workspace_dir)
        except ValueError:
            raise PermissionError(f"越权访问：路径 '{relative_path}' 超出工作区范围！")
        return target

    def list_files(self, sub_dir: str = ".") -> List[str]:
        """列出指定目录下的文件和文件夹列表"""
        target_dir = self._resolve_safe_path(sub_dir)
        if not target_dir.is_dir():
            return [f"错误: '{sub_dir}' 不是一个有效目录"]

        results = []
        for item in sorted(target_dir.iterdir()):
            if item.name in self.DEFAULT_IGNORES:
                continue
            item_type = "[DIR]" if item.is_dir() else "[FILE]"
            results.append(f"{item_type} {item.name}")
        return results

    def read_file(self, file_path: str, max_lines: int = 500) -> str:
        """安全读取文件内容，默认限制最大行数防止上下文撑爆"""
        target_file = self._resolve_safe_path(file_path)
        if not target_file.is_file():
            return f"错误: 文件 '{file_path}' 不存在或不是文件"

        try:
            with open(target_file, "r", encoding="utf-8", errors="ignore") as f:
                lines = [f.readline() for _ in range(max_lines)]
                content = "".join(lines)
                return content if content else "(文件为空)"
        except Exception as e:
            return f"读取文件失败: {str(e)}"

    def get_openai_tool_definitions(self) -> List[Dict[str, Any]]:
        """生成供 OpenAI / DeepSeek 识别的 tools 参数定义 (JSON Schema)"""
        return [
            {
                "type": "function",
                "function": {
                    "name": "list_files",
                    "description": "列出工作区中指定子目录下的文件和文件夹，默认查看工作区根目录",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "sub_dir": {
                                "type": "string",
                                "description": "相对工作区的子目录路径，例如 '.' 或 'src/components'，默认 '.'",
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
                    "description": "读取工作区中指定代码/文本文件的内容",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "file_path": {
                                "type": "string",
                                "description": "相对于工作区根目录的文件路径，例如 'main.py' 或 'src/utils.js'",
                            }
                        },
                        "required": ["file_path"],
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
        else:
            return f"未知的工具名称: {name}"

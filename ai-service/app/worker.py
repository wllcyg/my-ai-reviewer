"""
AI Document Worker 独立进程启动入口 (Entrypoint)
负责：
1. 运行时日志与配置初始化
2. 依赖项组装 (MQ Client -> Pipeline Orchestrator -> Consumer)
3. 操作系统信号监听与优雅停机 (Graceful Shutdown)
"""

import asyncio
import logging
import signal
import sys
from typing import Set

from app.config import get_settings
from app.consumers.document_consumer import DocumentConsumer
from app.core.mq import RabbitMQClient
from app.pipeline.orchestrator import PipelineOrchestrator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("worker.main")


class WorkerApplication:
    """Worker 运行期上下文与生命周期管理器"""

    def __init__(self):
        self.settings = get_settings()
        self.stop_event = asyncio.Event()

        # 校验关键配置
        if not self.settings.rabbitmq_url:
            logger.error("❌ 环境变量缺少 RABBITMQ_URL，无法启动 Worker")
            sys.exit(1)

        # 依赖注入与组件组装
        self.mq_client = RabbitMQClient(self.settings.rabbitmq_url)
        self.orchestrator = PipelineOrchestrator()
        self.consumer = DocumentConsumer(
            mq_client=self.mq_client,
            orchestrator=self.orchestrator,
            queue_name=self.settings.rabbitmq_queue,
            prefetch_count=self.settings.rabbitmq_prefetch_count,
        )

    def _setup_signal_handlers(self) -> None:
        """注册系统停机信号"""
        loop = asyncio.get_running_loop()

        def _trigger_shutdown():
            logger.info("🛑 捕获停机信号，正在启动优雅停机流程...")
            self.stop_event.set()

        # 针对类 Unix 系统绑定 signal handler
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, _trigger_shutdown)
            except NotImplementedError:
                # Windows 平台不支持 loop.add_signal_handler，由外部 KeyboardInterrupt 处理
                pass

    async def run(self) -> None:
        """启动 Worker 主循环"""
        logger.info(f"🚀 启动 AI Worker 服务 (环境: {self.settings.app_env})")
        self._setup_signal_handlers()

        # 1. 建立 RabbitMQ 连接
        await self.mq_client.connect()

        # 2. 启动队列消费
        await self.consumer.start()

        # 3. 阻塞等待停机信号
        await self.stop_event.wait()

        # 4. 优雅收尾
        logger.info("正在等待执行中的任务收尾并注销消费者...")
        await self.consumer.stop()
        await self.mq_client.close()
        logger.info("👋 AI Worker 已安全退出")


async def main() -> None:
    app = WorkerApplication()
    await app.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        # 兼容 Windows Ctrl+C 强制/优雅退出
        logger.info("用户手动中断 (SIGINT)，Worker 进程结束")

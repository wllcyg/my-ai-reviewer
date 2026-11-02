import logging
from typing import Optional

from aio_pika.abc import AbstractIncomingMessage, AbstractQueue, AbstractRobustChannel
from pydantic import ValidationError

from app.core.mq import RabbitMQClient
from app.pipeline.orchestrator import PipelineOrchestrator
from app.schemas.message import DocProcessTaskPayload

logger = logging.getLogger("consumer.document")


class DocumentConsumer:
    """
    文档处理 MQ 消费者适配器 (Transport Layer)
    职责：
    1. 监听 RabbitMQ 任务队列并进行 QoS 流量削峰
    2. 反序列化与 Pydantic 严格协议校验 (防毒丸消息)
    3. 驱动领域层 PipelineOrchestrator 执行知识加工
    4. 负责 ACK/NACK 策略与死信路由流转
    """

    def __init__(
        self,
        mq_client: RabbitMQClient,
        orchestrator: PipelineOrchestrator,
        queue_name: str,
        prefetch_count: int = 1,
    ):
        self._mq_client = mq_client
        self._orchestrator = orchestrator
        self._queue_name = queue_name
        self._prefetch_count = prefetch_count

        self._channel: Optional[AbstractRobustChannel] = None
        self._queue: Optional[AbstractQueue] = None
        self._consumer_tag: Optional[str] = None

    async def start(self) -> None:
        """初始化信道、设置 QoS 并启动队列消费"""
        self._channel = await self._mq_client.get_channel()
        await self._channel.set_qos(prefetch_count=self._prefetch_count)

        # 绑定至现有队列 (拓扑已由 Nest 端统一创建并配置死信参数，此处不重复声明避免参数冲突)
        self._queue = await self._channel.get_queue(self._queue_name, ensure=False)
        self._consumer_tag = await self._queue.consume(self._on_message)

        logger.info(
            f"消费者已就绪，正在监听队列 [{self._queue_name}] "
            f"(prefetch_count={self._prefetch_count}, consumer_tag={self._consumer_tag})"
        )

    async def _on_message(self, message: AbstractIncomingMessage) -> None:
        """
        单条消息处理入口：
        使用 message.process(requeue=False) 托管生命周期：
        - 正常执行完毕 -> 自动 ACK
        - 抛出异常 -> 自动 NACK (requeue=False，流转至死信队列)
        """
        async with message.process(requeue=False):
            # 1. 协议反序列化与严格契约校验
            try:
                task = DocProcessTaskPayload.model_validate_json(message.body)
            except ValidationError as val_err:
                logger.error(
                    f"收到非法格式消息，直接拒绝并流入死信队列排查: {val_err.errors()}",
                    extra={"raw_body": message.body.decode("utf-8", errors="replace")},
                )
                raise
            except Exception as parse_err:
                logger.error(f"消息 JSON 反序列化崩溃: {parse_err}")
                raise

            # 2. 委托给核心流水线编排器
            logger.info(
                f"📥 收到文档加工任务: taskId={task.task_id}, docCode={task.doc_code}, "
                f"title='{task.title}', attempt={task.attempt}"
            )
            try:
                await self._orchestrator.execute(task)
            except Exception as biz_err:
                logger.error(
                    f"❌ 文档加工流水线执行失败: taskId={task.task_id}, "
                    f"docCode={task.doc_code}, error={biz_err}",
                    exc_info=True,
                )
                raise

    async def stop(self) -> None:
        """优雅注销消费者监听"""
        if self._queue and self._consumer_tag:
            logger.info(f"正在取消队列 [{self._queue_name}] 消费者: tag={self._consumer_tag}")
            try:
                await self._queue.cancel(self._consumer_tag)
            except Exception as err:
                logger.warning(f"注销消费者遇到异常: {err}")
            self._consumer_tag = None

import logging
from typing import Optional
import aio_pika
from aio_pika.abc import AbstractRobustChannel, AbstractRobustConnection

logger = logging.getLogger("core.mq")


class RabbitMQClient:
    """RabbitMQ 底层连接池与信道生命周期管理 (Singleton Pattern)"""

    def __init__(self, amqp_url: str):
        self._url = amqp_url
        self._connection: Optional[AbstractRobustConnection] = None
        self._channel: Optional[AbstractRobustChannel] = None

    async def connect(self) -> None:
        if self._connection and not self._connection.is_closed:
            return

        masked_url = self._url.split("@")[-1] if "@" in self._url else "localhost"
        logger.info(f"正在建立 RabbitMQ 长连接: amqps://***@{masked_url}")

        self._connection = await aio_pika.connect_robust(self._url)
        self._channel = await self._connection.channel()
        logger.info("RabbitMQ 物理连接与默认信道已就绪")

    async def get_channel(self) -> AbstractRobustChannel:
        if not self._channel or self._channel.is_closed:
            await self.connect()
        assert self._channel is not None
        return self._channel

    async def close(self) -> None:
        if self._channel and not self._channel.is_closed:
            await self._channel.close()
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
        logger.info("RabbitMQ 连接已安全释放")

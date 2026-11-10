"""Giới hạn song song + hàng đợi trong bộ nhớ (một tiến trình, D15)."""

import asyncio
from contextlib import asynccontextmanager


class QueueFull(Exception):
    pass


class ScoreQueue:
    """Tối đa `workers` yêu cầu chạy cùng lúc; tổng (đang chạy + đang chờ) <= `queue_max`."""

    def __init__(self, workers: int, queue_max: int):
        self._sem = asyncio.Semaphore(workers)
        self._queue_max = queue_max
        self._in_system = 0

    @asynccontextmanager
    async def slot(self):
        if self._in_system >= self._queue_max:
            raise QueueFull
        self._in_system += 1
        try:
            async with self._sem:
                yield
        finally:
            self._in_system -= 1

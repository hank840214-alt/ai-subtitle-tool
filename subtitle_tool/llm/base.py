"""Abstract LLM provider interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class BaseLLMProvider(ABC):
    @abstractmethod
    async def complete(self, system: str, user: str) -> str: ...

    @abstractmethod
    async def stream(self, system: str, user: str) -> AsyncIterator[str]: ...

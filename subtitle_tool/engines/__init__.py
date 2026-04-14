"""Engine registry — discover, list, select ASR engines."""

from __future__ import annotations

from typing import Type

from .base import AbstractEngine, Segment, TranscribeResult

__all__ = ["EngineRegistry", "AbstractEngine", "Segment", "TranscribeResult"]


class EngineRegistry:
    """Registry of available ASR engines."""

    def __init__(self):
        self._engines: dict[str, Type[AbstractEngine]] = {}
        self._instances: dict[str, AbstractEngine] = {}

    def register(self, engine_cls: Type[AbstractEngine]) -> None:
        self._engines[engine_cls.name] = engine_cls

    def get(self, name: str, **init_kwargs) -> AbstractEngine:
        if name not in self._engines:
            raise KeyError(f"Unknown engine: {name}. Available: {list(self._engines)}")
        if name not in self._instances:
            self._instances[name] = self._engines[name](**init_kwargs)
        return self._instances[name]

    def list_engines(self, streaming_only: bool = False) -> list[str]:
        if streaming_only:
            return [n for n, cls in self._engines.items() if cls.supports_streaming]
        return list(self._engines)

    def reset(self) -> None:
        """Clear cached instances (useful for testing / model switching)."""
        self._instances.clear()

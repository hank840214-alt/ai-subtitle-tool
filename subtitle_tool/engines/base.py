"""Abstract engine interface and shared types."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class Segment:
    start: float
    end: float
    text: str


@dataclass
class TranscribeResult:
    segments: list[Segment] = field(default_factory=list)
    language: str = ""
    language_probability: float = 0.0


class AbstractEngine(ABC):
    """Base class for all ASR engines."""

    name: str = ""
    supports_streaming: bool = False

    @abstractmethod
    def transcribe(self, audio_path: str | Path, **opts) -> TranscribeResult:
        """Batch transcription: full file -> full result."""

    async def stream(
        self, audio_chunks: AsyncIterator[bytes], **opts
    ) -> AsyncIterator[Segment]:
        """Streaming transcription: audio chunks -> live segments."""
        raise NotImplementedError(f"{self.name} does not support streaming")
        yield  # type: ignore  # pragma: no cover

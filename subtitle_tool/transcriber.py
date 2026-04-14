"""Backwards-compatible transcription — delegates to engine layer."""

from __future__ import annotations

from pathlib import Path

from .engines.base import Segment, TranscribeResult
from .engines.faster_whisper_engine import FasterWhisperEngine, DEFAULT_MODEL

__all__ = ["Transcriber", "Segment", "TranscribeResult", "DEFAULT_MODEL"]


class Transcriber:
    """Legacy wrapper — delegates to FasterWhisperEngine."""

    def __init__(self, model_id: str = DEFAULT_MODEL, device: str = "auto",
                 compute_type: str = "auto", convert_to_traditional: bool = True):
        self._engine = FasterWhisperEngine(
            model_id=model_id, device=device, compute_type=compute_type,
            convert_to_traditional=convert_to_traditional,
        )

    def transcribe(self, audio_path: str | Path, language: str | None = "zh",
                   beam_size: int = 5, vad_filter: bool = True,
                   word_timestamps: bool = False) -> TranscribeResult:
        return self._engine.transcribe(
            audio_path, language=language, beam_size=beam_size,
            vad_filter=vad_filter, word_timestamps=word_timestamps,
        )

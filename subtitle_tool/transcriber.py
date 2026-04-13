"""Core transcription engine — faster-whisper + opencc for zh-TW accuracy."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from faster_whisper import WhisperModel
from opencc import OpenCC


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


# Whisper initial prompt trick — forces Traditional Chinese output
ZH_TW_PROMPT = "以下是繁體中文的語音轉錄。"

# Default model: BELLE fine-tuned for best Chinese accuracy
# Falls back to base whisper if BELLE not available
DEFAULT_MODEL = "BELLE-2/Belle-whisper-large-v3-zh-punct"
FALLBACK_MODEL = "large-v3-turbo"


class Transcriber:
    """Transcribe audio/video to text segments with timestamps."""

    def __init__(
        self,
        model_id: str = DEFAULT_MODEL,
        device: str = "auto",
        compute_type: str = "auto",
        convert_to_traditional: bool = True,
    ):
        self.model_id = model_id
        self.convert_to_traditional = convert_to_traditional
        self._cc = OpenCC("s2twp") if convert_to_traditional else None

        # Resolve device
        if device == "auto":
            device = "cuda" if _cuda_available() else "cpu"

        # Resolve compute type
        if compute_type == "auto":
            compute_type = "float16" if device == "cuda" else "int8"

        self.model = WhisperModel(
            model_id,
            device=device,
            compute_type=compute_type,
        )

    def transcribe(
        self,
        audio_path: str | Path,
        language: str | None = "zh",
        beam_size: int = 5,
        vad_filter: bool = True,
        word_timestamps: bool = False,
    ) -> TranscribeResult:
        """Transcribe audio/video file to segments.

        Args:
            audio_path: Path to audio or video file (ffmpeg handles extraction).
            language: Language code. "zh" for Chinese, None for auto-detect.
            beam_size: Beam search size (higher = more accurate, slower).
            vad_filter: Use VAD to filter silence (essential for long files).
            word_timestamps: Generate word-level timestamps.

        Returns:
            TranscribeResult with segments and metadata.
        """
        audio_path = str(audio_path)

        segments_iter, info = self.model.transcribe(
            audio_path,
            language=language,
            beam_size=beam_size,
            vad_filter=vad_filter,
            vad_parameters={
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 200,
            },
            word_timestamps=word_timestamps,
            initial_prompt=ZH_TW_PROMPT if language == "zh" else None,
        )

        segments = []
        for seg in segments_iter:
            text = seg.text.strip()
            if self._cc and text:
                text = self._cc.convert(text)
            segments.append(Segment(start=seg.start, end=seg.end, text=text))

        return TranscribeResult(
            segments=segments,
            language=info.language,
            language_probability=info.language_probability,
        )


def _cuda_available() -> bool:
    try:
        import torch
        return torch.cuda.is_available()
    except ImportError:
        return False

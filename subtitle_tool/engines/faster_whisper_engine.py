"""FasterWhisper engine — wraps existing BELLE/Whisper transcription."""

from __future__ import annotations

from pathlib import Path

from faster_whisper import WhisperModel
from opencc import OpenCC

from .base import AbstractEngine, Segment, TranscribeResult

ZH_TW_PROMPT = "以下是繁體中文的語音轉錄。"
DEFAULT_MODEL = "BELLE-2/Belle-whisper-large-v3-zh-punct"


class FasterWhisperEngine(AbstractEngine):
    """Batch transcription using faster-whisper + OpenCC for zh-TW."""

    name = "faster-whisper"
    supports_streaming = False

    def __init__(
        self,
        model_id: str = DEFAULT_MODEL,
        device: str = "auto",
        compute_type: str = "auto",
        convert_to_traditional: bool = True,
    ):
        if device == "auto":
            device = "cuda" if _cuda_available() else "cpu"
        if compute_type == "auto":
            compute_type = "float16" if device == "cuda" else "int8"

        self._model = WhisperModel(model_id, device=device, compute_type=compute_type)
        self._cc = OpenCC("s2twp") if convert_to_traditional else None

    def transcribe(
        self,
        audio_path: str | Path,
        language: str | None = "zh",
        beam_size: int = 5,
        vad_filter: bool = True,
        word_timestamps: bool = False,
        **opts,
    ) -> TranscribeResult:
        segments_iter, info = self._model.transcribe(
            str(audio_path),
            language=language,
            beam_size=beam_size,
            vad_filter=vad_filter,
            vad_parameters={"min_silence_duration_ms": 500, "speech_pad_ms": 200},
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

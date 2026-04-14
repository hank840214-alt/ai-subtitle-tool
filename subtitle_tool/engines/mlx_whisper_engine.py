"""MLX Whisper engine — Apple Silicon optimized batch transcription."""

from __future__ import annotations

from pathlib import Path

from .base import AbstractEngine, Segment, TranscribeResult

DEFAULT_MODEL = "mlx-community/whisper-large-v3-turbo"


class MlxWhisperEngine(AbstractEngine):
    """Batch transcription using mlx-whisper on Apple Silicon."""

    name = "mlx-whisper"
    supports_streaming = False

    def __init__(
        self,
        model_id: str = DEFAULT_MODEL,
        convert_to_traditional: bool = True,
    ):
        self._model_id = model_id
        self._cc = None
        if convert_to_traditional:
            from opencc import OpenCC
            self._cc = OpenCC("s2twp")

    def transcribe(
        self,
        audio_path: str | Path,
        language: str | None = "zh",
        word_timestamps: bool = False,
        **opts,
    ) -> TranscribeResult:
        import mlx_whisper

        result = mlx_whisper.transcribe(
            str(audio_path),
            path_or_hf_repo=self._model_id,
            language=language,
            word_timestamps=word_timestamps,
            initial_prompt="以下是繁體中文的語音轉錄。" if language == "zh" else None,
        )

        segments = []
        for seg in result.get("segments", []):
            text = seg["text"].strip()
            if self._cc and text:
                text = self._cc.convert(text)
            segments.append(Segment(
                start=seg["start"],
                end=seg["end"],
                text=text,
            ))

        detected_lang = result.get("language", language or "")
        return TranscribeResult(
            segments=segments,
            language=detected_lang,
            language_probability=1.0,
        )

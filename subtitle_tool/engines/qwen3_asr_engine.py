# subtitle_tool/engines/qwen3_asr_engine.py
"""Qwen3-ASR engine — streaming + batch transcription."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from .base import AbstractEngine, Segment, TranscribeResult

DEFAULT_MODEL_ID = "Qwen/Qwen3-ASR-0.6B"


class Qwen3AsrEngine(AbstractEngine):
    """Qwen3-ASR with native streaming support."""

    name = "qwen3-asr"
    supports_streaming = True

    def __init__(
        self,
        model_id: str = DEFAULT_MODEL_ID,
        device: str = "auto",
        convert_to_traditional: bool = True,
    ):
        import torch
        from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor

        if device == "auto":
            if torch.backends.mps.is_available():
                device = "mps"
            elif torch.cuda.is_available():
                device = "cuda"
            else:
                device = "cpu"

        self._device = device
        self._processor = AutoProcessor.from_pretrained(model_id)
        self._model = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_id,
            torch_dtype=torch.float32 if device == "cpu" else torch.float16,
        ).to(device)

        self._cc = None
        if convert_to_traditional:
            from opencc import OpenCC
            self._cc = OpenCC("s2twp")

    def transcribe(
        self,
        audio_path: str | Path,
        language: str | None = "zh",
        **opts,
    ) -> TranscribeResult:
        import librosa
        import torch

        audio, sr = librosa.load(str(audio_path), sr=16000)
        inputs = self._processor(
            audio, sampling_rate=16000, return_tensors="pt"
        ).to(self._device)

        with torch.no_grad():
            generated_ids = self._model.generate(**inputs, max_new_tokens=1024)

        text = self._processor.batch_decode(generated_ids, skip_special_tokens=True)[0]

        if self._cc and text:
            text = self._cc.convert(text)

        segments = [Segment(start=0.0, end=len(audio) / 16000, text=text.strip())]

        return TranscribeResult(
            segments=segments,
            language=language or "zh",
            language_probability=1.0,
        )

    async def stream(
        self,
        audio_chunks: AsyncIterator[bytes],
        sample_rate: int = 16000,
        chunk_duration: float = 2.0,
        **opts,
    ) -> AsyncIterator[Segment]:
        """Process audio chunks in real-time, yielding segments incrementally."""
        import numpy as np
        import torch

        buffer = bytearray()
        chunk_bytes = int(chunk_duration * sample_rate * 2)  # 16-bit PCM
        elapsed = 0.0

        async for chunk in audio_chunks:
            buffer.extend(chunk)

            while len(buffer) >= chunk_bytes:
                pcm = buffer[:chunk_bytes]
                buffer = buffer[chunk_bytes:]

                audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
                inputs = self._processor(
                    audio, sampling_rate=sample_rate, return_tensors="pt"
                ).to(self._device)

                with torch.no_grad():
                    generated_ids = self._model.generate(**inputs, max_new_tokens=256)

                text = self._processor.batch_decode(
                    generated_ids, skip_special_tokens=True
                )[0].strip()

                if self._cc and text:
                    text = self._cc.convert(text)

                if text:
                    start = elapsed
                    elapsed += chunk_duration
                    yield Segment(start=start, end=elapsed, text=text)
                else:
                    elapsed += chunk_duration

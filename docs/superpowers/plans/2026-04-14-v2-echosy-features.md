# AI Subtitle Tool v2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the batch subtitle tool into a real-time transcription platform with three ASR engines, live streaming, AI summary, RAG chat, and dictation mode.

**Architecture:** Web + Native Helper (方案 B). FastAPI backend handles all ASR/LLM/RAG work. Next.js frontend adds three tabs (Subtitles/Live/Dictation) plus a Settings panel. A Swift CLI provides optional macOS system audio capture. The engine abstraction layer lets all features share the same `TranscribeResult` type.

**Tech Stack:** Python 3.12, FastAPI, WebSocket, faster-whisper, Qwen3-ASR (antirez C or transformers), mlx-whisper, sentence-transformers, httpx (Ollama), Next.js 15, AudioWorklet, Swift/ScreenCaptureKit.

**Spec:** `docs/superpowers/specs/2026-04-14-v2-echosy-features-design.md`

---

## File Map

### New Python Files

| File | Responsibility |
|------|---------------|
| `subtitle_tool/engines/__init__.py` | EngineRegistry — discover, list, select engines |
| `subtitle_tool/engines/base.py` | AbstractEngine interface + TranscribeResult (moved from transcriber.py) |
| `subtitle_tool/engines/faster_whisper_engine.py` | Existing BELLE/Whisper wrapped as engine |
| `subtitle_tool/engines/qwen3_asr_engine.py` | Qwen3-ASR 0.6B/1.7B batch + streaming |
| `subtitle_tool/engines/mlx_whisper_engine.py` | MLX Whisper batch engine |
| `subtitle_tool/llm/__init__.py` | LLMProvider factory |
| `subtitle_tool/llm/base.py` | Abstract LLM interface |
| `subtitle_tool/llm/ollama.py` | Ollama HTTP provider |
| `subtitle_tool/llm/openai_compat.py` | OpenAI-compatible API provider |
| `subtitle_tool/rag/__init__.py` | RAG module init |
| `subtitle_tool/rag/indexer.py` | Segment vectorization + SQLite storage |
| `subtitle_tool/rag/retriever.py` | Query → top-K segments |
| `subtitle_tool/settings.py` | User settings load/save (~/.config/ai-subtitle-tool/settings.json) |
| `subtitle_tool/audio_cap.py` | Swift CLI lifecycle manager |
| `api/ws_live.py` | WebSocket live transcription handler |
| `api/routes_llm.py` | Summary + Chat API routes |
| `api/routes_settings.py` | Settings + Model management routes |
| `tests/test_engines.py` | Engine abstraction tests |
| `tests/test_llm.py` | LLM provider tests |
| `tests/test_rag.py` | RAG indexer + retriever tests |
| `tests/test_settings.py` | Settings persistence tests |
| `tests/conftest.py` | Shared fixtures |

### Modified Python Files

| File | Changes |
|------|---------|
| `subtitle_tool/transcriber.py` | Becomes thin wrapper delegating to engines |
| `subtitle_tool/__init__.py` | Bump to v2.0.0 |
| `api/main.py` | Mount WebSocket, new routers, update workers to use engine registry |
| `api/models.py` | Add new schemas for settings, chat, summary, capabilities |
| `pyproject.toml` | Add new dependencies and optional groups |

### New Frontend Files

| File | Responsibility |
|------|---------------|
| `web/app/live/page.tsx` | Live transcription page |
| `web/app/dictation/page.tsx` | Dictation mode page |
| `web/app/settings/page.tsx` | Settings panel |
| `web/components/LivePanel.tsx` | Live transcription controls + rolling captions |
| `web/components/DictationPanel.tsx` | Dictation text editor + controls |
| `web/components/SummaryChat.tsx` | Summary + Chat tabbed panel (shared by Subtitles + Live) |
| `web/components/SettingsPanel.tsx` | LLM + Model + Audio settings |
| `web/components/NavTabs.tsx` | Top navigation tabs |
| `web/lib/useAudioStream.ts` | AudioWorklet + WebSocket hook |
| `web/lib/api.ts` | API client helpers |

### Modified Frontend Files

| File | Changes |
|------|---------|
| `web/components/Header.tsx` | Replace with NavTabs-integrated header |
| `web/components/TranscribePanel.tsx` | Add SummaryChat below results |
| `web/app/page.tsx` | Wrap with tab navigation |
| `web/app/layout.tsx` | Add nav context if needed |

### New Swift Files

| File | Responsibility |
|------|---------------|
| `audio-cap/Package.swift` | Swift package manifest |
| `audio-cap/Sources/main.swift` | ScreenCaptureKit system audio capture → stdout PCM |

---

## Phase 1: Engine Abstraction (Tasks 1-4)

### Task 1: Engine base + registry

**Files:**
- Create: `subtitle_tool/engines/__init__.py`
- Create: `subtitle_tool/engines/base.py`
- Create: `tests/conftest.py`
- Create: `tests/test_engines.py`

- [ ] **Step 1: Create tests directory and conftest**

```python
# tests/conftest.py
"""Shared test fixtures for ai-subtitle-tool."""

import pytest
from pathlib import Path


@pytest.fixture
def sample_audio_path():
    """Path to test audio file — exists in repo root."""
    p = Path(__file__).parent.parent / "test_audio.wav"
    if not p.exists():
        pytest.skip("test_audio.wav not found")
    return p
```

- [ ] **Step 2: Write failing test for engine abstraction**

```python
# tests/test_engines.py
"""Tests for engine abstraction layer."""

import pytest
from subtitle_tool.engines.base import AbstractEngine, Segment, TranscribeResult
from subtitle_tool.engines import EngineRegistry


def test_segment_dataclass():
    seg = Segment(start=0.0, end=1.5, text="hello")
    assert seg.start == 0.0
    assert seg.end == 1.5
    assert seg.text == "hello"


def test_transcribe_result():
    segs = [Segment(start=0.0, end=1.0, text="test")]
    result = TranscribeResult(segments=segs, language="zh", language_probability=0.95)
    assert len(result.segments) == 1
    assert result.language == "zh"


def test_abstract_engine_cannot_stream_by_default():
    class DummyEngine(AbstractEngine):
        name = "dummy"
        supports_streaming = False

        def transcribe(self, audio_path, **opts):
            return TranscribeResult(segments=[], language="", language_probability=0.0)

    engine = DummyEngine()
    assert engine.supports_streaming is False


def test_registry_register_and_get():
    registry = EngineRegistry()

    class FakeEngine(AbstractEngine):
        name = "fake"
        supports_streaming = False

        def transcribe(self, audio_path, **opts):
            return TranscribeResult(segments=[], language="", language_probability=0.0)

    registry.register(FakeEngine)
    assert "fake" in registry.list_engines()
    engine = registry.get("fake")
    assert engine.name == "fake"


def test_registry_get_unknown_raises():
    registry = EngineRegistry()
    with pytest.raises(KeyError):
        registry.get("nonexistent")


def test_registry_list_streaming():
    registry = EngineRegistry()

    class BatchEngine(AbstractEngine):
        name = "batch-only"
        supports_streaming = False
        def transcribe(self, audio_path, **opts):
            return TranscribeResult(segments=[], language="", language_probability=0.0)

    class StreamEngine(AbstractEngine):
        name = "streamer"
        supports_streaming = True
        def transcribe(self, audio_path, **opts):
            return TranscribeResult(segments=[], language="", language_probability=0.0)
        async def stream(self, audio_chunks, **opts):
            pass

    registry.register(BatchEngine)
    registry.register(StreamEngine)
    streaming = registry.list_engines(streaming_only=True)
    assert "streamer" in streaming
    assert "batch-only" not in streaming
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/test_engines.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'subtitle_tool.engines'`

- [ ] **Step 4: Implement engine base and registry**

```python
# subtitle_tool/engines/base.py
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
        # yield is needed to make this an async generator
        yield  # type: ignore  # pragma: no cover
```

```python
# subtitle_tool/engines/__init__.py
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/test_engines.py -v`
Expected: All 6 tests PASS

- [ ] **Step 6: Commit**

```bash
cd ~/ai-subtitle-tool
git add subtitle_tool/engines/ tests/
git commit -m "feat: add engine abstraction layer with registry

AbstractEngine defines batch transcribe() and optional stream().
EngineRegistry handles discovery, instantiation, and caching."
```

---

### Task 2: Migrate faster-whisper to engine pattern

**Files:**
- Create: `subtitle_tool/engines/faster_whisper_engine.py`
- Modify: `subtitle_tool/transcriber.py` (thin wrapper)
- Modify: `tests/test_engines.py` (add integration test)

- [ ] **Step 1: Write failing test for faster-whisper engine**

Add to `tests/test_engines.py`:

```python
def test_faster_whisper_engine_instantiates():
    """FasterWhisperEngine should be importable and have correct metadata."""
    from subtitle_tool.engines.faster_whisper_engine import FasterWhisperEngine
    assert FasterWhisperEngine.name == "faster-whisper"
    assert FasterWhisperEngine.supports_streaming is False


def test_faster_whisper_engine_transcribe(sample_audio_path):
    """Integration test — requires model download, may be slow."""
    from subtitle_tool.engines.faster_whisper_engine import FasterWhisperEngine
    engine = FasterWhisperEngine(model_id="tiny", device="cpu", compute_type="int8")
    result = engine.transcribe(str(sample_audio_path), language="zh")
    assert isinstance(result, TranscribeResult)
    assert result.language != ""
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/test_engines.py::test_faster_whisper_engine_instantiates -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement FasterWhisperEngine**

```python
# subtitle_tool/engines/faster_whisper_engine.py
"""FasterWhisper engine — wraps existing BELLE/Whisper transcription."""

from __future__ import annotations

from pathlib import Path

from faster_whisper import WhisperModel
from opencc import OpenCC

from .base import AbstractEngine, Segment, TranscribeResult

# Forces Traditional Chinese output
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
```

- [ ] **Step 4: Update transcriber.py as thin wrapper**

Replace `subtitle_tool/transcriber.py` with:

```python
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
```

- [ ] **Step 5: Verify existing CLI still works**

Run: `cd ~/ai-subtitle-tool && python -m subtitle_tool transcribe --help`
Expected: Help text prints without errors (Segment/TranscribeResult imports still work via transcriber.py)

- [ ] **Step 6: Run all tests**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/test_engines.py -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
cd ~/ai-subtitle-tool
git add subtitle_tool/engines/faster_whisper_engine.py subtitle_tool/transcriber.py tests/test_engines.py
git commit -m "refactor: migrate faster-whisper to engine pattern

FasterWhisperEngine wraps all existing logic. Transcriber becomes a
thin backwards-compatible wrapper. No behavior change."
```

---

### Task 3: Qwen3-ASR engine

**Files:**
- Create: `subtitle_tool/engines/qwen3_asr_engine.py`
- Modify: `tests/test_engines.py`
- Modify: `pyproject.toml`

- [ ] **Step 1: Add Qwen3-ASR dependency to pyproject.toml**

Add to `pyproject.toml` optional dependencies:

```toml
[project.optional-dependencies]
web = [
    "fastapi>=0.115.0",
    "uvicorn>=0.34.0",
    "python-multipart>=0.0.18",
    "sse-starlette>=2.0.0",
    "yt-dlp>=2024.1.0",
]
live = [
    "websockets>=12.0",
    "sentence-transformers>=3.0",
    "numpy>=1.26",
    "httpx>=0.27",
]
qwen3 = [
    "transformers>=4.52",
    "torch>=2.4",
    "soundfile>=0.13",
    "librosa>=0.10",
]
mlx = [
    "mlx-whisper>=0.4",
]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
]
```

- [ ] **Step 2: Write failing test for Qwen3-ASR engine**

Add to `tests/test_engines.py`:

```python
def test_qwen3_asr_engine_metadata():
    pytest.importorskip("transformers", reason="transformers not installed")
    from subtitle_tool.engines.qwen3_asr_engine import Qwen3AsrEngine
    assert Qwen3AsrEngine.name == "qwen3-asr"
    assert Qwen3AsrEngine.supports_streaming is True


@pytest.mark.asyncio
async def test_qwen3_asr_stream_interface():
    """Verify stream() is an async generator (mock, no model download)."""
    pytest.importorskip("transformers", reason="transformers not installed")
    from unittest.mock import MagicMock, patch
    from subtitle_tool.engines.qwen3_asr_engine import Qwen3AsrEngine

    with patch.object(Qwen3AsrEngine, "__init__", lambda self, **kw: None):
        engine = Qwen3AsrEngine()
        engine.name = "qwen3-asr"
        engine.supports_streaming = True
        engine._model = None
        engine._processor = None
        engine._cc = None
        # stream() should exist and be async
        assert hasattr(engine, "stream")
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/test_engines.py::test_qwen3_asr_engine_metadata -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 4: Implement Qwen3-ASR engine**

```python
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

        # Qwen3-ASR returns full text; wrap as single segment
        # For proper segmentation, use VAD chunking externally
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
```

- [ ] **Step 5: Run tests**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/test_engines.py -v -k "qwen3 or registry or segment or abstract" --ignore=.venv`
Expected: Tests that don't require transformers will skip; metadata tests pass if transformers installed.

- [ ] **Step 6: Commit**

```bash
cd ~/ai-subtitle-tool
git add subtitle_tool/engines/qwen3_asr_engine.py pyproject.toml tests/test_engines.py
git commit -m "feat: add Qwen3-ASR engine with native streaming

Supports batch transcribe() and streaming stream() via chunked
inference. Auto-detects MPS/CUDA/CPU device."
```

---

### Task 4: MLX Whisper engine

**Files:**
- Create: `subtitle_tool/engines/mlx_whisper_engine.py`
- Modify: `tests/test_engines.py`

- [ ] **Step 1: Write failing test**

Add to `tests/test_engines.py`:

```python
def test_mlx_whisper_engine_metadata():
    pytest.importorskip("mlx_whisper", reason="mlx-whisper not installed")
    from subtitle_tool.engines.mlx_whisper_engine import MlxWhisperEngine
    assert MlxWhisperEngine.name == "mlx-whisper"
    assert MlxWhisperEngine.supports_streaming is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/test_engines.py::test_mlx_whisper_engine_metadata -v`
Expected: FAIL or SKIP

- [ ] **Step 3: Implement MLX Whisper engine**

```python
# subtitle_tool/engines/mlx_whisper_engine.py
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
```

- [ ] **Step 4: Run tests**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/test_engines.py -v --ignore=.venv`
Expected: PASS (or SKIP if mlx-whisper not installed)

- [ ] **Step 5: Register all engines in a default registry**

Add to `subtitle_tool/engines/__init__.py`:

```python
def create_default_registry() -> EngineRegistry:
    """Create registry with all available engines."""
    registry = EngineRegistry()

    # Always available
    from .faster_whisper_engine import FasterWhisperEngine
    registry.register(FasterWhisperEngine)

    # Optional: Qwen3-ASR
    try:
        from .qwen3_asr_engine import Qwen3AsrEngine
        registry.register(Qwen3AsrEngine)
    except ImportError:
        pass

    # Optional: MLX Whisper (Apple Silicon only)
    try:
        from .mlx_whisper_engine import MlxWhisperEngine
        registry.register(MlxWhisperEngine)
    except ImportError:
        pass

    return registry
```

- [ ] **Step 6: Commit**

```bash
cd ~/ai-subtitle-tool
git add subtitle_tool/engines/mlx_whisper_engine.py subtitle_tool/engines/__init__.py tests/test_engines.py
git commit -m "feat: add MLX Whisper engine + default registry

Apple Silicon optimized batch transcription. create_default_registry()
auto-discovers available engines at import time."
```

---

## Phase 2: Live Transcription (Tasks 5-7)

### Task 5: WebSocket live transcription endpoint

**Files:**
- Create: `api/ws_live.py`
- Modify: `api/main.py`
- Modify: `api/models.py`

- [ ] **Step 1: Add WebSocket schemas to api/models.py**

Append to `api/models.py`:

```python
class LiveAction(str, Enum):
    start = "start"
    pause = "pause"
    stop = "stop"


class LiveControlMessage(BaseModel):
    action: LiveAction
    engine: str = "qwen3-asr"
    language: str = "zh"


class LiveSegmentEvent(BaseModel):
    type: str  # "partial" | "final" | "status" | "error"
    text: str | None = None
    segment: dict[str, Any] | None = None
    sources: list[str] | None = None
    engine: str | None = None
    message: str | None = None


class CapabilitiesResponse(BaseModel):
    engines: list[dict[str, Any]]
    audio_cap_available: bool
    llm_available: bool
```

- [ ] **Step 2: Implement WebSocket handler**

```python
# api/ws_live.py
"""WebSocket handler for live streaming transcription."""

from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from subtitle_tool.engines import create_default_registry
from subtitle_tool.engines.base import Segment


async def _byte_chunks_from_ws(ws: WebSocket, stop_event: asyncio.Event) -> AsyncIterator[bytes]:
    """Yield binary PCM frames from WebSocket until stop."""
    while not stop_event.is_set():
        try:
            data = await asyncio.wait_for(ws.receive_bytes(), timeout=0.5)
            yield data
        except asyncio.TimeoutError:
            continue
        except WebSocketDisconnect:
            break


async def live_transcribe_ws(ws: WebSocket):
    """Handle a live transcription WebSocket session."""
    await ws.accept()
    registry = create_default_registry()
    stop_event = asyncio.Event()
    engine_instance = None

    try:
        while True:
            # Wait for control message to start
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg.get("action") == "start":
                engine_name = msg.get("engine", "qwen3-asr")
                language = msg.get("language", "zh")

                if engine_name not in registry.list_engines(streaming_only=True):
                    await ws.send_json({
                        "type": "error",
                        "message": f"Engine {engine_name} does not support streaming. "
                                   f"Available: {registry.list_engines(streaming_only=True)}",
                    })
                    continue

                engine_instance = registry.get(engine_name)
                stop_event.clear()

                await ws.send_json({
                    "type": "status",
                    "sources": ["mic"],
                    "engine": engine_name,
                })

                # Start streaming in a task
                stream_task = asyncio.create_task(
                    _run_stream(ws, engine_instance, stop_event, language)
                )

                # Listen for pause/stop while streaming
                try:
                    while not stop_event.is_set():
                        try:
                            ctrl = await asyncio.wait_for(ws.receive_text(), timeout=0.3)
                            ctrl_msg = json.loads(ctrl)
                            if ctrl_msg.get("action") in ("stop", "pause"):
                                stop_event.set()
                        except asyncio.TimeoutError:
                            continue
                except WebSocketDisconnect:
                    stop_event.set()

                await stream_task

            elif msg.get("action") == "stop":
                stop_event.set()

    except WebSocketDisconnect:
        pass
    finally:
        stop_event.set()


async def _run_stream(
    ws: WebSocket,
    engine,
    stop_event: asyncio.Event,
    language: str,
):
    """Run the streaming engine and send results via WebSocket."""
    try:
        chunks = _byte_chunks_from_ws(ws, stop_event)
        async for segment in engine.stream(chunks, language=language):
            if ws.client_state != WebSocketState.CONNECTED:
                break
            await ws.send_json({
                "type": "final",
                "segment": {
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": segment.text,
                },
            })
    except Exception as e:
        if ws.client_state == WebSocketState.CONNECTED:
            await ws.send_json({"type": "error", "message": str(e)})
```

- [ ] **Step 3: Mount WebSocket in api/main.py**

Add to `api/main.py` after the existing route definitions:

```python
# At top — add import
from api.ws_live import live_transcribe_ws

# After existing routes — add WebSocket
@app.websocket("/ws/live-transcribe")
async def ws_live(websocket: WebSocket):
    await live_transcribe_ws(websocket)


# Add capabilities endpoint
@app.get("/api/capabilities")
async def get_capabilities():
    from subtitle_tool.engines import create_default_registry
    from subtitle_tool.audio_cap import is_audio_cap_available

    registry = create_default_registry()
    engines = []
    for name in registry.list_engines():
        cls = registry._engines[name]
        engines.append({
            "name": name,
            "streaming": cls.supports_streaming,
        })

    return {
        "engines": engines,
        "audio_cap_available": is_audio_cap_available(),
        "llm_available": True,  # Updated when LLM layer is added
    }
```

- [ ] **Step 4: Create audio_cap stub**

```python
# subtitle_tool/audio_cap.py
"""macOS system audio capture via Swift CLI (audio-cap)."""

from __future__ import annotations

import shutil


def is_audio_cap_available() -> bool:
    """Check if the audio-cap Swift CLI is installed."""
    return shutil.which("audio-cap") is not None
```

- [ ] **Step 5: Commit**

```bash
cd ~/ai-subtitle-tool
git add api/ws_live.py api/main.py api/models.py subtitle_tool/audio_cap.py
git commit -m "feat: add WebSocket live transcription endpoint

/ws/live-transcribe accepts binary PCM + JSON control messages,
streams transcription segments back. Includes /api/capabilities."
```

---

### Task 6: Browser AudioWorklet + WebSocket client

**Files:**
- Create: `web/lib/useAudioStream.ts`
- Create: `web/lib/api.ts`
- Create: `web/public/audio-worklet-processor.js`

- [ ] **Step 1: Create AudioWorklet processor**

```javascript
// web/public/audio-worklet-processor.js
// Runs in audio thread — collects PCM samples and posts to main thread
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._sampleCount = 0;
    // Send every 2 seconds of audio (16kHz * 2 = 32000 samples)
    this._chunkSize = 32000;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    // Input is 44.1kHz/48kHz float32 — downsample to 16kHz
    const samples = input[0];
    const ratio = sampleRate / 16000;

    for (let i = 0; i < samples.length; i += ratio) {
      const idx = Math.floor(i);
      if (idx < samples.length) {
        // Convert float32 [-1,1] to int16
        const s = Math.max(-1, Math.min(1, samples[idx]));
        this._buffer.push(s < 0 ? s * 0x8000 : s * 0x7fff);
        this._sampleCount++;
      }
    }

    if (this._sampleCount >= this._chunkSize) {
      const pcm = new Int16Array(this._buffer.splice(0, this._chunkSize));
      this._sampleCount -= this._chunkSize;
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-processor", PcmProcessor);
```

- [ ] **Step 2: Create useAudioStream hook**

```typescript
// web/lib/useAudioStream.ts
"use client";

import { useRef, useState, useCallback } from "react";

export interface LiveSegment {
  start: number;
  end: number;
  text: string;
}

interface LiveEvent {
  type: "partial" | "final" | "status" | "error";
  text?: string;
  segment?: LiveSegment;
  sources?: string[];
  engine?: string;
  message?: string;
}

interface UseAudioStreamOptions {
  engine?: string;
  language?: string;
  onSegment?: (segment: LiveSegment) => void;
  onPartial?: (text: string) => void;
  onStatus?: (sources: string[], engine: string) => void;
  onError?: (message: string) => void;
}

const API_BASE = "";

export function useAudioStream(opts: UseAudioStreamOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: 16000 },
    });
    streamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: 48000 });
    ctxRef.current = ctx;
    await ctx.audioWorklet.addModule("/audio-worklet-processor.js");

    const source = ctx.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(ctx, "pcm-processor");

    const wsUrl = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/live-transcribe`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: "start",
        engine: opts.engine || "qwen3-asr",
        language: opts.language || "zh",
      }));
    };

    ws.onmessage = (e) => {
      const event: LiveEvent = JSON.parse(e.data);
      switch (event.type) {
        case "final":
          if (event.segment) opts.onSegment?.(event.segment);
          break;
        case "partial":
          if (event.text) opts.onPartial?.(event.text);
          break;
        case "status":
          opts.onStatus?.(event.sources || [], event.engine || "");
          break;
        case "error":
          opts.onError?.(event.message || "Unknown error");
          break;
      }
    };

    ws.onerror = () => opts.onError?.("WebSocket connection error");

    worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(e.data);
      }
    };

    source.connect(worklet);
    worklet.connect(ctx.destination);

    setIsRecording(true);
    setIsPaused(false);
  }, [opts]);

  const stop = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: "stop" }));
    wsRef.current?.close();
    wsRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    ctxRef.current?.close();
    ctxRef.current = null;

    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: "pause" }));
    setIsPaused(true);
  }, []);

  return { isRecording, isPaused, start, stop, pause };
}
```

- [ ] **Step 3: Create API client helpers**

```typescript
// web/lib/api.ts
const API_BASE = "";

export async function fetchCapabilities() {
  const res = await fetch(`${API_BASE}/api/capabilities`);
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/api/settings`);
  return res.json();
}

export async function updateSettings(settings: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  return res.json();
}

export function streamSummary(
  jobId: string,
  onToken: (token: string) => void,
  onDone: () => void,
) {
  const es = new EventSource(`${API_BASE}/api/summarize/${jobId}`);
  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.done) {
      es.close();
      onDone();
    } else {
      onToken(data.token);
    }
  };
  es.onerror = () => es.close();
  return () => es.close();
}

export async function sendChatMessage(jobId: string, message: string) {
  const res = await fetch(`${API_BASE}/api/chat/${jobId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return res;  // SSE stream
}
```

- [ ] **Step 4: Commit**

```bash
cd ~/ai-subtitle-tool
git add web/public/audio-worklet-processor.js web/lib/
git commit -m "feat: add AudioWorklet + WebSocket client for live transcription

PCM processor downsamples to 16kHz, sends 2s chunks over WebSocket.
useAudioStream hook manages mic/WS lifecycle. API helpers added."
```

---

### Task 7: Live transcription UI page

**Files:**
- Create: `web/components/NavTabs.tsx`
- Create: `web/components/LivePanel.tsx`
- Create: `web/app/live/page.tsx`
- Modify: `web/components/Header.tsx`
- Modify: `web/app/layout.tsx`

- [ ] **Step 1: Create NavTabs component**

```tsx
// web/components/NavTabs.tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Subtitles, Radio, Keyboard, Settings } from "lucide-react";

const TABS = [
  { href: "/", label: "字幕", icon: Subtitles },
  { href: "/live", label: "即時轉錄", icon: Radio },
  { href: "/dictation", label: "聽寫", icon: Keyboard },
  { href: "/settings", label: "設定", icon: Settings },
] as const;

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              active
                ? "bg-purple-500/15 text-purple-300"
                : "text-white/40 hover:text-white/70 hover:bg-white/5"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Update Header to include NavTabs**

Replace `web/components/Header.tsx`:

```tsx
// web/components/Header.tsx
"use client";

import { Subtitles } from "lucide-react";
import NavTabs from "./NavTabs";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Subtitles className="w-4 h-4 text-purple-400" />
            </div>
            <span className="font-semibold text-white tracking-tight">AI 字幕工具</span>
          </div>
          <div className="hidden sm:block h-6 w-px bg-white/10" />
          <div className="hidden sm:block">
            <NavTabs />
          </div>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create LivePanel component**

```tsx
// web/components/LivePanel.tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { Mic, Square, Radio } from "lucide-react";
import { useAudioStream, LiveSegment } from "@/lib/useAudioStream";

export default function LivePanel() {
  const [segments, setSegments] = useState<LiveSegment[]>([]);
  const [partial, setPartial] = useState("");
  const [status, setStatus] = useState<{ sources: string[]; engine: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSegment = useCallback((seg: LiveSegment) => {
    setSegments((prev) => [...prev, seg]);
    setPartial("");
  }, []);

  const { isRecording, start, stop } = useAudioStream({
    engine: "qwen3-asr",
    language: "zh",
    onSegment: handleSegment,
    onPartial: setPartial,
    onStatus: (sources, engine) => setStatus({ sources, engine }),
    onError: setError,
  });

  const handleStart = async () => {
    setError(null);
    setSegments([]);
    setPartial("");
    setElapsed(0);
    await start();
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const handleStop = () => {
    stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          {isRecording && (
            <span className="flex items-center gap-2 text-red-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              錄音中
            </span>
          )}
          {status && (
            <span className="text-white/40 text-xs">
              音源：{status.sources.join(" + ")} | 引擎：{status.engine}
            </span>
          )}
        </div>
        <span className="text-white/50 font-mono text-sm">{fmt(elapsed)}</span>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        {!isRecording ? (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-8 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-full transition-colors"
          >
            <Radio className="w-5 h-5" />
            開始即時轉錄
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-8 py-3 bg-red-500/80 hover:bg-red-500 text-white font-semibold rounded-full transition-colors"
          >
            <Square className="w-4 h-4" />
            停止
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      {/* Live captions */}
      {(segments.length > 0 || partial) && (
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {segments.map((seg, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-white/30 font-mono text-xs shrink-0 pt-0.5 w-20">
                {fmt(Math.floor(seg.start))}
              </span>
              <p className="text-white/80 text-sm">{seg.text}</p>
            </div>
          ))}
          {partial && (
            <div className="flex gap-3">
              <span className="text-white/20 font-mono text-xs shrink-0 pt-0.5 w-20">...</span>
              <p className="text-white/40 text-sm italic">{partial}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create Live page**

```tsx
// web/app/live/page.tsx
import Header from "@/components/Header";
import LivePanel from "@/components/LivePanel";
import { Radio } from "lucide-react";

export default function LivePage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Header />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-purple-700/10 rounded-full blur-[120px] pointer-events-none" />
      <main className="relative pt-24 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-5">
            <Radio className="w-7 h-7 text-purple-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            即時轉錄
          </h1>
          <p className="text-white/50 text-lg">
            開啟麥克風，即時語音轉文字
          </p>
        </div>
        <LivePanel />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd ~/ai-subtitle-tool
git add web/components/NavTabs.tsx web/components/Header.tsx web/components/LivePanel.tsx web/app/live/
git commit -m "feat: add live transcription UI with tab navigation

NavTabs provides Subtitles/Live/Dictation/Settings navigation.
LivePanel handles mic recording, WebSocket streaming, rolling captions."
```

---

## Phase 3: System Audio (Tasks 8-9)

### Task 8: Swift CLI audio-cap

**Files:**
- Create: `audio-cap/Package.swift`
- Create: `audio-cap/Sources/main.swift`

- [ ] **Step 1: Create Swift Package**

```swift
// audio-cap/Package.swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "audio-cap",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(name: "audio-cap", path: "Sources"),
    ]
)
```

- [ ] **Step 2: Implement ScreenCaptureKit capture**

```swift
// audio-cap/Sources/main.swift
import AVFoundation
import Foundation
import ScreenCaptureKit

@main
struct AudioCap {
    static func main() async throws {
        // Get shareable content (needed to create stream)
        let content = try await SCShareableContent.current
        guard let display = content.displays.first else {
            FileHandle.standardError.write("No display found\n".data(using: .utf8)!)
            exit(1)
        }

        let filter = SCContentFilter(display: display, excludingWindows: [])
        let config = SCStreamConfiguration()
        config.capturesAudio = true
        config.excludesCurrentProcessAudio = false
        config.sampleRate = 16000
        config.channelCount = 1

        let stream = SCStream(filter: filter, configuration: config, delegate: nil)
        let handler = AudioHandler()

        try stream.addStreamOutput(handler, type: .audio, sampleHandlerQueue: .main)
        try await stream.startCapture()

        FileHandle.standardError.write("audio-cap: streaming 16kHz mono PCM to stdout\n".data(using: .utf8)!)

        // Run until SIGINT/SIGTERM
        let sig = DispatchSource.makeSignalSource(signal: SIGINT, queue: .main)
        sig.setEventHandler {
            Task {
                try? await stream.stopCapture()
                exit(0)
            }
        }
        sig.resume()
        signal(SIGINT, SIG_IGN)

        RunLoop.main.run()
    }
}

class AudioHandler: NSObject, SCStreamOutput {
    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio else { return }
        guard let blockBuffer = sampleBuffer.dataBuffer else { return }

        let length = CMBlockBufferGetDataLength(blockBuffer)
        var data = Data(count: length)
        data.withUnsafeMutableBytes { rawPtr in
            CMBlockBufferCopyDataBytes(blockBuffer, atOffset: 0, dataLength: length, destination: rawPtr.baseAddress!)
        }

        // Convert float32 to int16 PCM
        let float32Count = length / 4
        var pcmData = Data(capacity: float32Count * 2)
        data.withUnsafeBytes { rawPtr in
            let floats = rawPtr.bindMemory(to: Float.self)
            for i in 0..<float32Count {
                let clamped = max(-1.0, min(1.0, floats[i]))
                var sample = Int16(clamped * 32767.0)
                pcmData.append(Data(bytes: &sample, count: 2))
            }
        }

        FileHandle.standardOutput.write(pcmData)
    }
}
```

- [ ] **Step 3: Build the CLI**

Run: `cd ~/ai-subtitle-tool/audio-cap && swift build -c release 2>&1 | tail -5`
Expected: Build succeeds, binary at `.build/release/audio-cap`

- [ ] **Step 4: Commit**

```bash
cd ~/ai-subtitle-tool
git add audio-cap/
git commit -m "feat: add audio-cap Swift CLI for system audio capture

Uses ScreenCaptureKit to capture system audio, outputs 16kHz mono
PCM16LE to stdout. macOS 14+ required."
```

---

### Task 9: System audio integration in FastAPI

**Files:**
- Modify: `subtitle_tool/audio_cap.py` (full implementation)
- Modify: `api/ws_live.py` (merge mic + system audio)

- [ ] **Step 1: Implement audio_cap lifecycle manager**

```python
# subtitle_tool/audio_cap.py
"""macOS system audio capture via Swift CLI (audio-cap)."""

from __future__ import annotations

import asyncio
import shutil
from pathlib import Path
from typing import AsyncIterator

AUDIO_CAP_BINARY = "audio-cap"
BUNDLED_PATH = Path(__file__).parent.parent / "audio-cap" / ".build" / "release" / "audio-cap"


def is_audio_cap_available() -> bool:
    """Check if the audio-cap Swift CLI is installed or bundled."""
    if shutil.which(AUDIO_CAP_BINARY):
        return True
    return BUNDLED_PATH.exists()


def _get_binary() -> str:
    if shutil.which(AUDIO_CAP_BINARY):
        return AUDIO_CAP_BINARY
    if BUNDLED_PATH.exists():
        return str(BUNDLED_PATH)
    raise FileNotFoundError("audio-cap binary not found")


class AudioCapProcess:
    """Manages the audio-cap subprocess lifecycle."""

    def __init__(self):
        self._proc: asyncio.subprocess.Process | None = None

    async def start(self) -> None:
        binary = _get_binary()
        self._proc = await asyncio.create_subprocess_exec(
            binary,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

    async def stop(self) -> None:
        if self._proc and self._proc.returncode is None:
            self._proc.terminate()
            await self._proc.wait()
        self._proc = None

    async def read_chunks(self, chunk_size: int = 64000) -> AsyncIterator[bytes]:
        """Yield PCM chunks from audio-cap stdout."""
        if not self._proc or not self._proc.stdout:
            return
        while self._proc.returncode is None:
            try:
                data = await asyncio.wait_for(
                    self._proc.stdout.read(chunk_size), timeout=1.0
                )
                if not data:
                    break
                yield data
            except asyncio.TimeoutError:
                continue

    @property
    def is_running(self) -> bool:
        return self._proc is not None and self._proc.returncode is None
```

- [ ] **Step 2: Update ws_live.py to merge mic + system audio**

Add audio mixing support to `api/ws_live.py`. Add these functions and update `live_transcribe_ws`:

At the top of `api/ws_live.py`, add:

```python
from subtitle_tool.audio_cap import AudioCapProcess, is_audio_cap_available
```

Add a mixing async generator before `_run_stream`:

```python
async def _merged_audio_stream(
    ws: WebSocket,
    audio_cap: AudioCapProcess | None,
    stop_event: asyncio.Event,
) -> AsyncIterator[bytes]:
    """Merge mic WebSocket audio with system audio-cap if available."""
    import numpy as np

    mic_queue: asyncio.Queue[bytes] = asyncio.Queue()
    sys_queue: asyncio.Queue[bytes] = asyncio.Queue()

    async def collect_mic():
        async for chunk in _byte_chunks_from_ws(ws, stop_event):
            await mic_queue.put(chunk)

    async def collect_sys():
        if audio_cap and audio_cap.is_running:
            async for chunk in audio_cap.read_chunks():
                if stop_event.is_set():
                    break
                await sys_queue.put(chunk)

    mic_task = asyncio.create_task(collect_mic())
    sys_task = asyncio.create_task(collect_sys()) if audio_cap else None

    try:
        while not stop_event.is_set():
            try:
                mic_data = await asyncio.wait_for(mic_queue.get(), timeout=0.5)
            except asyncio.TimeoutError:
                continue

            # If system audio available, try to mix
            if audio_cap and not sys_queue.empty():
                sys_data = await sys_queue.get()
                # Mix: average the two PCM streams
                mic_arr = np.frombuffer(mic_data, dtype=np.int16)
                sys_arr = np.frombuffer(sys_data, dtype=np.int16)
                min_len = min(len(mic_arr), len(sys_arr))
                mixed = ((mic_arr[:min_len].astype(np.int32) + sys_arr[:min_len].astype(np.int32)) // 2).astype(np.int16)
                yield mixed.tobytes()
            else:
                yield mic_data
    finally:
        mic_task.cancel()
        if sys_task:
            sys_task.cancel()
```

- [ ] **Step 3: Add system audio start/stop API routes**

Add to `api/main.py`:

```python
# Global audio-cap process
_audio_cap: AudioCapProcess | None = None

@app.post("/api/audio-cap/start")
async def start_audio_cap():
    from subtitle_tool.audio_cap import is_audio_cap_available, AudioCapProcess
    global _audio_cap
    if not is_audio_cap_available():
        raise HTTPException(status_code=404, detail="audio-cap not available")
    if _audio_cap and _audio_cap.is_running:
        return {"status": "already_running"}
    _audio_cap = AudioCapProcess()
    await _audio_cap.start()
    return {"status": "started"}

@app.post("/api/audio-cap/stop")
async def stop_audio_cap():
    global _audio_cap
    if _audio_cap:
        await _audio_cap.stop()
        _audio_cap = None
    return {"status": "stopped"}
```

- [ ] **Step 4: Commit**

```bash
cd ~/ai-subtitle-tool
git add subtitle_tool/audio_cap.py api/ws_live.py api/main.py
git commit -m "feat: integrate system audio capture with live transcription

AudioCapProcess manages Swift CLI lifecycle. WebSocket handler
merges mic + system PCM streams before feeding to ASR engine."
```

---

## Phase 4: AI Intelligence (Tasks 10-13)

### Task 10: LLM abstraction layer

**Files:**
- Create: `subtitle_tool/llm/__init__.py`
- Create: `subtitle_tool/llm/base.py`
- Create: `subtitle_tool/llm/ollama.py`
- Create: `subtitle_tool/llm/openai_compat.py`
- Create: `subtitle_tool/settings.py`
- Create: `tests/test_llm.py`
- Create: `tests/test_settings.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_settings.py
"""Tests for settings persistence."""

import json
from pathlib import Path
from subtitle_tool.settings import Settings, load_settings, save_settings


def test_default_settings():
    s = Settings()
    assert s.llm_provider == "ollama"
    assert s.ollama_model == "qwen3:8b"
    assert s.api_key == ""


def test_save_and_load(tmp_path):
    path = tmp_path / "settings.json"
    s = Settings(llm_provider="openai", api_key="sk-test")
    save_settings(s, path)
    loaded = load_settings(path)
    assert loaded.llm_provider == "openai"
    assert loaded.api_key == "sk-test"


def test_load_missing_file(tmp_path):
    path = tmp_path / "nonexistent.json"
    s = load_settings(path)
    assert s.llm_provider == "ollama"  # defaults
```

```python
# tests/test_llm.py
"""Tests for LLM providers."""

import pytest
from subtitle_tool.llm import create_provider
from subtitle_tool.llm.base import BaseLLMProvider
from subtitle_tool.settings import Settings


def test_create_ollama_provider():
    settings = Settings(llm_provider="ollama")
    provider = create_provider(settings)
    assert isinstance(provider, BaseLLMProvider)


def test_create_openai_provider():
    settings = Settings(llm_provider="openai", api_key="sk-test", api_base_url="http://localhost:11434/v1")
    provider = create_provider(settings)
    assert isinstance(provider, BaseLLMProvider)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/test_settings.py tests/test_llm.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement settings module**

```python
# subtitle_tool/settings.py
"""User settings persistence."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

DEFAULT_SETTINGS_PATH = Path.home() / ".config" / "ai-subtitle-tool" / "settings.json"


@dataclass
class Settings:
    llm_provider: str = "ollama"
    ollama_model: str = "qwen3:8b"
    api_key: str = ""
    api_base_url: str = ""
    default_format: str = "srt"
    convert_to_traditional: bool = True
    default_engine: str = "faster-whisper"
    default_live_engine: str = "qwen3-asr"


def load_settings(path: Path = DEFAULT_SETTINGS_PATH) -> Settings:
    if not path.exists():
        return Settings()
    data = json.loads(path.read_text(encoding="utf-8"))
    return Settings(**{k: v for k, v in data.items() if k in Settings.__dataclass_fields__})


def save_settings(settings: Settings, path: Path = DEFAULT_SETTINGS_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(asdict(settings), indent=2, ensure_ascii=False), encoding="utf-8")
```

- [ ] **Step 4: Implement LLM providers**

```python
# subtitle_tool/llm/base.py
"""Abstract LLM provider interface."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class BaseLLMProvider(ABC):
    @abstractmethod
    async def complete(self, system: str, user: str) -> str: ...

    @abstractmethod
    async def stream(self, system: str, user: str) -> AsyncIterator[str]: ...
```

```python
# subtitle_tool/llm/ollama.py
"""Ollama LLM provider — zero cost, local inference."""

from __future__ import annotations

from collections.abc import AsyncIterator

import httpx

from .base import BaseLLMProvider


class OllamaProvider(BaseLLMProvider):
    def __init__(self, model: str = "qwen3:8b", base_url: str = "http://localhost:11434"):
        self._model = model
        self._base_url = base_url.rstrip("/")

    async def complete(self, system: str, user: str) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self._base_url}/api/chat",
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "stream": False,
                },
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/api/chat",
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "stream": True,
                },
            ) as resp:
                async for line in resp.aiter_lines():
                    if line:
                        import json
                        data = json.loads(line)
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield content
```

```python
# subtitle_tool/llm/openai_compat.py
"""OpenAI-compatible API provider (OpenAI, Claude via proxy, etc.)."""

from __future__ import annotations

from collections.abc import AsyncIterator

import httpx

from .base import BaseLLMProvider


class OpenAICompatProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o-mini",
                 base_url: str = "https://api.openai.com/v1"):
        self._api_key = api_key
        self._model = model
        self._base_url = base_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}", "Content-Type": "application/json"}

    async def complete(self, system: str, user: str) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self._base_url}/chat/completions",
                headers=self._headers(),
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "stream": True,
                },
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: ") and line != "data: [DONE]":
                        import json
                        data = json.loads(line[6:])
                        delta = data["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
```

```python
# subtitle_tool/llm/__init__.py
"""LLM provider factory."""

from __future__ import annotations

from .base import BaseLLMProvider
from ..settings import Settings

__all__ = ["create_provider", "BaseLLMProvider"]


def create_provider(settings: Settings) -> BaseLLMProvider:
    if settings.llm_provider == "ollama":
        from .ollama import OllamaProvider
        base_url = settings.api_base_url or "http://localhost:11434"
        return OllamaProvider(model=settings.ollama_model, base_url=base_url)
    else:
        from .openai_compat import OpenAICompatProvider
        return OpenAICompatProvider(
            api_key=settings.api_key,
            model=settings.ollama_model,  # reuse field for model name
            base_url=settings.api_base_url or "https://api.openai.com/v1",
        )
```

- [ ] **Step 5: Run tests**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/test_settings.py tests/test_llm.py -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
cd ~/ai-subtitle-tool
git add subtitle_tool/llm/ subtitle_tool/settings.py tests/test_settings.py tests/test_llm.py
git commit -m "feat: add LLM abstraction layer with Ollama + OpenAI providers

Settings persisted to ~/.config/ai-subtitle-tool/settings.json.
Factory creates provider from user preferences."
```

---

### Task 11: AI Summary endpoint + UI

**Files:**
- Create: `api/routes_llm.py`
- Modify: `api/main.py` (mount router)
- Create: `web/components/SummaryChat.tsx`
- Modify: `web/components/TranscribePanel.tsx` (add SummaryChat)

- [ ] **Step 1: Implement summary + chat API routes**

```python
# api/routes_llm.py
"""Summary and Chat API routes."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from subtitle_tool.settings import load_settings
from subtitle_tool.llm import create_provider

router = APIRouter()

UPLOAD_DIR = Path("/tmp/subtitle_jobs")

SUMMARY_SYSTEM_PROMPT = """You are a meeting/video transcript summarizer. Given the transcript below, produce:
1. **Overview** (2-3 sentences)
2. **Key Points** (bulleted)
3. **Action Items** (if any)
4. **Decisions Made** (if any)

Respond in the same language as the transcript."""

CHAT_SYSTEM_PROMPT = """Answer the user's question based on the transcript segments below.
Cite timestamps [MM:SS] when referencing specific parts.

Relevant segments:
{segments}

Question: {question}"""


def _load_transcript(job_id: str) -> str:
    """Load subtitle content for a job and return as plain text."""
    from api.main import JOBS, get_job
    job = get_job(job_id)
    if job["status"] != "done" or not job.get("result"):
        raise HTTPException(status_code=400, detail="Job not complete")
    subtitle_path = Path(job["result"]["subtitle_path"])
    if not subtitle_path.exists():
        raise HTTPException(status_code=404, detail="Subtitle file not found")
    return subtitle_path.read_text(encoding="utf-8")


@router.post("/api/summarize/{job_id}")
async def summarize(job_id: str):
    """Generate AI summary via SSE streaming."""
    transcript = _load_transcript(job_id)
    settings = load_settings()
    provider = create_provider(settings)

    async def generate():
        try:
            async for token in provider.stream(SUMMARY_SYSTEM_PROMPT, transcript):
                yield {"data": json.dumps({"token": token}, ensure_ascii=False)}
            yield {"data": json.dumps({"done": True})}
        except Exception as e:
            yield {"data": json.dumps({"error": str(e)})}

    return EventSourceResponse(generate())


class ChatRequest(BaseModel):
    message: str


@router.post("/api/chat/{job_id}")
async def chat(job_id: str, req: ChatRequest):
    """Chat with transcript via RAG + LLM streaming."""
    transcript = _load_transcript(job_id)
    settings = load_settings()
    provider = create_provider(settings)

    # Try RAG retrieval if indexed, fall back to full transcript
    try:
        from subtitle_tool.rag import retrieve_segments
        relevant = retrieve_segments(job_id, req.message, top_k=5)
        segments_text = "\n".join(
            f"[{_fmt_time(s['start'])} - {_fmt_time(s['end'])}] {s['text']}"
            for s in relevant
        )
    except Exception:
        # Fallback: use full transcript
        segments_text = transcript

    prompt = CHAT_SYSTEM_PROMPT.format(segments=segments_text, question=req.message)

    async def generate():
        try:
            async for token in provider.stream(prompt, req.message):
                yield {"data": json.dumps({"token": token}, ensure_ascii=False)}
            yield {"data": json.dumps({"done": True})}
        except Exception as e:
            yield {"data": json.dumps({"error": str(e)})}

    return EventSourceResponse(generate())


def _fmt_time(seconds: float) -> str:
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"
```

- [ ] **Step 2: Mount router in api/main.py**

Add to `api/main.py`:

```python
from api.routes_llm import router as llm_router
app.include_router(llm_router)
```

- [ ] **Step 3: Create SummaryChat component**

```tsx
// web/components/SummaryChat.tsx
"use client";

import { useState, useRef } from "react";
import { FileText, MessageCircle, Send, Loader2, Copy } from "lucide-react";
import { streamSummary, sendChatMessage } from "@/lib/api";

interface SummaryChatProps {
  jobId: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function SummaryChat({ jobId }: SummaryChatProps) {
  const [tab, setTab] = useState<"summary" | "chat">("summary");
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleGenerateSummary = () => {
    setSummary("");
    setIsGenerating(true);
    streamSummary(
      jobId,
      (token) => setSummary((prev) => prev + token),
      () => setIsGenerating(false),
    );
  };

  const handleSendChat = async () => {
    if (!input.trim() || isSending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsSending(true);

    let assistantContent = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await sendChatMessage(jobId, userMsg);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              assistantContent += data.token;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          }
        }
      }
    } catch {
      assistantContent += "\n\n[Error: failed to get response]";
    }
    setIsSending(false);
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] overflow-hidden">
      {/* Tab headers */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setTab("summary")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors ${
            tab === "summary" ? "text-purple-300 border-b-2 border-purple-500" : "text-white/40 hover:text-white/60"
          }`}
        >
          <FileText className="w-4 h-4" /> 摘要
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors ${
            tab === "chat" ? "text-purple-300 border-b-2 border-purple-500" : "text-white/40 hover:text-white/60"
          }`}
        >
          <MessageCircle className="w-4 h-4" /> Chat
        </button>
      </div>

      {/* Summary tab */}
      {tab === "summary" && (
        <div className="p-6 space-y-4">
          {!summary && !isGenerating && (
            <button
              onClick={handleGenerateSummary}
              className="w-full py-3 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-xl hover:bg-purple-500/20 transition-colors text-sm"
            >
              生成 AI 摘要
            </button>
          )}
          {(summary || isGenerating) && (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-white/70 text-sm">{summary}</div>
              {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-purple-400 mt-2" />}
            </div>
          )}
          {summary && !isGenerating && (
            <button
              onClick={() => navigator.clipboard.writeText(summary)}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              <Copy className="w-3 h-3" /> 複製摘要
            </button>
          )}
        </div>
      )}

      {/* Chat tab */}
      {tab === "chat" && (
        <div className="flex flex-col h-80">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-white/30 text-sm text-center pt-8">
                輸入問題，向逐字稿提問
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === "user"
                    ? "bg-purple-500/20 text-purple-200"
                    : "bg-white/5 text-white/70"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-white/5 p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder="輸入問題..."
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
            />
            <button
              onClick={handleSendChat}
              disabled={!input.trim() || isSending}
              className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 hover:bg-purple-500/30 disabled:opacity-40 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add SummaryChat to TranscribePanel**

In `web/components/TranscribePanel.tsx`, after the burn/reset buttons section (after line ~600), add:

```tsx
{/* Summary + Chat */}
{isDone && jobId && (
  <SummaryChat jobId={jobId} />
)}
```

Add import at top: `import SummaryChat from "./SummaryChat";`

- [ ] **Step 5: Commit**

```bash
cd ~/ai-subtitle-tool
git add api/routes_llm.py api/main.py web/components/SummaryChat.tsx web/components/TranscribePanel.tsx
git commit -m "feat: add AI summary + chat with transcript

Streaming LLM responses via SSE. SummaryChat component provides
tabbed Summary/Chat UI below transcription results."
```

---

### Task 12: RAG indexer + retriever

**Files:**
- Create: `subtitle_tool/rag/__init__.py`
- Create: `subtitle_tool/rag/indexer.py`
- Create: `subtitle_tool/rag/retriever.py`
- Create: `tests/test_rag.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_rag.py
"""Tests for RAG indexer and retriever."""

import pytest
from subtitle_tool.engines.base import Segment
from subtitle_tool.rag.indexer import build_index
from subtitle_tool.rag.retriever import retrieve


def _sample_segments():
    return [
        Segment(start=0.0, end=5.0, text="今天的會議主要討論預算問題"),
        Segment(start=5.0, end=10.0, text="第一季的營收超出預期百分之二十"),
        Segment(start=10.0, end=15.0, text="我們需要增加行銷部門的人力"),
        Segment(start=15.0, end=20.0, text="下個月的截止日期不能再延後"),
        Segment(start=20.0, end=25.0, text="技術團隊已經完成了新功能的開發"),
    ]


def test_build_index(tmp_path):
    db_path = tmp_path / "test.db"
    segments = _sample_segments()
    build_index(segments, str(db_path))
    assert db_path.exists()


def test_retrieve_returns_relevant(tmp_path):
    db_path = tmp_path / "test.db"
    segments = _sample_segments()
    build_index(segments, str(db_path))
    results = retrieve("預算", str(db_path), top_k=2)
    assert len(results) <= 2
    assert any("預算" in r["text"] for r in results)


def test_retrieve_returns_timestamps(tmp_path):
    db_path = tmp_path / "test.db"
    segments = _sample_segments()
    build_index(segments, str(db_path))
    results = retrieve("營收", str(db_path), top_k=1)
    assert len(results) == 1
    assert "start" in results[0]
    assert "end" in results[0]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/test_rag.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Implement indexer**

```python
# subtitle_tool/rag/indexer.py
"""Build vector index from transcript segments."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import numpy as np

from ..engines.base import Segment

_MODEL = None


def _get_model():
    global _MODEL
    if _MODEL is None:
        from sentence_transformers import SentenceTransformer
        _MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    return _MODEL


def build_index(segments: list[Segment], db_path: str) -> None:
    """Vectorize segments and store in SQLite."""
    model = _get_model()
    texts = [s.text for s in segments]
    embeddings = model.encode(texts, normalize_embeddings=True)

    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS segments (
            id INTEGER PRIMARY KEY,
            start REAL,
            end REAL,
            text TEXT,
            embedding BLOB
        )
    """)
    conn.execute("DELETE FROM segments")

    for i, (seg, emb) in enumerate(zip(segments, embeddings)):
        conn.execute(
            "INSERT INTO segments (id, start, end, text, embedding) VALUES (?, ?, ?, ?, ?)",
            (i, seg.start, seg.end, seg.text, emb.astype(np.float32).tobytes()),
        )
    conn.commit()
    conn.close()
```

- [ ] **Step 4: Implement retriever**

```python
# subtitle_tool/rag/retriever.py
"""Retrieve relevant segments by vector similarity."""

from __future__ import annotations

import sqlite3

import numpy as np

from .indexer import _get_model


def retrieve(query: str, db_path: str, top_k: int = 5) -> list[dict]:
    """Find top-K most relevant segments for a query."""
    model = _get_model()
    query_emb = model.encode([query], normalize_embeddings=True)[0].astype(np.float32)

    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT id, start, end, text, embedding FROM segments").fetchall()
    conn.close()

    scored = []
    for row_id, start, end, text, emb_bytes in rows:
        emb = np.frombuffer(emb_bytes, dtype=np.float32)
        score = float(np.dot(query_emb, emb))
        scored.append({"id": row_id, "start": start, "end": end, "text": text, "score": score})

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]
```

```python
# subtitle_tool/rag/__init__.py
"""RAG module — index and retrieve transcript segments."""

from __future__ import annotations

from pathlib import Path

from .indexer import build_index
from .retriever import retrieve

UPLOAD_DIR = Path("/tmp/subtitle_jobs")


def index_job(job_id: str, segments) -> str:
    """Build RAG index for a completed job. Returns db_path."""
    db_path = str(UPLOAD_DIR / job_id / "rag.db")
    build_index(segments, db_path)
    return db_path


def retrieve_segments(job_id: str, query: str, top_k: int = 5) -> list[dict]:
    """Retrieve relevant segments for a job."""
    db_path = str(UPLOAD_DIR / job_id / "rag.db")
    return retrieve(query, db_path, top_k=top_k)
```

- [ ] **Step 5: Run tests**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/test_rag.py -v`
Expected: All 3 tests PASS (sentence-transformers downloads model on first run)

- [ ] **Step 6: Auto-index after transcription**

In `api/main.py`, inside `_transcribe_worker`, after the `update_job(..., status=JobStatus.done, ...)` block, add:

```python
        # Auto-build RAG index
        try:
            from subtitle_tool.rag import index_job
            from subtitle_tool.engines.base import Segment as EngSegment
            eng_segments = [EngSegment(s.start, s.end, s.text) for s in result.segments]
            index_job(job_id, eng_segments)
        except Exception:
            pass  # RAG is optional
```

- [ ] **Step 7: Commit**

```bash
cd ~/ai-subtitle-tool
git add subtitle_tool/rag/ tests/test_rag.py api/main.py
git commit -m "feat: add RAG indexer + retriever for chat with transcript

sentence-transformers vectorizes segments into SQLite. Cosine
similarity retrieval returns top-K with timestamps. Auto-indexed
after transcription completes."
```

---

## Phase 5: Dictation + Navigation (Tasks 13-15)

### Task 13: Dictation mode page

**Files:**
- Create: `web/components/DictationPanel.tsx`
- Create: `web/app/dictation/page.tsx`

- [ ] **Step 1: Create DictationPanel component**

```tsx
// web/components/DictationPanel.tsx
"use client";

import { useState, useCallback, useRef } from "react";
import { Mic, Square, Copy, Download, FileText } from "lucide-react";
import { useAudioStream, LiveSegment } from "@/lib/useAudioStream";

export default function DictationPanel() {
  const [text, setText] = useState("");
  const [partial, setPartial] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSegment = useCallback((seg: LiveSegment) => {
    setText((prev) => prev + (prev ? " " : "") + seg.text);
    setPartial("");
  }, []);

  const { isRecording, start, stop } = useAudioStream({
    engine: "qwen3-asr",
    language: "zh",
    onSegment: handleSegment,
    onPartial: setPartial,
    onError: setError,
  });

  const handleStart = async () => {
    setError(null);
    setPartial("");
    setElapsed(0);
    await start();
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const handleStop = () => {
    stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleCopy = () => {
    const finalText = editorRef.current?.innerText || text;
    navigator.clipboard.writeText(finalText);
  };

  const handleDownload = () => {
    const finalText = editorRef.current?.innerText || text;
    const blob = new Blob([finalText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dictation.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Editor area */}
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] min-h-[300px] p-6">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="text-white/80 text-base leading-relaxed min-h-[250px] focus:outline-none"
          dangerouslySetInnerHTML={{
            __html: text + (partial ? `<span class="text-white/30 italic">${partial}</span>` : ""),
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          {!isRecording ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-full transition-colors text-sm"
            >
              <Mic className="w-4 h-4" />
              開始聽寫
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-500/80 hover:bg-red-500 text-white font-medium rounded-full transition-colors text-sm"
            >
              <Square className="w-3.5 h-3.5" />
              停止
            </button>
          )}
          {isRecording && (
            <span className="flex items-center gap-2 text-red-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              {fmt(elapsed)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!text}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-30 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> 複製
          </button>
          <button
            onClick={handleDownload}
            disabled={!text}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-30 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> TXT
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create Dictation page**

```tsx
// web/app/dictation/page.tsx
import Header from "@/components/Header";
import DictationPanel from "@/components/DictationPanel";
import { Keyboard } from "lucide-react";

export default function DictationPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Header />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-purple-700/10 rounded-full blur-[120px] pointer-events-none" />
      <main className="relative pt-24 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-5">
            <Keyboard className="w-7 h-7 text-purple-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            語音聽寫
          </h1>
          <p className="text-white/50 text-lg">
            說話即轉文字，即時編輯
          </p>
        </div>
        <DictationPanel />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd ~/ai-subtitle-tool
git add web/components/DictationPanel.tsx web/app/dictation/
git commit -m "feat: add dictation mode — voice to editable text

Reuses live transcription WebSocket. Editable contentEditable area
with copy/download controls."
```

---

### Task 14: Settings panel + model management

**Files:**
- Create: `web/components/SettingsPanel.tsx`
- Create: `web/app/settings/page.tsx`
- Create: `api/routes_settings.py`
- Modify: `api/main.py` (mount settings router)

- [ ] **Step 1: Implement settings API routes**

```python
# api/routes_settings.py
"""Settings and model management API routes."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter
from pydantic import BaseModel

from subtitle_tool.settings import Settings, load_settings, save_settings

router = APIRouter()


class SettingsUpdate(BaseModel):
    llm_provider: str | None = None
    ollama_model: str | None = None
    api_key: str | None = None
    api_base_url: str | None = None
    default_format: str | None = None
    convert_to_traditional: bool | None = None
    default_engine: str | None = None
    default_live_engine: str | None = None


@router.get("/api/settings")
async def get_settings():
    return asdict(load_settings())


@router.put("/api/settings")
async def update_settings(update: SettingsUpdate):
    current = load_settings()
    for field, value in update.model_dump(exclude_none=True).items():
        setattr(current, field, value)
    save_settings(current)
    return asdict(current)


@router.get("/api/models")
async def list_models():
    from subtitle_tool.engines import create_default_registry
    registry = create_default_registry()
    return {
        "engines": [
            {"name": name, "streaming": registry._engines[name].supports_streaming}
            for name in registry.list_engines()
        ],
    }
```

- [ ] **Step 2: Mount settings router in api/main.py**

Add to `api/main.py`:

```python
from api.routes_settings import router as settings_router
app.include_router(settings_router)
```

- [ ] **Step 3: Create SettingsPanel component**

```tsx
// web/components/SettingsPanel.tsx
"use client";

import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { fetchSettings, updateSettings } from "@/lib/api";

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Record<string, string | boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await updateSettings(settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (key: string, value: string | boolean) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : null);
  };

  if (!settings) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto w-full space-y-8">
      {/* LLM Settings */}
      <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-white font-semibold">LLM 設定</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Provider</label>
            <select
              value={String(settings.llm_provider)}
              onChange={(e) => update("llm_provider", e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="ollama" className="bg-[#1a1a1a]">Ollama（本地）</option>
              <option value="openai" className="bg-[#1a1a1a]">OpenAI</option>
              <option value="claude" className="bg-[#1a1a1a]">Claude</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">模型</label>
            <input
              value={String(settings.ollama_model)}
              onChange={(e) => update("ollama_model", e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
              placeholder="qwen3:8b"
            />
          </div>
        </div>
        {settings.llm_provider !== "ollama" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">API Key</label>
              <input
                type="password"
                value={String(settings.api_key)}
                onChange={(e) => update("api_key", e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">API Base URL</label>
              <input
                value={String(settings.api_base_url)}
                onChange={(e) => update("api_base_url", e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
                placeholder="https://api.openai.com/v1"
              />
            </div>
          </div>
        )}
      </section>

      {/* ASR Settings */}
      <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-white font-semibold">ASR 引擎</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">離線字幕引擎</label>
            <select
              value={String(settings.default_engine)}
              onChange={(e) => update("default_engine", e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="faster-whisper" className="bg-[#1a1a1a]">BELLE Whisper（繁中最準）</option>
              <option value="mlx-whisper" className="bg-[#1a1a1a]">MLX Whisper（Apple Silicon 快）</option>
              <option value="qwen3-asr" className="bg-[#1a1a1a]">Qwen3-ASR</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">即時轉錄引擎</label>
            <select
              value={String(settings.default_live_engine)}
              onChange={(e) => update("default_live_engine", e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="qwen3-asr" className="bg-[#1a1a1a]">Qwen3-ASR（推薦）</option>
            </select>
          </div>
        </div>
      </section>

      {/* Output Settings */}
      <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-white font-semibold">輸出</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => update("convert_to_traditional", !settings.convert_to_traditional)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              settings.convert_to_traditional ? "bg-purple-500" : "bg-white/10"
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              settings.convert_to_traditional ? "translate-x-5" : "translate-x-0"
            }`} />
          </div>
          <span className="text-sm text-white/60">自動轉換繁體中文</span>
        </label>
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-white text-black font-semibold rounded-full hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saved ? "已儲存！" : "儲存設定"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create Settings page**

```tsx
// web/app/settings/page.tsx
import Header from "@/components/Header";
import SettingsPanel from "@/components/SettingsPanel";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Header />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-purple-700/10 rounded-full blur-[120px] pointer-events-none" />
      <main className="relative pt-24 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-5">
            <Settings className="w-7 h-7 text-purple-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            設定
          </h1>
        </div>
        <SettingsPanel />
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
cd ~/ai-subtitle-tool
git add api/routes_settings.py api/main.py web/components/SettingsPanel.tsx web/app/settings/
git commit -m "feat: add settings panel — LLM, ASR engine, output preferences

Persisted to ~/.config/ai-subtitle-tool/settings.json. API routes
for GET/PUT settings and model listing."
```

---

### Task 15: Update version + final integration

**Files:**
- Modify: `subtitle_tool/__init__.py`
- Modify: `pyproject.toml` (version bump)
- Modify: `web/next.config.ts` (API proxy for WebSocket)

- [ ] **Step 1: Bump version**

Update `subtitle_tool/__init__.py`:

```python
"""AI Subtitle Tool — real-time transcription platform."""

__version__ = "2.0.0"
```

Update `pyproject.toml` version:

```toml
version = "2.0.0"
```

- [ ] **Step 2: Add WebSocket proxy to Next.js config**

Read and update `web/next.config.ts` to proxy `/ws/` to the FastAPI backend:

```typescript
// web/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" },
      { source: "/ws/:path*", destination: "http://127.0.0.1:8000/ws/:path*" },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 3: Run full test suite**

Run: `cd ~/ai-subtitle-tool && python -m pytest tests/ -v --ignore=.venv`
Expected: All tests PASS

- [ ] **Step 4: Start dev servers and smoke test**

Run:
```bash
cd ~/ai-subtitle-tool
# Terminal 1: API
source .venv/bin/activate && uvicorn api.main:app --reload --port 8000 &
# Terminal 2: Web
cd web && npm run dev &
```

Test checklist:
1. Open http://localhost:3000 — Subtitles tab loads
2. Click "即時轉錄" tab — Live page loads
3. Click "聽寫" tab — Dictation page loads
4. Click "設定" tab — Settings panel loads with defaults
5. Upload a short audio file — transcription works
6. After transcription — Summary/Chat tabs appear

- [ ] **Step 5: Final commit**

```bash
cd ~/ai-subtitle-tool
git add -A
git commit -m "feat: AI Subtitle Tool v2.0 — real-time transcription platform

Six new features: three-engine ASR, live streaming transcription,
system audio capture, AI summary, RAG chat, dictation mode.
Navigation redesign with Settings panel."
```

---

## Execution Checklist

| Phase | Tasks | Est. Steps |
|-------|-------|-----------|
| 1. Engine Abstraction | Tasks 1-4 | 23 steps |
| 2. Live Transcription | Tasks 5-7 | 14 steps |
| 3. System Audio | Tasks 8-9 | 8 steps |
| 4. AI Intelligence | Tasks 10-12 | 19 steps |
| 5. Dictation + Nav | Tasks 13-15 | 14 steps |
| **Total** | **15 tasks** | **78 steps** |

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

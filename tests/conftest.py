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

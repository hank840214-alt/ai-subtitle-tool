# subtitle_tool/audio_cap.py
"""macOS system audio capture via Swift CLI (audio-cap)."""

from __future__ import annotations

import shutil


def is_audio_cap_available() -> bool:
    """Check if the audio-cap Swift CLI is installed."""
    return shutil.which("audio-cap") is not None

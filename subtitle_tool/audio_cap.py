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

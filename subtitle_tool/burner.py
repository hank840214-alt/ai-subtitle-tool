"""Burn subtitles into video using FFmpeg."""

from __future__ import annotations

import subprocess
from pathlib import Path


def burn_subtitles(
    video_path: str | Path,
    subtitle_path: str | Path,
    output_path: str | Path | None = None,
    font_name: str = "Noto Sans TC",
    font_size: int = 24,
) -> Path:
    """Burn SRT/ASS subtitles into video file.

    Args:
        video_path: Input video file.
        subtitle_path: SRT or ASS subtitle file.
        output_path: Output video path. Defaults to {input}_subtitled.mp4.
        font_name: Font for SRT rendering (ignored for ASS).
        font_size: Font size for SRT rendering (ignored for ASS).

    Returns:
        Path to output video.
    """
    video_path = Path(video_path)
    subtitle_path = Path(subtitle_path)

    if output_path is None:
        output_path = video_path.with_stem(f"{video_path.stem}_subtitled")
    output_path = Path(output_path)

    suffix = subtitle_path.suffix.lower()

    if suffix == ".ass":
        # ASS has its own styling
        vf = f"ass={subtitle_path}"
    else:
        # SRT — apply font settings via subtitles filter
        escaped = str(subtitle_path).replace(":", "\\:").replace("'", "\\'")
        vf = f"subtitles='{escaped}':force_style='FontName={font_name},FontSize={font_size}'"

    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-vf", vf,
        "-c:a", "copy",
        str(output_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed:\n{result.stderr[-500:]}")

    return output_path

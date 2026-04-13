"""Export segments to various subtitle formats (SRT, ASS, VTT, TXT)."""

from __future__ import annotations

from pathlib import Path

from .transcriber import Segment


def to_srt(segments: list[Segment]) -> str:
    """Convert segments to SRT format."""
    lines = []
    for i, seg in enumerate(segments, 1):
        lines.append(str(i))
        lines.append(f"{_fmt_time_srt(seg.start)} --> {_fmt_time_srt(seg.end)}")
        lines.append(seg.text)
        lines.append("")
    return "\n".join(lines)


def to_vtt(segments: list[Segment]) -> str:
    """Convert segments to WebVTT format."""
    lines = ["WEBVTT", ""]
    for seg in segments:
        lines.append(f"{_fmt_time_vtt(seg.start)} --> {_fmt_time_vtt(seg.end)}")
        lines.append(seg.text)
        lines.append("")
    return "\n".join(lines)


def to_ass(
    segments: list[Segment],
    font_name: str = "Noto Sans TC",
    font_size: int = 20,
) -> str:
    """Convert segments to ASS format with styling."""
    header = f"""[Script Info]
Title: AI Subtitle Tool
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,1,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"""

    events = []
    for seg in segments:
        start = _fmt_time_ass(seg.start)
        end = _fmt_time_ass(seg.end)
        text = seg.text.replace("\n", "\\N")
        events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")

    return header + "\n" + "\n".join(events) + "\n"


def to_txt(segments: list[Segment]) -> str:
    """Convert segments to plain text (no timestamps)."""
    return "\n".join(seg.text for seg in segments if seg.text) + "\n"


def save(content: str, output_path: str | Path) -> Path:
    """Write subtitle content to file."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


# --- Time formatting helpers ---

def _fmt_time_srt(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _fmt_time_vtt(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def _fmt_time_ass(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds % 1) * 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

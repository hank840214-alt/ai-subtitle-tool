"""CLI interface for AI Subtitle Tool."""

from __future__ import annotations

import time
from pathlib import Path

import click
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

from . import __version__

console = Console()

FORMATS = ["srt", "vtt", "ass", "txt"]


@click.group()
@click.version_option(__version__)
def main():
    """AI Subtitle Tool — accurate Traditional Chinese subtitle generator."""


@main.command()
@click.argument("input_file", type=click.Path(exists=True))
@click.option("-o", "--output", type=click.Path(), help="Output subtitle file path.")
@click.option("-f", "--format", "fmt", type=click.Choice(FORMATS), default="srt", help="Subtitle format.")
@click.option("-m", "--model", default=None, help="Whisper model ID. Default: BELLE-2/Belle-whisper-large-v3-zh-punct")
@click.option("-l", "--language", default="zh", help="Language code. 'zh' for Chinese, 'auto' for detection.")
@click.option("--no-traditional", is_flag=True, help="Skip simplified→traditional conversion.")
@click.option("--beam-size", default=5, help="Beam search size (1-10).")
@click.option("--device", default="auto", help="Device: auto, cpu, cuda.")
@click.option("--word-timestamps", is_flag=True, help="Generate word-level timestamps.")
def transcribe(
    input_file: str,
    output: str | None,
    fmt: str,
    model: str | None,
    language: str,
    no_traditional: bool,
    beam_size: int,
    device: str,
    word_timestamps: bool,
):
    """Transcribe audio/video to subtitles."""
    from .transcriber import Transcriber, DEFAULT_MODEL
    from . import formatter

    input_path = Path(input_file)
    model_id = model or DEFAULT_MODEL

    if language == "auto":
        language = None

    # Default output path
    if output is None:
        output = str(input_path.with_suffix(f".{fmt}"))

    console.print(f"[bold]AI Subtitle Tool v{__version__}[/bold]")
    console.print(f"  輸入: {input_path.name}")
    console.print(f"  模型: {model_id}")
    console.print(f"  語言: {language or '自動偵測'}")
    console.print(f"  繁體轉換: {'否' if no_traditional else '是 (s2twp)'}")
    console.print(f"  格式: {fmt.upper()}")
    console.print()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        # Load model
        task = progress.add_task("載入模型...", total=None)
        t0 = time.time()
        transcriber = Transcriber(
            model_id=model_id,
            device=device,
            convert_to_traditional=not no_traditional,
        )
        progress.update(task, description=f"模型載入完成 ({time.time() - t0:.1f}s)")
        progress.remove_task(task)

        # Transcribe
        task = progress.add_task("轉錄中...", total=None)
        t0 = time.time()
        result = transcriber.transcribe(
            input_path,
            language=language,
            beam_size=beam_size,
            word_timestamps=word_timestamps,
        )
        elapsed = time.time() - t0
        progress.update(task, description=f"轉錄完成 ({elapsed:.1f}s)")
        progress.remove_task(task)

    # Format output
    format_fn = {
        "srt": formatter.to_srt,
        "vtt": formatter.to_vtt,
        "ass": formatter.to_ass,
        "txt": formatter.to_txt,
    }[fmt]

    content = format_fn(result.segments)
    out_path = formatter.save(content, output)

    console.print()
    console.print(f"[green]✅ 字幕已儲存: {out_path}[/green]")
    console.print(f"  語言: {result.language} ({result.language_probability:.0%})")
    console.print(f"  段落數: {len(result.segments)}")
    console.print(f"  耗時: {elapsed:.1f}s")


@main.command()
@click.argument("video_file", type=click.Path(exists=True))
@click.argument("subtitle_file", type=click.Path(exists=True))
@click.option("-o", "--output", type=click.Path(), help="Output video path.")
@click.option("--font", default="Noto Sans TC", help="Font name for SRT.")
@click.option("--font-size", default=24, help="Font size for SRT.")
def burn(
    video_file: str,
    subtitle_file: str,
    output: str | None,
    font: str,
    font_size: int,
):
    """Burn subtitles into video file."""
    from .burner import burn_subtitles

    console.print(f"[bold]燒錄字幕到影片...[/bold]")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("燒錄中...", total=None)
        out = burn_subtitles(video_file, subtitle_file, output, font, font_size)
        progress.remove_task(task)

    console.print(f"[green]✅ 影片已儲存: {out}[/green]")


@main.command()
@click.argument("input_dir", type=click.Path(exists=True))
@click.option("-f", "--format", "fmt", type=click.Choice(FORMATS), default="srt")
@click.option("-m", "--model", default=None)
@click.option("--ext", default=".mp4,.mkv,.avi,.mov,.mp3,.wav,.m4a,.flac", help="File extensions to process.")
def batch(input_dir: str, fmt: str, model: str | None, ext: str):
    """Batch transcribe all media files in a directory."""
    from .transcriber import Transcriber, DEFAULT_MODEL
    from . import formatter

    extensions = {e.strip().lower() for e in ext.split(",")}
    dir_path = Path(input_dir)
    files = sorted(
        f for f in dir_path.iterdir()
        if f.suffix.lower() in extensions
    )

    if not files:
        console.print(f"[yellow]⚠️ 找不到媒體檔案 ({ext})[/yellow]")
        return

    console.print(f"[bold]批量轉錄: {len(files)} 個檔案[/bold]")

    model_id = model or DEFAULT_MODEL
    transcriber = Transcriber(model_id=model_id)
    format_fn = getattr(formatter, f"to_{fmt}")

    for i, f in enumerate(files, 1):
        console.print(f"\n[{i}/{len(files)}] {f.name}")
        try:
            result = transcriber.transcribe(f)
            content = format_fn(result.segments)
            out = formatter.save(content, f.with_suffix(f".{fmt}"))
            console.print(f"  [green]✅ {out.name} ({len(result.segments)} 段)[/green]")
        except Exception as e:
            console.print(f"  [red]❌ {e}[/red]")

    console.print(f"\n[bold green]批量完成！[/bold green]")

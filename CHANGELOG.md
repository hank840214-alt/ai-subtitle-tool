# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-04-13

### Added
- Docker Compose deployment (`docker compose up` one-liner)
- `Dockerfile.api` — Python/FastAPI image with FFmpeg
- `Dockerfile.web` — Next.js standalone image (multi-stage build)
- Cross-platform launcher scripts: `scripts/start.sh`, `scripts/start.bat`
- macOS double-click launcher: `scripts/AI Subtitle Tool.command`
- `API_URL` env var support in `next.config.ts` for Docker networking
- Hugging Face model cache persisted via Docker named volume
- `sse-starlette` and `yt-dlp` added to `[web]` extras in `pyproject.toml`

## [0.2.5] - 2026-04-13

### Added
- Waveform visualiser in Web UI
- 3-step usage guide overlay
- URL upload via yt-dlp (YouTube and other video sources)

## [0.2.0] - 2026-04-13

### Added
- FastAPI backend with SSE job progress streaming
- Next.js 16 web frontend with drag-and-drop upload
- Real-time transcription progress bar
- Download subtitle file from browser
- Burn subtitles to MP4 from browser

## [0.1.0] - 2026-04-13

### Added
- `subtitle transcribe` — transcribe video/audio to SRT/VTT/ASS/TXT
- `subtitle burn` — burn subtitle file into MP4 via FFmpeg
- `subtitle batch` — batch-process a folder of video files
- BELLE-whisper-large-v3-zh-punct as default model
- OpenCC s2twp post-processing for Taiwan Traditional Chinese vocabulary
- VAD-based chunking for unlimited video length

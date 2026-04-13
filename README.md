# AI Subtitle Tool

> AI-powered subtitle generator optimized for **Traditional Chinese** accuracy.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://python.org)
[![Model](https://img.shields.io/badge/Model-BELLE--whisper-purple.svg)](https://huggingface.co/BELLE-2/Belle-whisper-large-v3-zh-punct)

---

## Features

| | |
|---|---|
| 🎯 **Best zh-TW accuracy** | BELLE-whisper fine-tuned model + OpenCC s2twp (Taiwan vocabulary) |
| 🎬 **Unlimited length** | VAD-based automatic segmentation |
| 📦 **Multiple formats** | SRT / VTT / ASS / TXT |
| 🔥 **Subtitle burn-in** | Export MP4 with hardcoded subtitles via FFmpeg |
| 📂 **Batch processing** | Process entire folders at once |
| 🔒 **100% offline** | All computation local — no API keys, no cloud uploads |
| 🌐 **Web UI** | Drag-and-drop interface with real-time progress |
| 🔗 **URL upload** | Paste any YouTube / video URL to transcribe directly |

---

## Quick Start

### Option A — Docker (recommended)

```bash
git clone https://github.com/your-username/ai-subtitle-tool
cd ai-subtitle-tool
docker compose up
```

Open **http://localhost:3000** — done. Whisper models download on first use and are cached in a Docker volume.

### Option B — Local launcher

**macOS / Linux:**
```bash
git clone https://github.com/your-username/ai-subtitle-tool
cd ai-subtitle-tool
./scripts/start.sh
```

**Windows:**
```bat
scripts\start.bat
```

Or double-click **`scripts/AI Subtitle Tool.command`** on macOS (requires allowing in System Settings → Privacy).

### Option C — CLI only

```bash
git clone https://github.com/your-username/ai-subtitle-tool
cd ai-subtitle-tool
python -m venv .venv && source .venv/bin/activate
pip install -e .
subtitle transcribe video.mp4
```

---

## CLI Usage

```bash
# Basic transcription (outputs video.srt)
subtitle transcribe video.mp4

# Choose format and language
subtitle transcribe video.mp4 -f ass -l auto

# Batch process a folder
subtitle batch ./videos/

# Burn subtitles into video
subtitle burn video.mp4 video.srt
```

---

## Web UI

Start with `./scripts/start.sh` or Docker, then open http://localhost:3000.

- Drag-and-drop video / audio files
- Paste a YouTube or video URL
- Choose output format and model
- Real-time transcription progress
- Download subtitle file or burn to MP4

---

## Architecture

```
Video/Audio
    │
    ▼
FFmpeg decode
    │
    ▼
faster-whisper          ← BELLE-whisper-large-v3-zh-punct (default)
(VAD chunking)          ← large-v3-turbo (fast fallback)
    │
    ▼
OpenCC s2twp            ← Simplified → Traditional Chinese (Taiwan vocab)
    │
    ▼
SRT / VTT / ASS / TXT
```

**API server:** FastAPI + uvicorn (port 8000)  
**Web frontend:** Next.js 16 (port 3000)  
**Job management:** In-memory store with SSE progress streaming

---

## Development

```bash
# Backend (Python 3.12)
python -m venv .venv && source .venv/bin/activate
pip install -e ".[web]"
uvicorn api.main:app --reload

# Frontend
cd web && npm install && npm run dev
```

---

## Why BELLE-whisper?

Standard Whisper outputs Simplified Chinese and often mixes in English for proper nouns. BELLE-whisper is fine-tuned on Mandarin speech with punctuation, producing cleaner Simplified Chinese that OpenCC then converts to Taiwan Traditional Chinese vocabulary (s2twp) — outperforming Whisper large-v3 by 24–65% on zh benchmarks.

---

## Roadmap

- [x] Phase 1: CLI tool
- [x] Phase 2: Web UI (FastAPI + Next.js)
- [x] Phase 2.5: Waveform editor, URL upload, 3-step guide
- [x] Phase 3: Docker deployment + cross-platform launcher
- [ ] Real-world zh-TW accuracy benchmarks
- [ ] GPU acceleration guide (CUDA / Metal)
- [ ] macOS native app (Tauri)

---

## License

MIT

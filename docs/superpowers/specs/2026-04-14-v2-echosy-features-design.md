# AI Subtitle Tool v2.0 Design Spec

> Echosy-inspired upgrade: 6 features transforming a batch subtitle tool into a real-time transcription platform.

**Date:** 2026-04-14
**Architecture:** Web + Native Helper (方案 B)
**Status:** Approved

---

## 1. Three-Engine ASR Architecture

### Directory Structure

```
subtitle_tool/
  engines/
    __init__.py            # EngineRegistry — discover + select engines
    base.py                # AbstractEngine interface
    faster_whisper_engine.py   # Existing BELLE/Whisper (batch only)
    qwen3_asr_engine.py        # Qwen3-ASR 0.6B/1.7B (batch + streaming)
    mlx_whisper_engine.py      # MLX Whisper (batch, Apple Silicon)
```

### Unified Interface

```python
class AbstractEngine:
    name: str
    supports_streaming: bool = False

    def transcribe(self, audio_path: str | Path, **opts) -> TranscribeResult:
        """Batch: full file -> full result."""

    async def stream(self, audio_chunks: AsyncIterator[bytes], **opts) -> AsyncIterator[Segment]:
        """Streaming: audio chunks -> live segments. Raises NotImplementedError if unsupported."""
        raise NotImplementedError
```

### Engine Capability Matrix

| Engine | Batch | Streaming | Best For |
|--------|-------|-----------|----------|
| faster-whisper (BELLE) | Yes | No | Traditional Chinese subtitle accuracy |
| Qwen3-ASR 0.6B | Yes | Yes (native) | Live transcription, low latency |
| Qwen3-ASR 1.7B | Yes | Yes (native) | Live transcription, higher quality |
| MLX Whisper | Yes | No | Apple Silicon accelerated batch |

### Auto-Selection Logic

- Live transcription -> Qwen3-ASR (only engine with streaming)
- Offline subtitles -> User choice, default BELLE (best zh-TW accuracy)
- Apple Silicon detected + no user preference -> suggest MLX Whisper for offline (faster)

### Model Management

- Models stored in `~/.cache/ai-subtitle-tool/models/`
- Settings UI shows installed models with download/delete buttons
- First-use triggers model download with progress indicator

---

## 2. Live Transcription + System Audio

### Data Flow

```
Browser Mic (WebRTC)          macOS System Audio
navigator.mediaDevices        Swift CLI (audio-cap)
AudioWorklet -> PCM 16kHz     ScreenCaptureKit -> PCM 16kHz
       |                              |
       v                              v
    WebSocket                    stdin pipe
       |                              |
       +--------- FastAPI ------------+
                     |
              AudioMixer (merge sources)
                     |
              Qwen3-ASR stream()
                     |
              WebSocket response
                     |
                  Web UI
           (rolling captions + timestamps)
```

### WebSocket Protocol (`/ws/live-transcribe`)

Client -> Server:
```
binary frame: PCM 16kHz mono, 2-second chunks
JSON frame:   { "action": "start" | "pause" | "stop", "engine": "qwen3-asr-0.6b", "language": "zh" }
```

Server -> Client:
```json
{ "type": "partial", "text": "today we discussed..." }
{ "type": "final", "segment": { "start": 12.3, "end": 15.1, "text": "..." } }
{ "type": "status", "sources": ["mic", "system"], "engine": "qwen3-asr-0.6b" }
{ "type": "error", "message": "..." }
```

### Swift CLI: `audio-cap`

- ~120 lines Swift, uses `SCStreamConfiguration`
- Captures system audio, outputs 16kHz mono PCM16LE to stdout
- FastAPI manages lifecycle via `asyncio.create_subprocess_exec`
- API control: `POST /api/audio-cap/start`, `POST /api/audio-cap/stop`
- Compiled binary distributed alongside the tool (or built via `swift build`)

### Degradation

- No Swift CLI (Docker/Linux) -> mic-only mode, UI shows "System audio unavailable"
- Auto-detected at startup via `/api/capabilities` endpoint

---

## 3. AI Summary

### LLM Abstraction

```
subtitle_tool/
  llm/
    __init__.py          # LLMProvider factory
    ollama.py            # Default, zero cost
    openai_compat.py     # OpenAI / Claude / any compatible API
```

```python
class LLMProvider:
    async def complete(self, system: str, user: str) -> str: ...
    async def stream(self, system: str, user: str) -> AsyncIterator[str]: ...
```

### User Configuration

```json
{
  "llm_provider": "ollama",
  "ollama_model": "qwen3:8b",
  "api_key": "",
  "api_base_url": ""
}
```

Settings persisted to `~/.config/ai-subtitle-tool/settings.json`.

### Summary Flow

1. Transcription completes -> "Generate Summary" button appears
2. All segments concatenated into transcript text
3. System prompt: structured summary extraction (key points, action items, decisions)
4. LLM streams response -> displayed in Summary tab
5. Summary downloadable as Markdown

### Summary System Prompt Template

```
You are a meeting/video transcript summarizer. Given the transcript below, produce:
1. **Overview** (2-3 sentences)
2. **Key Points** (bulleted)
3. **Action Items** (if any)
4. **Decisions Made** (if any)

Respond in the same language as the transcript.

Transcript:
{transcript}
```

---

## 4. Chat with Transcript (RAG)

### Components

```
subtitle_tool/
  rag/
    __init__.py
    indexer.py           # segments -> vectors + SQLite
    retriever.py         # query -> top-K segments -> LLM
```

### Indexing

- Embedding model: `all-MiniLM-L6-v2` (22MB, via `sentence-transformers`)
- Storage: SQLite table `segments(id, start, end, text, embedding BLOB)`
- Index built automatically after transcription completes
- Stored alongside job data in job directory

### Query Flow

1. User asks question in Chat tab
2. Query vectorized -> cosine similarity search -> top-5 segments
3. Prompt assembled: retrieved segments (with timestamps) + user question
4. LLM responds with answer citing timestamps
5. Frontend: clickable timestamps jump to waveform editor position

### Chat System Prompt Template

```
Answer the user's question based on the transcript segments below.
Cite timestamps [MM:SS] when referencing specific parts.

Relevant segments:
{segments_with_timestamps}

Question: {user_question}
```

### API

```
POST /api/chat/{job_id}
Body: { "message": "What budget was discussed?" }
Response: SSE stream of LLM response tokens
```

---

## 5. Dictation Mode

### Behavior

- Dedicated "Dictation" tab in Web UI navigation
- Reuses `/ws/live-transcribe` WebSocket (same streaming ASR pipeline)
- Difference from Live Transcription:
  - No SRT timeline generation
  - Output is editable plain text (contentEditable div)
  - `type: "final"` segments append to text editor
  - User can edit text in real-time between utterances

### UI Layout

```
+----------------------------------------------+
| Text Editor (contentEditable)                |
| Editable real-time text accumulation         |
| "Today we need to discuss three topics..."   |
| "First is the budget issue█"                 |
+----------------------------------------------+
| [Record] [Pause] [Stop]         00:03:42     |
| Language: [Chinese v]  Engine: [Qwen3 v]     |
| [x] Auto-punctuation  [x] Traditional        |
+----------------------------------------------+
| [Copy All] [Download TXT] [Generate Summary] |
+----------------------------------------------+
```

### Post-Recording Actions

- Copy All: clipboard API
- Download TXT: client-side file generation
- Generate Summary: reuses the AI Summary flow (sends accumulated text to LLM)

---

## 6. Web UI Navigation Redesign

### New Header

```
+--------------------------------------------------------+
| AI Subtitle Tool   [Subtitles] [Live] [Dictation] [Settings] |
+--------------------------------------------------------+
```

| Tab | Content |
|-----|---------|
| Subtitles | Existing functionality (upload -> transcribe -> edit -> download -> burn) |
| Live | Mic + system audio live transcription -> captions -> summary/chat |
| Dictation | Voice -> editable text |
| Settings | LLM config, model management, audio source selection |

### Settings Panel Sections

| Section | Content |
|---------|---------|
| ASR Models | Installed models list + one-click download |
| LLM | Provider selector + model name + API key |
| Audio | Microphone picker + system audio toggle (requires audio-cap) |
| Output | Default format + Traditional Chinese toggle |

### Results Area (shared by Subtitles + Live tabs)

```
[Subtitle Preview] [Waveform Editor]
[Summary Tab | Chat Tab]
[Download] [Burn]
```

---

## 7. New Dependencies

### Python (pyproject.toml additions)

```toml
[project.optional-dependencies]
live = [
    "websockets>=12.0",
    "sentence-transformers>=3.0",
    "numpy>=1.26",
    "httpx>=0.27",            # Ollama HTTP client
]
```

### Qwen3-ASR options (pick one at install time)

- `qwen3-asr-vllm`: vLLM backend (GPU, full streaming)
- `qwen3-asr-c`: antirez/qwen-asr C implementation (CPU, lightweight)

### MLX Whisper

- `mlx-whisper>=0.4` (Apple Silicon only, optional)

### Swift CLI

- Built separately: `cd audio-cap && swift build -c release`
- Binary placed in `~/.local/bin/audio-cap` or bundled with tool

---

## 8. API Endpoints (New)

| Method | Path | Purpose |
|--------|------|---------|
| WS | `/ws/live-transcribe` | Streaming transcription WebSocket |
| POST | `/api/audio-cap/start` | Start system audio capture |
| POST | `/api/audio-cap/stop` | Stop system audio capture |
| GET | `/api/capabilities` | Report available engines + audio-cap presence |
| POST | `/api/summarize/{job_id}` | Generate AI summary (SSE response) |
| POST | `/api/chat/{job_id}` | Chat with transcript (SSE response) |
| GET | `/api/settings` | Get user settings |
| PUT | `/api/settings` | Update user settings |
| GET | `/api/models` | List available/downloaded models |
| POST | `/api/models/{model_id}/download` | Trigger model download |
| DELETE | `/api/models/{model_id}` | Delete downloaded model |

---

## 9. Out of Scope (YAGNI)

- Speaker diarization (pyannote) — future version
- Video recording via webcam — not a subtitle tool concern
- Mobile app — Web UI is responsive enough
- Windows/Linux system audio — macOS only for now
- Real-time translation — transcription only

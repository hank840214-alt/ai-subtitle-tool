# Contributing

## Setup

```bash
git clone https://github.com/your-username/ai-subtitle-tool
cd ai-subtitle-tool
python -m venv .venv && source .venv/bin/activate
pip install -e ".[web]"
cd web && npm install
```

## Running locally

```bash
# Terminal 1 — API
uvicorn api.main:app --reload

# Terminal 2 — Web
cd web && npm run dev
```

## Project structure

```
ai-subtitle-tool/
├── subtitle_tool/      # Core Python library (transcriber, formatter, burner, cli)
├── api/                # FastAPI backend
│   ├── main.py         # Routes + background workers
│   └── models.py       # Pydantic schemas
├── web/                # Next.js frontend
│   ├── app/            # App Router pages
│   └── components/     # React components
├── scripts/            # Platform launchers
├── Dockerfile.api
├── Dockerfile.web
└── docker-compose.yml
```

## Submitting changes

1. Fork the repo and create a feature branch
2. Make your changes with clear commit messages
3. Test both CLI and Web UI paths
4. Open a pull request — describe what changed and why

## Model notes

- Default model: `BELLE-2/Belle-whisper-large-v3-zh-punct` (~3 GB, downloads on first use)
- Fast fallback: `large-v3-turbo` (~1.5 GB)
- Models cache in `~/.cache/huggingface/` (or the Docker volume `huggingface_cache`)

## Reporting issues

Please include:
- OS and Python version
- The command or UI action that failed
- Full error output

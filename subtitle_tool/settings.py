"""User settings persistence."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path

DEFAULT_SETTINGS_PATH = Path.home() / ".config" / "ai-subtitle-tool" / "settings.json"


@dataclass
class Settings:
    llm_provider: str = "ollama"
    ollama_model: str = "qwen3:8b"
    api_key: str = ""
    api_base_url: str = ""
    default_format: str = "srt"
    convert_to_traditional: bool = True
    default_engine: str = "faster-whisper"
    default_live_engine: str = "qwen3-asr"


def load_settings(path: Path = DEFAULT_SETTINGS_PATH) -> Settings:
    if not path.exists():
        return Settings()
    data = json.loads(path.read_text(encoding="utf-8"))
    return Settings(**{k: v for k, v in data.items() if k in Settings.__dataclass_fields__})


def save_settings(settings: Settings, path: Path = DEFAULT_SETTINGS_PATH) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(asdict(settings), indent=2, ensure_ascii=False), encoding="utf-8")

"""Settings and model management API routes."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter
from pydantic import BaseModel

from subtitle_tool.settings import Settings, load_settings, save_settings

router = APIRouter()


class SettingsUpdate(BaseModel):
    llm_provider: str | None = None
    ollama_model: str | None = None
    api_key: str | None = None
    api_base_url: str | None = None
    default_format: str | None = None
    convert_to_traditional: bool | None = None
    default_engine: str | None = None
    default_live_engine: str | None = None


@router.get("/api/settings")
async def get_settings():
    return asdict(load_settings())


@router.put("/api/settings")
async def update_settings(update: SettingsUpdate):
    current = load_settings()
    for field, value in update.model_dump(exclude_none=True).items():
        setattr(current, field, value)
    save_settings(current)
    return asdict(current)


@router.get("/api/models")
async def list_models():
    from subtitle_tool.engines import create_default_registry
    registry = create_default_registry()
    return {
        "engines": [
            {"name": name, "streaming": registry._engines[name].supports_streaming}
            for name in registry.list_engines()
        ],
    }

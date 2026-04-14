"""LLM provider factory."""

from __future__ import annotations

from .base import BaseLLMProvider
from ..settings import Settings

__all__ = ["create_provider", "BaseLLMProvider"]


def create_provider(settings: Settings) -> BaseLLMProvider:
    if settings.llm_provider == "ollama":
        from .ollama import OllamaProvider
        base_url = settings.api_base_url or "http://localhost:11434"
        return OllamaProvider(model=settings.ollama_model, base_url=base_url)
    else:
        from .openai_compat import OpenAICompatProvider
        return OpenAICompatProvider(
            api_key=settings.api_key,
            model=settings.ollama_model,
            base_url=settings.api_base_url or "https://api.openai.com/v1",
        )

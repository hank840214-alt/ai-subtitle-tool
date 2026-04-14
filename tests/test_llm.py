"""Tests for LLM providers."""

import pytest
from subtitle_tool.llm import create_provider
from subtitle_tool.llm.base import BaseLLMProvider
from subtitle_tool.settings import Settings


def test_create_ollama_provider():
    settings = Settings(llm_provider="ollama")
    provider = create_provider(settings)
    assert isinstance(provider, BaseLLMProvider)


def test_create_openai_provider():
    settings = Settings(llm_provider="openai", api_key="sk-test", api_base_url="http://localhost:11434/v1")
    provider = create_provider(settings)
    assert isinstance(provider, BaseLLMProvider)

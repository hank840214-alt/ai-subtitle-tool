"""Tests for settings persistence."""

from subtitle_tool.settings import Settings, load_settings, save_settings


def test_default_settings():
    s = Settings()
    assert s.llm_provider == "ollama"
    assert s.ollama_model == "qwen3:8b"
    assert s.api_key == ""


def test_save_and_load(tmp_path):
    path = tmp_path / "settings.json"
    s = Settings(llm_provider="openai", api_key="sk-test")
    save_settings(s, path)
    loaded = load_settings(path)
    assert loaded.llm_provider == "openai"
    assert loaded.api_key == "sk-test"


def test_load_missing_file(tmp_path):
    path = tmp_path / "nonexistent.json"
    s = load_settings(path)
    assert s.llm_provider == "ollama"

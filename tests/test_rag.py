"""Tests for RAG indexer and retriever."""

import pytest
from subtitle_tool.engines.base import Segment
from subtitle_tool.rag.indexer import build_index
from subtitle_tool.rag.retriever import retrieve


def _sample_segments():
    return [
        Segment(start=0.0, end=5.0, text="今天的會議主要討論預算問題"),
        Segment(start=5.0, end=10.0, text="第一季的營收超出預期百分之二十"),
        Segment(start=10.0, end=15.0, text="我們需要增加行銷部門的人力"),
        Segment(start=15.0, end=20.0, text="下個月的截止日期不能再延後"),
        Segment(start=20.0, end=25.0, text="技術團隊已經完成了新功能的開發"),
    ]


def test_build_index(tmp_path):
    db_path = tmp_path / "test.db"
    segments = _sample_segments()
    build_index(segments, str(db_path))
    assert db_path.exists()


def test_retrieve_returns_relevant(tmp_path):
    db_path = tmp_path / "test.db"
    segments = _sample_segments()
    build_index(segments, str(db_path))
    results = retrieve("預算", str(db_path), top_k=2)
    assert len(results) <= 2
    assert any("預算" in r["text"] for r in results)


def test_retrieve_returns_timestamps(tmp_path):
    db_path = tmp_path / "test.db"
    segments = _sample_segments()
    build_index(segments, str(db_path))
    results = retrieve("營收", str(db_path), top_k=1)
    assert len(results) == 1
    assert "start" in results[0]
    assert "end" in results[0]

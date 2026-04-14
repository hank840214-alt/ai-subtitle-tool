"""RAG module — index and retrieve transcript segments."""

from __future__ import annotations

from pathlib import Path

from .indexer import build_index
from .retriever import retrieve

UPLOAD_DIR = Path("/tmp/subtitle_jobs")


def index_job(job_id: str, segments) -> str:
    """Build RAG index for a completed job. Returns db_path."""
    db_path = str(UPLOAD_DIR / job_id / "rag.db")
    build_index(segments, db_path)
    return db_path


def retrieve_segments(job_id: str, query: str, top_k: int = 5) -> list[dict]:
    """Retrieve relevant segments for a job."""
    db_path = str(UPLOAD_DIR / job_id / "rag.db")
    return retrieve(query, db_path, top_k=top_k)

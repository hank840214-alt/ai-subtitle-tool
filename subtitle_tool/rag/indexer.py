"""Build vector index from transcript segments."""

from __future__ import annotations

import sqlite3

import numpy as np

from ..engines.base import Segment

_MODEL = None


def _get_model():
    global _MODEL
    if _MODEL is None:
        from sentence_transformers import SentenceTransformer
        _MODEL = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    return _MODEL


def build_index(segments: list[Segment], db_path: str) -> None:
    """Vectorize segments and store in SQLite."""
    model = _get_model()
    texts = [s.text for s in segments]
    embeddings = model.encode(texts, normalize_embeddings=True)

    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS segments (
            id INTEGER PRIMARY KEY,
            start REAL,
            end REAL,
            text TEXT,
            embedding BLOB
        )
    """)
    conn.execute("DELETE FROM segments")

    for i, (seg, emb) in enumerate(zip(segments, embeddings)):
        conn.execute(
            "INSERT INTO segments (id, start, end, text, embedding) VALUES (?, ?, ?, ?, ?)",
            (i, seg.start, seg.end, seg.text, emb.astype(np.float32).tobytes()),
        )
    conn.commit()
    conn.close()

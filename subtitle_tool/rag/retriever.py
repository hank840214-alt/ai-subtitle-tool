"""Retrieve relevant segments by vector similarity."""

from __future__ import annotations

import sqlite3

import numpy as np

from .indexer import _get_model


def retrieve(query: str, db_path: str, top_k: int = 5) -> list[dict]:
    """Find top-K most relevant segments for a query."""
    model = _get_model()
    query_emb = model.encode([query], normalize_embeddings=True)[0].astype(np.float32)

    conn = sqlite3.connect(db_path)
    rows = conn.execute("SELECT id, start, end, text, embedding FROM segments").fetchall()
    conn.close()

    scored = []
    for row_id, start, end, text, emb_bytes in rows:
        emb = np.frombuffer(emb_bytes, dtype=np.float32)
        score = float(np.dot(query_emb, emb))
        scored.append({"id": row_id, "start": start, "end": end, "text": text, "score": score})

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]

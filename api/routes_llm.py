"""Summary and Chat API routes."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from subtitle_tool.settings import load_settings
from subtitle_tool.llm import create_provider

router = APIRouter()

UPLOAD_DIR = Path("/tmp/subtitle_jobs")

SUMMARY_SYSTEM_PROMPT = """You are a meeting/video transcript summarizer. Given the transcript below, produce:
1. **Overview** (2-3 sentences)
2. **Key Points** (bulleted)
3. **Action Items** (if any)
4. **Decisions Made** (if any)

Respond in the same language as the transcript."""

CHAT_SYSTEM_PROMPT = """Answer the user's question based on the transcript segments below.
Cite timestamps [MM:SS] when referencing specific parts.

Relevant segments:
{segments}

Question: {question}"""


def _load_transcript(job_id: str) -> str:
    """Load subtitle content for a job and return as plain text."""
    from api.main import JOBS, get_job
    job = get_job(job_id)
    if job["status"] != "done" or not job.get("result"):
        raise HTTPException(status_code=400, detail="Job not complete")
    subtitle_path = Path(job["result"]["subtitle_path"])
    if not subtitle_path.exists():
        raise HTTPException(status_code=404, detail="Subtitle file not found")
    return subtitle_path.read_text(encoding="utf-8")


@router.post("/api/summarize/{job_id}")
async def summarize(job_id: str):
    """Generate AI summary via SSE streaming."""
    transcript = _load_transcript(job_id)
    settings = load_settings()
    provider = create_provider(settings)

    async def generate():
        try:
            async for token in provider.stream(SUMMARY_SYSTEM_PROMPT, transcript):
                yield {"data": json.dumps({"token": token}, ensure_ascii=False)}
            yield {"data": json.dumps({"done": True})}
        except Exception as e:
            yield {"data": json.dumps({"error": str(e)})}

    return EventSourceResponse(generate())


class ChatRequest(BaseModel):
    message: str


@router.post("/api/chat/{job_id}")
async def chat(job_id: str, req: ChatRequest):
    """Chat with transcript via RAG + LLM streaming."""
    transcript = _load_transcript(job_id)
    settings = load_settings()
    provider = create_provider(settings)

    try:
        from subtitle_tool.rag import retrieve_segments
        relevant = retrieve_segments(job_id, req.message, top_k=5)
        segments_text = "\n".join(
            f"[{_fmt_time(s['start'])} - {_fmt_time(s['end'])}] {s['text']}"
            for s in relevant
        )
    except Exception:
        segments_text = transcript

    prompt = CHAT_SYSTEM_PROMPT.format(segments=segments_text, question=req.message)

    async def generate():
        try:
            async for token in provider.stream(prompt, req.message):
                yield {"data": json.dumps({"token": token}, ensure_ascii=False)}
            yield {"data": json.dumps({"done": True})}
        except Exception as e:
            yield {"data": json.dumps({"error": str(e)})}

    return EventSourceResponse(generate())


def _fmt_time(seconds: float) -> str:
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"

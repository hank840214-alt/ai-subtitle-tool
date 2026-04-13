"""FastAPI backend wrapping the subtitle_tool CLI."""

from __future__ import annotations

import asyncio
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

# Add project root to path so subtitle_tool is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.models import (
    BurnResponse,
    JobResponse,
    JobStatus,
    ResultResponse,
    SubtitleFormat,
)

app = FastAPI(
    title="AI Subtitle Tool API",
    description="AI-powered subtitle generation with best Traditional Chinese accuracy",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory job store
# ---------------------------------------------------------------------------

JOBS: dict[str, dict[str, Any]] = {}
UPLOAD_DIR = Path("/tmp/subtitle_jobs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def get_job(job_id: str) -> dict[str, Any]:
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return JOBS[job_id]


def update_job(job_id: str, **kwargs: Any) -> None:
    JOBS[job_id].update(kwargs)


# ---------------------------------------------------------------------------
# Background transcription worker
# ---------------------------------------------------------------------------

def _transcribe_worker(
    job_id: str,
    file_path: Path,
    model: str,
    language: str | None,
    fmt: str,
    beam_size: int,
    convert_to_traditional: bool,
) -> None:
    """Runs in a background thread — updates JOBS as it progresses."""
    try:
        update_job(
            job_id,
            status=JobStatus.loading_model,
            message="載入模型中...",
            progress=0.1,
        )

        from subtitle_tool.transcriber import Transcriber
        from subtitle_tool import formatter

        transcriber = Transcriber(
            model_id=model,
            convert_to_traditional=convert_to_traditional,
        )

        update_job(
            job_id,
            status=JobStatus.transcribing,
            message="轉錄中，請稍候...",
            progress=0.4,
        )

        result = transcriber.transcribe(
            file_path,
            language=language,
            beam_size=beam_size,
        )

        update_job(job_id, progress=0.85, message="格式化字幕...")

        format_fn = {
            "srt": formatter.to_srt,
            "vtt": formatter.to_vtt,
            "ass": formatter.to_ass,
            "txt": formatter.to_txt,
        }[fmt]

        content = format_fn(result.segments)
        job_dir = UPLOAD_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        subtitle_path = job_dir / f"subtitle.{fmt}"
        subtitle_path.write_text(content, encoding="utf-8")

        update_job(
            job_id,
            status=JobStatus.done,
            message="轉錄完成！",
            progress=1.0,
            result={
                "segments": len(result.segments),
                "language": result.language,
                "language_probability": result.language_probability,
                "subtitle_path": str(subtitle_path),
                "format": fmt,
            },
        )

    except Exception as exc:
        update_job(
            job_id,
            status=JobStatus.error,
            message="轉錄失敗",
            progress=0.0,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# Burn worker
# ---------------------------------------------------------------------------

def _burn_worker(job_id: str, burn_job_id: str) -> None:
    try:
        update_job(burn_job_id, status=JobStatus.burning, message="燒錄字幕中...", progress=0.3)

        from subtitle_tool.burner import burn_subtitles

        job = JOBS[job_id]
        video_path = Path(job["video_path"])
        subtitle_path = Path(job["result"]["subtitle_path"])
        out_path = UPLOAD_DIR / job_id / f"output_subtitled.mp4"

        burn_subtitles(
            video_path=video_path,
            subtitle_path=subtitle_path,
            output_path=out_path,
        )

        update_job(
            burn_job_id,
            status=JobStatus.done,
            message="燒錄完成！",
            progress=1.0,
            result={"output_path": str(out_path), "source_job_id": job_id},
        )

    except Exception as exc:
        update_job(
            burn_job_id,
            status=JobStatus.error,
            message="燒錄失敗",
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/api/transcribe", response_model=JobResponse, status_code=202)
async def transcribe(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model: str = Form("large-v3-turbo"),
    language: str = Form("zh"),
    format: str = Form("srt"),
    beam_size: int = Form(5),
    convert_to_traditional: bool = Form(True),
) -> JobResponse:
    """Upload a video/audio file and start transcription. Returns a job_id."""
    job_id = str(uuid.uuid4())
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    # Persist upload
    suffix = Path(file.filename or "upload").suffix or ".mp4"
    file_path = job_dir / f"input{suffix}"
    content = await file.read()
    file_path.write_bytes(content)

    lang = None if language in ("auto", "") else language

    JOBS[job_id] = {
        "job_id": job_id,
        "status": JobStatus.pending,
        "message": "等待處理...",
        "progress": 0.0,
        "error": None,
        "result": None,
        "video_path": str(file_path),
        "format": format,
    }

    thread = threading.Thread(
        target=_transcribe_worker,
        args=(job_id, file_path, model, lang, format, beam_size, convert_to_traditional),
        daemon=True,
    )
    thread.start()

    return JobResponse(
        job_id=job_id,
        status=JobStatus.pending,
        message="任務已建立，開始處理...",
    )


@app.get("/api/status/{job_id}")
async def job_status_stream(job_id: str):
    """SSE stream of job progress. Emits events until done or error."""
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    async def event_generator():
        last_status = None
        while True:
            job = JOBS.get(job_id)
            if not job:
                break

            current_status = job["status"]
            # Always emit on status change or every poll
            data = {
                "status": job["status"],
                "message": job["message"],
                "progress": job["progress"],
            }
            if job.get("error"):
                data["error"] = job["error"]
            if job.get("result"):
                data["result"] = job["result"]

            yield {"data": __import__("json").dumps(data, ensure_ascii=False)}

            if current_status in (JobStatus.done, JobStatus.error):
                break

            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@app.get("/api/job/{job_id}", response_model=JobResponse)
async def get_job_status(job_id: str) -> JobResponse:
    """Get current job status (non-streaming)."""
    job = get_job(job_id)
    return JobResponse(
        job_id=job_id,
        status=job["status"],
        message=job["message"],
        progress=job["progress"],
        error=job.get("error"),
    )


@app.get("/api/result/{job_id}")
async def download_result(job_id: str, fmt: str | None = None):
    """Download the subtitle file for a completed job."""
    job = get_job(job_id)
    if job["status"] != JobStatus.done:
        raise HTTPException(status_code=400, detail="Job not complete yet")
    if not job.get("result"):
        raise HTTPException(status_code=404, detail="No result found")

    subtitle_path = Path(job["result"]["subtitle_path"])
    if not subtitle_path.exists():
        raise HTTPException(status_code=404, detail="Subtitle file not found")

    media_types = {
        "srt": "text/plain",
        "vtt": "text/vtt",
        "ass": "text/plain",
        "txt": "text/plain",
    }
    suffix = subtitle_path.suffix.lstrip(".")
    return FileResponse(
        path=str(subtitle_path),
        media_type=media_types.get(suffix, "text/plain"),
        filename=subtitle_path.name,
    )


@app.post("/api/burn/{job_id}", response_model=BurnResponse, status_code=202)
async def burn_subtitles(job_id: str) -> BurnResponse:
    """Burn subtitles from a completed transcription job into the original video."""
    job = get_job(job_id)
    if job["status"] != JobStatus.done:
        raise HTTPException(status_code=400, detail="Transcription job not complete yet")

    burn_job_id = str(uuid.uuid4())
    JOBS[burn_job_id] = {
        "job_id": burn_job_id,
        "status": JobStatus.pending,
        "message": "等待燒錄...",
        "progress": 0.0,
        "error": None,
        "result": None,
    }

    thread = threading.Thread(
        target=_burn_worker,
        args=(job_id, burn_job_id),
        daemon=True,
    )
    thread.start()

    return BurnResponse(
        job_id=burn_job_id,
        download_url=f"/api/result/{burn_job_id}/video",
    )


@app.get("/api/result/{job_id}/video")
async def download_video(job_id: str):
    """Download the burned video for a completed burn job."""
    job = get_job(job_id)
    if job["status"] != JobStatus.done:
        raise HTTPException(status_code=400, detail="Burn job not complete yet")
    if not job.get("result"):
        raise HTTPException(status_code=404, detail="No result found")

    out_path = Path(job["result"]["output_path"])
    if not out_path.exists():
        raise HTTPException(status_code=404, detail="Video file not found")

    return FileResponse(
        path=str(out_path),
        media_type="video/mp4",
        filename=out_path.name,
    )


@app.delete("/api/job/{job_id}")
async def delete_job(job_id: str) -> dict[str, str]:
    """Delete a job and clean up its files."""
    get_job(job_id)  # raises 404 if missing

    job_dir = UPLOAD_DIR / job_id
    if job_dir.exists():
        import shutil
        shutil.rmtree(job_dir, ignore_errors=True)

    del JOBS[job_id]
    return {"message": f"Job {job_id} deleted"}


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}

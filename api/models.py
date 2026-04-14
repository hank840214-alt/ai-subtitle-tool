"""Pydantic schemas for the subtitle API."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel


class JobStatus(str, Enum):
    pending = "pending"
    loading_model = "loading_model"
    transcribing = "transcribing"
    burning = "burning"
    done = "done"
    error = "error"


class SubtitleFormat(str, Enum):
    srt = "srt"
    vtt = "vtt"
    ass = "ass"
    txt = "txt"


class TranscribeRequest(BaseModel):
    model: str = "large-v3-turbo"
    language: str = "zh"
    format: SubtitleFormat = SubtitleFormat.srt
    beam_size: int = 5
    convert_to_traditional: bool = True


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str = ""
    progress: float = 0.0
    error: str | None = None


class ResultResponse(BaseModel):
    job_id: str
    format: str
    segments: int
    language: str
    language_probability: float


class BurnResponse(BaseModel):
    job_id: str
    download_url: str


class ProgressEvent(BaseModel):
    status: JobStatus
    message: str
    progress: float = 0.0
    data: dict[str, Any] | None = None


class LiveAction(str, Enum):
    start = "start"
    pause = "pause"
    stop = "stop"


class LiveControlMessage(BaseModel):
    action: LiveAction
    engine: str = "qwen3-asr"
    language: str = "zh"


class LiveSegmentEvent(BaseModel):
    type: str  # "partial" | "final" | "status" | "error"
    text: str | None = None
    segment: dict[str, Any] | None = None
    sources: list[str] | None = None
    engine: str | None = None
    message: str | None = None


class CapabilitiesResponse(BaseModel):
    engines: list[dict[str, Any]]
    audio_cap_available: bool
    llm_available: bool

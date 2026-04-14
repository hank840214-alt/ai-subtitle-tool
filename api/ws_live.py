"""WebSocket handler for live streaming transcription."""

from __future__ import annotations

import asyncio
import json
from typing import AsyncIterator

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

from subtitle_tool.engines import create_default_registry
from subtitle_tool.engines.base import Segment


async def _byte_chunks_from_ws(ws: WebSocket, stop_event: asyncio.Event) -> AsyncIterator[bytes]:
    """Yield binary PCM frames from WebSocket until stop."""
    while not stop_event.is_set():
        try:
            data = await asyncio.wait_for(ws.receive_bytes(), timeout=0.5)
            yield data
        except asyncio.TimeoutError:
            continue
        except WebSocketDisconnect:
            break


async def live_transcribe_ws(ws: WebSocket):
    """Handle a live transcription WebSocket session."""
    await ws.accept()
    registry = create_default_registry()
    stop_event = asyncio.Event()

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)

            if msg.get("action") == "start":
                engine_name = msg.get("engine", "qwen3-asr")
                language = msg.get("language", "zh")

                if engine_name not in registry.list_engines(streaming_only=True):
                    await ws.send_json({
                        "type": "error",
                        "message": f"Engine {engine_name} does not support streaming. "
                                   f"Available: {registry.list_engines(streaming_only=True)}",
                    })
                    continue

                engine_instance = registry.get(engine_name)
                stop_event.clear()

                await ws.send_json({
                    "type": "status",
                    "sources": ["mic"],
                    "engine": engine_name,
                })

                stream_task = asyncio.create_task(
                    _run_stream(ws, engine_instance, stop_event, language)
                )

                try:
                    while not stop_event.is_set():
                        try:
                            ctrl = await asyncio.wait_for(ws.receive_text(), timeout=0.3)
                            ctrl_msg = json.loads(ctrl)
                            if ctrl_msg.get("action") in ("stop", "pause"):
                                stop_event.set()
                        except asyncio.TimeoutError:
                            continue
                except WebSocketDisconnect:
                    stop_event.set()

                await stream_task

            elif msg.get("action") == "stop":
                stop_event.set()

    except WebSocketDisconnect:
        pass
    finally:
        stop_event.set()


async def _run_stream(ws, engine, stop_event, language):
    """Run the streaming engine and send results via WebSocket."""
    try:
        chunks = _byte_chunks_from_ws(ws, stop_event)
        async for segment in engine.stream(chunks, language=language):
            if ws.client_state != WebSocketState.CONNECTED:
                break
            await ws.send_json({
                "type": "final",
                "segment": {
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": segment.text,
                },
            })
    except Exception as e:
        if ws.client_state == WebSocketState.CONNECTED:
            await ws.send_json({"type": "error", "message": str(e)})

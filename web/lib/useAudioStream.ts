"use client";

import { useRef, useState, useCallback } from "react";

export interface LiveSegment {
  start: number;
  end: number;
  text: string;
}

interface LiveEvent {
  type: "partial" | "final" | "status" | "error";
  text?: string;
  segment?: LiveSegment;
  sources?: string[];
  engine?: string;
  message?: string;
}

interface UseAudioStreamOptions {
  engine?: string;
  language?: string;
  onSegment?: (segment: LiveSegment) => void;
  onPartial?: (text: string) => void;
  onStatus?: (sources: string[], engine: string) => void;
  onError?: (message: string) => void;
}

const API_BASE = "";

export function useAudioStream(opts: UseAudioStreamOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: 16000 },
    });
    streamRef.current = stream;

    const ctx = new AudioContext({ sampleRate: 48000 });
    ctxRef.current = ctx;
    await ctx.audioWorklet.addModule("/audio-worklet-processor.js");

    const source = ctx.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(ctx, "pcm-processor");

    const wsUrl = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws/live-transcribe`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: "start",
        engine: opts.engine || "qwen3-asr",
        language: opts.language || "zh",
      }));
    };

    ws.onmessage = (e) => {
      const event: LiveEvent = JSON.parse(e.data);
      switch (event.type) {
        case "final":
          if (event.segment) opts.onSegment?.(event.segment);
          break;
        case "partial":
          if (event.text) opts.onPartial?.(event.text);
          break;
        case "status":
          opts.onStatus?.(event.sources || [], event.engine || "");
          break;
        case "error":
          opts.onError?.(event.message || "Unknown error");
          break;
      }
    };

    ws.onerror = () => opts.onError?.("WebSocket connection error");

    worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(e.data);
      }
    };

    source.connect(worklet);
    worklet.connect(ctx.destination);

    setIsRecording(true);
    setIsPaused(false);
  }, [opts]);

  const stop = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: "stop" }));
    wsRef.current?.close();
    wsRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    ctxRef.current?.close();
    ctxRef.current = null;

    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ action: "pause" }));
    setIsPaused(true);
  }, []);

  return { isRecording, isPaused, start, stop, pause };
}

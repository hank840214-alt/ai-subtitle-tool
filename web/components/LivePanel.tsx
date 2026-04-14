"use client";

import { useState, useCallback, useRef } from "react";
import { Square, Radio } from "lucide-react";
import { useAudioStream, LiveSegment } from "@/lib/useAudioStream";

export default function LivePanel() {
  const [segments, setSegments] = useState<LiveSegment[]>([]);
  const [partial, setPartial] = useState("");
  const [status, setStatus] = useState<{ sources: string[]; engine: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSegment = useCallback((seg: LiveSegment) => {
    setSegments((prev) => [...prev, seg]);
    setPartial("");
  }, []);

  const { isRecording, start, stop } = useAudioStream({
    engine: "qwen3-asr",
    language: "zh",
    onSegment: handleSegment,
    onPartial: setPartial,
    onStatus: (sources, engine) => setStatus({ sources, engine }),
    onError: setError,
  });

  const handleStart = async () => {
    setError(null);
    setSegments([]);
    setPartial("");
    setElapsed(0);
    await start();
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const handleStop = () => {
    stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          {isRecording && (
            <span className="flex items-center gap-2 text-red-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              錄音中
            </span>
          )}
          {status && (
            <span className="text-white/40 text-xs">
              音源：{status.sources.join(" + ")} | 引擎：{status.engine}
            </span>
          )}
        </div>
        <span className="text-white/50 font-mono text-sm">{fmt(elapsed)}</span>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        {!isRecording ? (
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-8 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-full transition-colors"
          >
            <Radio className="w-5 h-5" />
            開始即時轉錄
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="flex items-center gap-2 px-8 py-3 bg-red-500/80 hover:bg-red-500 text-white font-semibold rounded-full transition-colors"
          >
            <Square className="w-4 h-4" />
            停止
          </button>
        )}
      </div>

      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      {/* Live captions */}
      {(segments.length > 0 || partial) && (
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {segments.map((seg, i) => (
            <div key={i} className="flex gap-3">
              <span className="text-white/30 font-mono text-xs shrink-0 pt-0.5 w-20">
                {fmt(Math.floor(seg.start))}
              </span>
              <p className="text-white/80 text-sm">{seg.text}</p>
            </div>
          ))}
          {partial && (
            <div className="flex gap-3">
              <span className="text-white/20 font-mono text-xs shrink-0 pt-0.5 w-20">...</span>
              <p className="text-white/40 text-sm italic">{partial}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

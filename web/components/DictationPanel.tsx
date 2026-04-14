"use client";

import { useState, useCallback, useRef } from "react";
import { Mic, Square, Copy, Download } from "lucide-react";
import { useAudioStream, LiveSegment } from "@/lib/useAudioStream";

export default function DictationPanel() {
  const [text, setText] = useState("");
  const [partial, setPartial] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSegment = useCallback((seg: LiveSegment) => {
    setText((prev) => prev + (prev ? " " : "") + seg.text);
    setPartial("");
  }, []);

  const { isRecording, start, stop } = useAudioStream({
    engine: "qwen3-asr",
    language: "zh",
    onSegment: handleSegment,
    onPartial: setPartial,
    onError: setError,
  });

  const handleStart = async () => {
    setError(null);
    setPartial("");
    setElapsed(0);
    await start();
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const handleStop = () => {
    stop();
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleCopy = () => {
    const finalText = editorRef.current?.innerText || text;
    navigator.clipboard.writeText(finalText);
  };

  const handleDownload = () => {
    const finalText = editorRef.current?.innerText || text;
    const blob = new Blob([finalText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dictation.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Editor area */}
      <div className="rounded-3xl border border-white/5 bg-white/[0.02] min-h-[300px] p-6">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          className="text-white/80 text-base leading-relaxed min-h-[250px] focus:outline-none"
          dangerouslySetInnerHTML={{
            __html: text + (partial ? `<span class="text-white/30 italic">${partial}</span>` : ""),
          }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          {!isRecording ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-full transition-colors text-sm"
            >
              <Mic className="w-4 h-4" />
              開始聽寫
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-500/80 hover:bg-red-500 text-white font-medium rounded-full transition-colors text-sm"
            >
              <Square className="w-3.5 h-3.5" />
              停止
            </button>
          )}
          {isRecording && (
            <span className="flex items-center gap-2 text-red-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              {fmt(elapsed)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            disabled={!text}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-30 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> 複製
          </button>
          <button
            onClick={handleDownload}
            disabled={!text}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 disabled:opacity-30 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> TXT
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
    </div>
  );
}

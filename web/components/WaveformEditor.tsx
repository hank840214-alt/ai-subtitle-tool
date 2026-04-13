"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Play, Pause, ZoomIn, ZoomOut } from "lucide-react";

export interface Segment {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface WaveformEditorProps {
  audioUrl: string;
  segments: Segment[];
  onSegmentsChange: (segments: Segment[]) => void;
}

const COLORS = [
  { bg: "rgba(147,51,234,0.25)", border: "rgba(147,51,234,0.8)" },
  { bg: "rgba(59,130,246,0.25)", border: "rgba(59,130,246,0.8)" },
  { bg: "rgba(16,185,129,0.25)", border: "rgba(16,185,129,0.8)" },
];

export default function WaveformEditor({
  audioUrl,
  segments,
  onSegmentsChange,
}: WaveformEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animFrameRef = useRef<number>(0);
  const waveformDataRef = useRef<Float32Array | null>(null);
  const durationRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [zoom, setZoom] = useState(1);

  // drag state
  const dragRef = useRef<{
    segId: string;
    edge: "start" | "end";
    startX: number;
    origTime: number;
  } | null>(null);

  // Decode audio and draw waveform
  const decodeAudio = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const resp = await fetch(audioUrl);
      const buf = await resp.arrayBuffer();
      const decoded = await ctx.decodeAudioData(buf);
      durationRef.current = decoded.duration;
      setDuration(decoded.duration);

      const raw = decoded.getChannelData(0);
      const samples = 1000;
      const blockSize = Math.floor(raw.length / samples);
      const data = new Float32Array(samples);
      for (let i = 0; i < samples; i++) {
        let max = 0;
        for (let j = 0; j < blockSize; j++) {
          const v = Math.abs(raw[i * blockSize + j]);
          if (v > max) max = v;
        }
        data[i] = max;
      }
      waveformDataRef.current = data;
      await ctx.close();
      drawAll(0);
    } catch {
      // fallback: draw empty waveform
      waveformDataRef.current = null;
      drawAll(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  useEffect(() => {
    decodeAudio();
  }, [decodeAudio]);

  const drawAll = useCallback(
    (playhead: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!canvas.parentElement) return;

      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = 120;
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      const dur = durationRef.current || 1;
      const visibleDur = dur / zoom;

      // Background
      ctx.fillStyle = "#111111";
      ctx.fillRect(0, 0, W, H);

      // Waveform bars
      const data = waveformDataRef.current;
      if (data) {
        const visibleStart = 0;
        const startIdx = Math.floor((visibleStart / dur) * data.length);
        const endIdx = Math.min(
          data.length,
          Math.ceil(((visibleStart + visibleDur) / dur) * data.length)
        );
        const count = endIdx - startIdx;
        const barW = Math.max(1, W / count);

        for (let i = 0; i < count; i++) {
          const amp = data[startIdx + i];
          const barH = amp * H * 0.85;
          const x = i * barW;
          const y = (H - barH) / 2;

          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.fillRect(x, y, barW - 0.5, barH);
        }
      } else {
        // placeholder
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(0, H / 2 - 1, W, 2);
      }

      // Segment blocks
      segments.forEach((seg, idx) => {
        const color = COLORS[idx % COLORS.length];
        const x1 = (seg.start / dur) * W * zoom;
        const x2 = (seg.end / dur) * W * zoom;
        const clamped1 = Math.max(0, Math.min(W, x1));
        const clamped2 = Math.max(0, Math.min(W, x2));
        const segW = clamped2 - clamped1;
        if (segW <= 0) return;

        // bg fill
        ctx.fillStyle = color.bg;
        ctx.fillRect(clamped1, 0, segW, H);

        // borders
        ctx.strokeStyle = color.border;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(clamped1, 0);
        ctx.lineTo(clamped1, H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(clamped2, 0);
        ctx.lineTo(clamped2, H);
        ctx.stroke();

        // drag handles
        ctx.fillStyle = color.border;
        ctx.fillRect(clamped1 - 3, H / 2 - 12, 6, 24);
        ctx.fillRect(clamped2 - 3, H / 2 - 12, 6, 24);

        // label
        if (segW > 40) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
          ctx.save();
          ctx.beginPath();
          ctx.rect(clamped1 + 4, 0, segW - 8, H);
          ctx.clip();
          ctx.fillText(seg.text, clamped1 + 6, H / 2 + 4);
          ctx.restore();
        }
      });

      // Playhead
      const ph = (playhead / dur) * W * zoom;
      if (ph >= 0 && ph <= W) {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ph, 0);
        ctx.lineTo(ph, H);
        ctx.stroke();

        // triangle
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.moveTo(ph - 6, 0);
        ctx.lineTo(ph + 6, 0);
        ctx.lineTo(ph, 10);
        ctx.closePath();
        ctx.fill();
      }
    },
    [segments, zoom]
  );

  // Animation loop
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const tick = () => {
      setCurrentTime(audio.currentTime);
      drawAll(audio.currentTime);
      animFrameRef.current = requestAnimationFrame(tick);
    };

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(animFrameRef.current);
      drawAll(audio.currentTime);
    }

    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, drawAll]);

  // Re-draw when segments/zoom change
  useEffect(() => {
    const audio = audioRef.current;
    drawAll(audio?.currentTime ?? 0);
  }, [segments, zoom, drawAll]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dur = durationRef.current || 1;
    const t = (x / canvas.width) * dur / zoom;
    audio.currentTime = Math.max(0, Math.min(dur, t));
    setCurrentTime(audio.currentTime);
    drawAll(audio.currentTime);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dur = durationRef.current || 1;
    const HANDLE_THRESH = 8;

    for (const seg of segments) {
      const x1 = (seg.start / dur) * canvas.width * zoom;
      const x2 = (seg.end / dur) * canvas.width * zoom;
      if (Math.abs(x - x1) < HANDLE_THRESH) {
        dragRef.current = { segId: seg.id, edge: "start", startX: x, origTime: seg.start };
        e.preventDefault();
        return;
      }
      if (Math.abs(x - x2) < HANDLE_THRESH) {
        dragRef.current = { segId: seg.id, edge: "end", startX: x, origTime: seg.end };
        e.preventDefault();
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !dragRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dur = durationRef.current || 1;
    const dx = x - dragRef.current.startX;
    const dt = (dx / canvas.width) * dur / zoom;
    const newTime = Math.max(0, Math.min(dur, dragRef.current.origTime + dt));

    onSegmentsChange(
      segments.map((seg) => {
        if (seg.id !== dragRef.current!.segId) return seg;
        if (dragRef.current!.edge === "start") {
          return { ...seg, start: Math.min(newTime, seg.end - 0.1) };
        }
        return { ...seg, end: Math.max(newTime, seg.start + 0.1) };
      })
    );
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  const fmt = (t: number) => {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1).padStart(4, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-[#111111] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <Play className="w-4 h-4 text-white" />
          )}
        </button>

        <span className="text-xs font-mono text-white/50">
          {fmt(currentTime)} / {fmt(duration)}
        </span>

        <div className="flex-1" />

        <span className="text-xs text-white/30">縮放</span>
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.5))}
          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5 text-white/60" />
        </button>
        <span className="text-xs text-white/50 w-8 text-center">{zoom}x</span>
        <button
          onClick={() => setZoom((z) => Math.min(8, z + 0.5))}
          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5 text-white/60" />
        </button>
      </div>

      {/* Canvas */}
      <div className="relative w-full overflow-x-auto">
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: 120, cursor: "pointer" }}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
        className="hidden"
      />

      {/* Segment list */}
      {segments.length > 0 && (
        <div className="border-t border-white/5 px-4 py-3 space-y-1 max-h-40 overflow-y-auto">
          {segments.map((seg, idx) => (
            <div key={seg.id} className="flex items-center gap-3 text-xs">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: COLORS[idx % COLORS.length].border }}
              />
              <span className="text-white/40 font-mono w-24 shrink-0">
                {fmt(seg.start)} → {fmt(seg.end)}
              </span>
              <span className="text-white/70 truncate">{seg.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

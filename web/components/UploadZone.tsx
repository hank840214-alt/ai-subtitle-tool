"use client";

import { useCallback, useState } from "react";
import { Upload, Film, Music, Link as LinkIcon, AlertCircle } from "lucide-react";

interface UploadZoneProps {
  onFile: (file: File) => void;
  onUrl?: (url: string) => void;
  disabled?: boolean;
}

const ACCEPTED = [
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska",
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/flac",
  "audio/ogg", "audio/aac",
];

const PLATFORMS = ["YouTube", "Bilibili", "TikTok", "抖音", "Twitter/X"];

function isValidUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function UploadZone({ onFile, onUrl, disabled }: UploadZoneProps) {
  const [tab, setTab] = useState<"file" | "url">("file");
  const [dragging, setDragging] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlError, setUrlError] = useState("");

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile, disabled]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  };

  const handleUrlSubmit = () => {
    if (!urlValue.trim()) {
      setUrlError("請輸入影片網址");
      return;
    }
    if (!isValidUrl(urlValue.trim())) {
      setUrlError("請輸入有效的 http/https 網址");
      return;
    }
    setUrlError("");
    onUrl?.(urlValue.trim());
  };

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/5 w-fit">
        {(["file", "url"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            disabled={disabled}
            className={`px-5 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              tab === t
                ? "bg-white/10 text-white shadow-sm"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            {t === "file" ? "檔案上傳" : "貼上網址"}
          </button>
        ))}
      </div>

      {/* File tab */}
      {tab === "file" && (
        <label
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`
            relative flex flex-col items-center justify-center min-h-[280px] rounded-3xl
            border-2 border-dashed transition-all cursor-pointer select-none
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            ${dragging
              ? "border-purple-400/60 bg-purple-500/10"
              : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20"
            }
          `}
        >
          <input
            type="file"
            accept={ACCEPTED.join(",")}
            className="sr-only"
            onChange={handleChange}
            disabled={disabled}
          />

          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
              <Film className="w-6 h-6 text-blue-400" />
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
              <Music className="w-6 h-6 text-purple-400" />
            </div>
          </div>

          <div className="text-center px-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Upload className="w-4 h-4 text-white/40" />
              <p className="text-white font-medium">
                {dragging ? "放開以上傳" : "拖曳或點擊上傳媒體檔案"}
              </p>
            </div>
            <p className="text-white/40 text-sm">
              支援 MP4、MOV、MKV、AVI、MP3、WAV、M4A、FLAC
            </p>
            <p className="text-white/25 text-xs mt-2">檔案在本機處理，不上傳至任何伺服器</p>
          </div>
        </label>
      )}

      {/* URL tab */}
      {tab === "url" && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
          {/* Supported platforms */}
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <span
                key={p}
                className="px-3 py-1 rounded-full border border-white/10 text-white/40 text-xs"
              >
                {p}
              </span>
            ))}
          </div>

          {/* URL input */}
          <div className="space-y-2">
            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
              <input
                type="url"
                value={urlValue}
                onChange={(e) => { setUrlValue(e.target.value); setUrlError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                placeholder="貼上 YouTube、抖音或其他影片網址..."
                disabled={disabled}
                className="w-full bg-white/[0.04] border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition-colors"
              />
            </div>
            {urlError && (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {urlError}
              </div>
            )}
          </div>

          <button
            onClick={handleUrlSubmit}
            disabled={disabled || !urlValue.trim()}
            className="w-full h-11 bg-white text-black font-semibold rounded-full hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.15)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            開始轉錄
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { Upload, Film, Music } from "lucide-react";

interface UploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED = [
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska",
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/flac",
  "audio/ogg", "audio/aac",
];

export default function UploadZone({ onFile, disabled }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);

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

  return (
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

      {/* Icons */}
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
  );
}

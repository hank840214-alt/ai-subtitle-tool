"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface SubtitlePreviewProps {
  content: string;
  format: string;
}

export default function SubtitlePreview({ content, format }: SubtitlePreviewProps) {
  const [copied, setCopied] = useState(false);

  const lines = content.split("\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-white/5 bg-[#111111] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <span className="text-xs text-white/40 font-mono uppercase tracking-wider">
          {format.toUpperCase()} 預覽
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors"
        >
          {copied ? (
            <><Check className="w-3.5 h-3.5 text-green-400" /> 已複製</>
          ) : (
            <><Copy className="w-3.5 h-3.5" /> 複製全部</>
          )}
        </button>
      </div>

      {/* Content with line numbers */}
      <div className="overflow-auto max-h-72 text-sm font-mono">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                <td className="select-none text-right text-white/20 pr-4 pl-4 py-0.5 w-10 text-xs border-r border-white/5">
                  {i + 1}
                </td>
                <td className="pl-4 pr-4 py-0.5 text-white/70 whitespace-pre-wrap break-all">
                  {line || "\u00A0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

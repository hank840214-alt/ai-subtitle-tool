"use client";

import Link from "next/link";
import { Subtitles, GitBranch, Heart } from "lucide-react";

const cols = [
  {
    title: "產品",
    links: [
      { label: "功能特色", href: "/#features" },
      { label: "使用情境", href: "/#workflow" },
      { label: "方案定價", href: "/#pricing" },
      { label: "開始使用", href: "/app" },
    ],
  },
  {
    title: "格式支援",
    links: [
      { label: "SRT 字幕", href: "/app" },
      { label: "WebVTT", href: "/app" },
      { label: "ASS 進階字幕", href: "/app" },
      { label: "純文字輸出", href: "/app" },
    ],
  },
  {
    title: "技術",
    links: [
      { label: "Faster Whisper", href: "https://github.com/SYSTRAN/faster-whisper" },
      { label: "BELLE 中文模型", href: "https://huggingface.co/BELLE-2" },
      { label: "OpenCC 繁簡轉換", href: "https://github.com/BYVoid/OpenCC" },
      { label: "FastAPI 後端", href: "https://fastapi.tiangolo.com" },
    ],
  },
  {
    title: "資源",
    links: [
      { label: "GitHub", href: "https://github.com" },
      { label: "問題回報", href: "https://github.com" },
      { label: "貢獻指南", href: "https://github.com" },
      { label: "授權條款 (MIT)", href: "https://github.com" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0A0A0A] pt-16 pb-8 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Top: logo + cols */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <Subtitles className="w-4 h-4 text-purple-400" />
              </div>
              <span className="font-semibold text-white">AI 字幕工具</span>
            </Link>
            <p className="text-white/40 text-sm leading-relaxed">
              最準確的繁體中文 AI 字幕生成工具，完全開源、完全免費。
            </p>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-white text-sm font-semibold mb-4">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-white/40 hover:text-white/80 text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/30 text-sm">
            © 2025 AI 字幕工具。MIT 授權，開放原始碼。
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/30 hover:text-white/60 transition-colors"
            >
              <GitBranch className="w-4 h-4" />
            </a>
            <span className="text-white/20 text-sm flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-red-500/60 inline" /> in Taiwan
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

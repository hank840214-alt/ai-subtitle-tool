"use client";

import { GitBranch, Subtitles } from "lucide-react";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Subtitles className="w-4 h-4 text-purple-400" />
          </div>
          <span className="font-semibold text-white tracking-tight">AI 字幕工具</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-white/40 hover:text-white/80 transition-colors"
          >
            <GitBranch className="w-5 h-5" />
          </a>
        </div>
      </div>
    </header>
  );
}

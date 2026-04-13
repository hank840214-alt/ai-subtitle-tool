"use client";

import Link from "next/link";
import { GitBranch, Subtitles } from "lucide-react";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Subtitles className="w-4 h-4 text-purple-400" />
          </div>
          <span className="font-semibold text-white tracking-tight">AI 字幕工具</span>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/#features" className="text-sm text-white/60 hover:text-white transition-colors">
            功能特色
          </Link>
          <Link href="/#workflow" className="text-sm text-white/60 hover:text-white transition-colors">
            使用情境
          </Link>
          <Link href="/#pricing" className="text-sm text-white/60 hover:text-white transition-colors">
            方案定價
          </Link>
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-white/40 hover:text-white/80 transition-colors"
          >
            <GitBranch className="w-5 h-5" />
          </a>
          <Link
            href="/app"
            className="h-9 px-5 bg-white text-black text-sm font-semibold rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            開始使用
          </Link>
        </div>
      </div>
    </header>
  );
}

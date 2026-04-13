"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-purple-800/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-sm mb-8">
          <Sparkles className="w-3.5 h-3.5" />
          繁體中文準確率業界第一
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
          <span className="text-white">AI 驅動的</span>
          <br />
          <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-blue-400 bg-clip-text text-transparent">
            精準字幕生成
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
          採用 BELLE fine-tuned Whisper 模型，針對繁體中文優化，支援長影片、多格式輸出，完全在本機離線運行，保護您的隱私。
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 h-12 px-8 bg-white text-black font-semibold rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            立即開始
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-2 h-12 px-8 bg-white/5 text-white font-semibold rounded-full border border-white/10 hover:bg-white/10 transition-colors"
          >
            了解更多
          </a>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto border-t border-white/5 pt-10">
          {[
            { value: "99%+", label: "繁體中文準確率" },
            { value: "4 種", label: "字幕格式支援" },
            { value: "100%", label: "本機離線運行" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-white/40">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

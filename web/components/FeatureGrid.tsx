"use client";

import { Languages, Clock, FileText, WifiOff } from "lucide-react";

const features = [
  {
    icon: Languages,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10",
    title: "繁體中文最準確",
    description:
      "採用 BELLE fine-tuned Whisper large-v3 模型，搭配 OpenCC s2twp 轉換，繁體中文字幕準確率遠超通用模型，連口語詞彙與台灣用語都能正確辨識。",
  },
  {
    icon: Clock,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
    title: "長影片完整支援",
    description:
      "內建 VAD（語音活動偵測）自動過濾靜音片段，有效處理數小時的長影片、演講、課程錄影，不漏字、不跳段。",
  },
  {
    icon: FileText,
    iconColor: "text-green-400",
    iconBg: "bg-green-500/10",
    title: "多格式輸出",
    description:
      "一鍵輸出 SRT、WebVTT、ASS（帶樣式）、純文字四種格式，相容 YouTube、Final Cut Pro、Premiere Pro、DaVinci Resolve 等主流平台。",
  },
  {
    icon: WifiOff,
    iconColor: "text-orange-400",
    iconBg: "bg-orange-500/10",
    title: "完全離線運行",
    description:
      "所有運算在本機完成，不上傳任何影片或音訊到雲端伺服器。敏感會議、課程內容、個人影片都能安心處理，隱私零外洩。",
  },
];

export default function FeatureGrid() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            為繁體中文用戶打造
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            不是通用工具的後期修補，而是從一開始就針對繁中精準度設計
          </p>
        </div>

        {/* 2×2 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-3xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] p-8 transition-colors"
              >
                <div
                  className={`w-12 h-12 rounded-2xl ${f.iconBg} flex items-center justify-center mb-5`}
                >
                  <Icon className={`w-6 h-6 ${f.iconColor}`} />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{f.title}</h3>
                <p className="text-white/50 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

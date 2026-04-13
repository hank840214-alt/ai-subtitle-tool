"use client";

import { Globe, Flame, Layers, Scissors } from "lucide-react";

const workflows = [
  {
    icon: Globe,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
    tag: "多語言",
    title: "字幕翻譯",
    description:
      "先生成繁中字幕，再搭配翻譯工具輸出英、日、韓等多語版本。SRT/VTT 格式相容所有翻譯平台，讓你的影片觸達全球觀眾。",
  },
  {
    icon: Flame,
    iconColor: "text-red-400",
    iconBg: "bg-red-500/10",
    tag: "一鍵完成",
    title: "燒錄影片",
    description:
      "字幕生成後一鍵燒錄，透過 FFmpeg 將字幕永久嵌入影片畫面。ASS 格式保留完整樣式設定，SRT 可自訂字型與大小。",
  },
  {
    icon: Layers,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10",
    tag: "效率提升",
    title: "批量處理",
    description:
      "一個資料夾丟進去，全部自動轉錄完成。適合課程錄影、播客系列、會議記錄批量生產，節省數倍的手工時間。",
  },
  {
    icon: Scissors,
    iconColor: "text-green-400",
    iconBg: "bg-green-500/10",
    tag: "無縫整合",
    title: "剪輯軟體整合",
    description:
      "輸出的 SRT 直接拖入 Premiere Pro、Final Cut Pro、DaVinci Resolve，時間碼精準對齊，無需手動校正，大幅縮短後製流程。",
  },
];

export default function WorkflowSection() {
  return (
    <section id="workflow" className="py-24 px-6 bg-[#111111]">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            專業工作流程全覆蓋
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            從個人 YouTuber 到企業影音團隊，一個工具解決所有字幕需求
          </p>
        </div>

        {/* 2×2 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((w) => {
            const Icon = w.icon;
            return (
              <div
                key={w.title}
                className="rounded-3xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] p-8 transition-colors group"
              >
                <div className="flex items-start gap-4 mb-5">
                  <div
                    className={`w-12 h-12 rounded-2xl ${w.iconBg} flex items-center justify-center shrink-0`}
                  >
                    <Icon className={`w-6 h-6 ${w.iconColor}`} />
                  </div>
                  <span className="mt-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                    {w.tag}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{w.title}</h3>
                <p className="text-white/50 leading-relaxed">{w.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

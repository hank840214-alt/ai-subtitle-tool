import Header from "@/components/Header";
import TranscribePanel from "@/components/TranscribePanel";
import { Subtitles } from "lucide-react";

export default function AppPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Header />

      {/* Glow */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-purple-700/10 rounded-full blur-[120px] pointer-events-none" />

      <main className="relative pt-24 pb-20 px-6">
        {/* Page header */}
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-5">
            <Subtitles className="w-7 h-7 text-purple-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            AI 字幕生成器
          </h1>
          <p className="text-white/50 text-lg">
            上傳影片或音訊，幾分鐘內獲得精準的繁體中文字幕
          </p>
        </div>

        {/* Main panel */}
        <TranscribePanel />
      </main>
    </div>
  );
}

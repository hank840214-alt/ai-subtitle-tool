import Header from "@/components/Header";
import DictationPanel from "@/components/DictationPanel";
import { Keyboard } from "lucide-react";

export default function DictationPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Header />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-purple-700/10 rounded-full blur-[120px] pointer-events-none" />
      <main className="relative pt-24 pb-20 px-6">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-5">
            <Keyboard className="w-7 h-7 text-purple-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
            語音聽寫
          </h1>
          <p className="text-white/50 text-lg">
            說話即轉文字，即時編輯
          </p>
        </div>
        <DictationPanel />
      </main>
    </div>
  );
}

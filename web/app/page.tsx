import Header from "@/components/Header";
import Hero from "@/components/Hero";
import StepGuide from "@/components/StepGuide";
import FeatureGrid from "@/components/FeatureGrid";
import WorkflowSection from "@/components/WorkflowSection";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <Header />
      <main>
        <Hero />

        {/* Three-step guide */}
        <section className="py-4 px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-2">
              <p className="text-white/30 text-sm uppercase tracking-widest">使用流程</p>
            </div>
            <StepGuide animateOnScroll={true} />
          </div>
        </section>

        <FeatureGrid />
        <WorkflowSection />

        {/* Pricing */}
        <section id="pricing" className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-300 text-sm mb-8">
              完全免費
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              開源，永久免費
            </h2>
            <p className="text-white/50 text-lg mb-10 max-w-xl mx-auto">
              AI 字幕工具以 MIT 授權開源發布。無訂閱費用、無使用上限、無隱私風險。
              Fork 它，改造它，或直接用它。
            </p>
            <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8 mb-8 text-left space-y-3">
              {[
                "✅ 無限次數轉錄",
                "✅ 所有字幕格式（SRT / VTT / ASS / TXT）",
                "✅ 字幕燒錄功能",
                "✅ 批量處理整個資料夾",
                "✅ 完全離線，隱私無風險",
                "✅ 永久免費，MIT 開源授權",
              ].map((item) => (
                <p key={item} className="text-white/70 text-sm">
                  {item}
                </p>
              ))}
            </div>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 h-12 px-8 bg-white text-black font-semibold rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            >
              立即開始使用
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

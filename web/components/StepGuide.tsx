"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Sparkles, Download } from "lucide-react";

interface Step {
  num: number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  desc: string;
}

const STEPS: Step[] = [
  {
    num: 1,
    icon: Upload,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
    title: "上傳影片",
    desc: "支援 MP4、MKV、MP3、WAV 等格式",
  },
  {
    num: 2,
    icon: Sparkles,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10",
    title: "AI 自動轉錄",
    desc: "BELLE-whisper 繁體中文最高精準度",
  },
  {
    num: 3,
    icon: Download,
    iconColor: "text-green-400",
    iconBg: "bg-green-500/10",
    title: "編輯與匯出",
    desc: "SRT、VTT、ASS 多格式下載",
  },
];

interface StepGuideProps {
  /** 0-based active step index (0=upload, 1=transcribe, 2=export). -1 = none active yet. */
  activeStep?: number;
  /** If true, uses IntersectionObserver to animate steps into view sequentially. */
  animateOnScroll?: boolean;
}

export default function StepGuide({
  activeStep = -1,
  animateOnScroll = false,
}: StepGuideProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleSteps, setVisibleSteps] = useState<boolean[]>([false, false, false]);

  useEffect(() => {
    if (!animateOnScroll) {
      setVisibleSteps([true, true, true]);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Light up steps sequentially
          [0, 1, 2].forEach((i) => {
            setTimeout(() => {
              setVisibleSteps((prev) => {
                const next = [...prev];
                next[i] = true;
                return next;
              });
            }, i * 200);
          });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animateOnScroll]);

  return (
    <div ref={containerRef} className="w-full py-8">
      <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center gap-0 sm:gap-0 max-w-3xl mx-auto">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isActive = activeStep === idx;
          const isDone = activeStep > idx;
          const isVisible = visibleSteps[idx];

          return (
            <div key={step.num} className="flex flex-col sm:flex-row items-center flex-1 min-w-0">
              {/* Step card */}
              <div
                className={`
                  flex flex-col items-center text-center px-4 py-5 rounded-2xl w-full
                  transition-all duration-500 ease-out
                  ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
                  ${isActive ? "bg-purple-500/10 border border-purple-500/30" : "border border-transparent"}
                `}
              >
                {/* Circle + number */}
                <div className="relative mb-4">
                  <div
                    className={`
                      w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
                      transition-all duration-300
                      ${isDone
                        ? "bg-green-500/20 border-2 border-green-500/50 text-green-400"
                        : isActive
                        ? "bg-purple-500/20 border-2 border-purple-500/60 text-purple-300 shadow-[0_0_16px_rgba(147,51,234,0.35)]"
                        : "bg-white/5 border-2 border-white/10 text-white/30"
                      }
                    `}
                  >
                    {isDone ? "✓" : step.num}
                  </div>
                  {/* Icon badge */}
                  <div
                    className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${step.iconBg} flex items-center justify-center border border-white/10`}
                  >
                    <Icon className={`w-2.5 h-2.5 ${step.iconColor}`} />
                  </div>
                </div>

                {/* Icon box */}
                <div
                  className={`w-10 h-10 rounded-xl ${step.iconBg} flex items-center justify-center mb-3 transition-all duration-300 ${
                    isActive ? "scale-110" : ""
                  }`}
                >
                  <Icon className={`w-5 h-5 ${step.iconColor}`} />
                </div>

                <p
                  className={`font-semibold text-sm mb-1 transition-colors duration-300 ${
                    isActive ? "text-white" : isDone ? "text-white/80" : "text-white/40"
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-xs text-white/30 leading-relaxed">{step.desc}</p>
              </div>

              {/* Connector line (between steps, not after last) */}
              {idx < STEPS.length - 1 && (
                <div className="flex-shrink-0 my-3 sm:my-0 sm:mx-1 flex sm:flex-row flex-col items-center">
                  {/* horizontal on sm, vertical on mobile */}
                  <div className="hidden sm:block w-12 h-px relative overflow-hidden">
                    <div
                      className="absolute inset-0 border-t-2 border-dashed border-white/15"
                      style={{ borderSpacing: "4px" }}
                    />
                    {(isActive || isDone) && (
                      <div
                        className="absolute inset-0 h-px top-0"
                        style={{
                          background:
                            "linear-gradient(90deg, rgba(147,51,234,0.7), rgba(147,51,234,0))",
                          animation: "pulse 2s ease-in-out infinite",
                        }}
                      />
                    )}
                  </div>
                  <div className="block sm:hidden w-px h-6 relative overflow-hidden">
                    <div className="absolute inset-0 border-l-2 border-dashed border-white/15" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

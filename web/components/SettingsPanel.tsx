"use client";

import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { fetchSettings, updateSettings } from "@/lib/api";

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Record<string, string | boolean> | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await updateSettings(settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const update = (key: string, value: string | boolean) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : null);
  };

  if (!settings) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto w-full space-y-8">
      {/* LLM Settings */}
      <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-white font-semibold">LLM 設定</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Provider</label>
            <select
              value={String(settings.llm_provider)}
              onChange={(e) => update("llm_provider", e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="ollama" className="bg-[#1a1a1a]">Ollama（本地）</option>
              <option value="openai" className="bg-[#1a1a1a]">OpenAI</option>
              <option value="claude" className="bg-[#1a1a1a]">Claude</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">模型</label>
            <input
              value={String(settings.ollama_model)}
              onChange={(e) => update("ollama_model", e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
              placeholder="qwen3:8b"
            />
          </div>
        </div>
        {settings.llm_provider !== "ollama" && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">API Key</label>
              <input
                type="password"
                value={String(settings.api_key)}
                onChange={(e) => update("api_key", e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">API Base URL</label>
              <input
                value={String(settings.api_base_url)}
                onChange={(e) => update("api_base_url", e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
                placeholder="https://api.openai.com/v1"
              />
            </div>
          </div>
        )}
      </section>

      {/* ASR Settings */}
      <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-white font-semibold">ASR 引擎</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">離線字幕引擎</label>
            <select
              value={String(settings.default_engine)}
              onChange={(e) => update("default_engine", e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="faster-whisper" className="bg-[#1a1a1a]">BELLE Whisper（繁中最準）</option>
              <option value="mlx-whisper" className="bg-[#1a1a1a]">MLX Whisper（Apple Silicon 快）</option>
              <option value="qwen3-asr" className="bg-[#1a1a1a]">Qwen3-ASR</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1.5">即時轉錄引擎</label>
            <select
              value={String(settings.default_live_engine)}
              onChange={(e) => update("default_live_engine", e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
            >
              <option value="qwen3-asr" className="bg-[#1a1a1a]">Qwen3-ASR（推薦）</option>
            </select>
          </div>
        </div>
      </section>

      {/* Output Settings */}
      <section className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-white font-semibold">輸出</h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => update("convert_to_traditional", !settings.convert_to_traditional)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              settings.convert_to_traditional ? "bg-purple-500" : "bg-white/10"
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              settings.convert_to_traditional ? "translate-x-5" : "translate-x-0"
            }`} />
          </div>
          <span className="text-sm text-white/60">自動轉換繁體中文</span>
        </label>
      </section>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-white text-black font-semibold rounded-full hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saved ? "已儲存！" : "儲存設定"}
      </button>
    </div>
  );
}

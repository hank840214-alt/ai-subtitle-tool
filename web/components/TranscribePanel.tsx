"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, Download, Flame, Trash2, CheckCircle, XCircle, Loader2, Globe } from "lucide-react";
import UploadZone from "./UploadZone";
import SubtitlePreview from "./SubtitlePreview";
import WaveformEditor, { Segment } from "./WaveformEditor";
import StepGuide from "./StepGuide";

const API_BASE = "http://localhost:8000";

type JobStatus = "pending" | "loading_model" | "transcribing" | "burning" | "done" | "error";

interface JobEvent {
  status: JobStatus;
  message: string;
  progress: number;
  error?: string;
  result?: {
    segments: number;
    language: string;
    language_probability: number;
    subtitle_path: string;
    format: string;
  };
}

interface BurnState {
  jobId: string;
  status: JobStatus;
  message: string;
  downloadUrl?: string;
}

const MODELS = [
  { value: "large-v3-turbo", label: "Whisper large-v3-turbo（推薦）" },
  { value: "BELLE-2/Belle-whisper-large-v3-zh-punct", label: "BELLE 繁中優化（最準確）" },
  { value: "large-v3", label: "Whisper large-v3（高精度）" },
  { value: "medium", label: "Whisper medium（平衡）" },
  { value: "small", label: "Whisper small（快速）" },
];

const LANGUAGES = [
  { value: "zh", label: "中文（自動繁簡）" },
  { value: "auto", label: "自動偵測" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
];

const FORMATS = [
  { value: "srt", label: "SRT" },
  { value: "vtt", label: "WebVTT" },
  { value: "ass", label: "ASS" },
  { value: "txt", label: "純文字" },
];

/** Parse SRT content into Segment[] for WaveformEditor */
function parseSrtSegments(content: string): Segment[] {
  const blocks = content.trim().split(/\n\n+/);
  const segs: Segment[] = [];
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;
    const timeMatch = lines[1]?.match(
      /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/
    );
    if (!timeMatch) continue;
    const toSec = (h: string, m: string, s: string, ms: string) =>
      parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
    const start = toSec(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
    const end = toSec(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);
    const text = lines.slice(2).join(" ").replace(/<[^>]+>/g, "").trim();
    segs.push({ id: `seg-${segs.length}`, start, end, text });
  }
  return segs;
}

export default function TranscribePanel() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [model, setModel] = useState(MODELS[0].value);
  const [language, setLanguage] = useState("zh");
  const [format, setFormat] = useState("srt");
  const [beamSize, setBeamSize] = useState(5);
  const [convertTraditional, setConvertTraditional] = useState(true);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobEvent, setJobEvent] = useState<JobEvent | null>(null);
  const [subtitleContent, setSubtitleContent] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [burnState, setBurnState] = useState<BurnState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [urlDownloadProgress, setUrlDownloadProgress] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);

  const isRunning =
    jobEvent?.status === "pending" ||
    jobEvent?.status === "loading_model" ||
    jobEvent?.status === "transcribing";

  const isDone = jobEvent?.status === "done";
  const isError = jobEvent?.status === "error";

  // Derive step guide index
  const activeStep = isDone ? 2 : isRunning ? 1 : file || sourceUrl ? 0 : -1;

  useEffect(() => {
    return () => esRef.current?.close();
  }, []);

  const openSseStream = (id: string) => {
    esRef.current?.close();
    const es = new EventSource(`${API_BASE}/api/status/${id}`);
    esRef.current = es;

    es.onmessage = async (e) => {
      const event: JobEvent = JSON.parse(e.data);
      setJobEvent(event);

      if (event.status === "done") {
        es.close();
        const r = await fetch(`${API_BASE}/api/result/${id}`);
        if (r.ok) {
          const text = await r.text();
          setSubtitleContent(text);
          if (format === "srt") {
            setSegments(parseSrtSegments(text));
          }
        }
      } else if (event.status === "error") {
        es.close();
      }
    };

    es.onerror = () => {
      es.close();
      setJobEvent((prev) =>
        prev?.status === "done" || prev?.status === "error"
          ? prev
          : { status: "error", message: "連線中斷", progress: 0, error: "SSE connection lost" }
      );
    };
  };

  const startTranscription = async () => {
    if (!file) return;
    setIsSubmitting(true);
    setJobEvent(null);
    setSubtitleContent(null);
    setSegments([]);
    setBurnState(null);

    const form = new FormData();
    form.append("file", file);
    form.append("model", model);
    form.append("language", language);
    form.append("format", format);
    form.append("beam_size", String(beamSize));
    form.append("convert_to_traditional", String(convertTraditional));

    try {
      const res = await fetch(`${API_BASE}/api/transcribe`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const id: string = data.job_id;
      setJobId(id);
      setIsSubmitting(false);
      openSseStream(id);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setJobEvent({
        status: "error",
        message: "上傳失敗",
        progress: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const startUrlTranscription = async () => {
    if (!sourceUrl) return;
    setIsSubmitting(true);
    setJobEvent(null);
    setSubtitleContent(null);
    setSegments([]);
    setBurnState(null);
    setUrlDownloadProgress("正在下載影片...");

    try {
      const res = await fetch(`${API_BASE}/api/transcribe-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl, language, format }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const id: string = data.job_id;
      setJobId(id);
      setIsSubmitting(false);
      setUrlDownloadProgress(null);
      openSseStream(id);
    } catch (err: unknown) {
      setIsSubmitting(false);
      setUrlDownloadProgress(null);
      setJobEvent({
        status: "error",
        message: "網址轉錄失敗",
        progress: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const handleFile = (f: File) => {
    setFile(f);
    setSourceUrl(null);
  };

  const handleUrl = (url: string) => {
    setSourceUrl(url);
    setFile(null);
  };

  const handleBurn = async () => {
    if (!jobId) return;
    const burnJobId = `burn-${jobId}`;
    setBurnState({ jobId: burnJobId, status: "pending", message: "提交燒錄任務..." });

    try {
      const res = await fetch(`${API_BASE}/api/burn/${jobId}`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const bId: string = data.job_id;

      setBurnState({ jobId: bId, status: "burning", message: "燒錄字幕中..." });

      const poll = setInterval(async () => {
        const r = await fetch(`${API_BASE}/api/job/${bId}`);
        const j = await r.json();
        if (j.status === "done") {
          clearInterval(poll);
          setBurnState({
            jobId: bId,
            status: "done",
            message: "燒錄完成！",
            downloadUrl: `${API_BASE}/api/result/${bId}/video`,
          });
        } else if (j.status === "error") {
          clearInterval(poll);
          setBurnState({ jobId: bId, status: "error", message: j.error || "燒錄失敗" });
        }
      }, 1500);
    } catch (err: unknown) {
      setBurnState({
        jobId: burnJobId,
        status: "error",
        message: err instanceof Error ? err.message : "燒錄失敗",
      });
    }
  };

  const handleReset = async () => {
    esRef.current?.close();
    if (jobId) {
      await fetch(`${API_BASE}/api/job/${jobId}`, { method: "DELETE" }).catch(() => {});
    }
    setFile(null);
    setSourceUrl(null);
    setJobId(null);
    setJobEvent(null);
    setSubtitleContent(null);
    setSegments([]);
    setBurnState(null);
    setUrlDownloadProgress(null);
  };

  const progressPercent = jobEvent ? Math.round(jobEvent.progress * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Step guide */}
      <StepGuide activeStep={activeStep} animateOnScroll={false} />

      {/* Upload zone */}
      {!isRunning && !isDone && (
        <div className="animate-fade-in">
          <UploadZone onFile={handleFile} onUrl={handleUrl} disabled={isSubmitting} />
          {file && (
            <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="text-white/60 text-sm flex-1 truncate">{file.name}</span>
              <span className="text-white/30 text-xs">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </span>
            </div>
          )}
          {sourceUrl && (
            <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <Globe className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="text-white/60 text-sm flex-1 truncate">{sourceUrl}</span>
            </div>
          )}
        </div>
      )}

      {/* Settings (file mode only) */}
      {!isRunning && !isDone && file && (
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-5 animate-fade-in">
          <div className="flex items-center gap-2 text-white/60 text-sm font-medium mb-1">
            <Settings className="w-4 h-4" />
            轉錄設定
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Model */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5">AI 模型</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value} className="bg-[#1a1a1a]">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5">語言</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value} className="bg-[#1a1a1a]">
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Format */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5">輸出格式</label>
              <div className="flex gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors border ${
                      format === f.value
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                        : "bg-white/[0.03] border-white/10 text-white/40 hover:text-white/70"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Beam size */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5">
                Beam Size: <span className="text-white/70">{beamSize}</span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={beamSize}
                onChange={(e) => setBeamSize(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-white/25 mt-1">
                <span>快速</span>
                <span>精確</span>
              </div>
            </div>
          </div>

          {/* Traditional toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setConvertTraditional(!convertTraditional)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                convertTraditional ? "bg-purple-500" : "bg-white/10"
              }`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  convertTraditional ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
            <span className="text-sm text-white/60">自動轉換繁體中文（s2twp）</span>
          </label>
        </div>
      )}

      {/* URL mode: simple language + format selectors */}
      {!isRunning && !isDone && sourceUrl && (
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 animate-fade-in">
          <div className="flex items-center gap-2 text-white/60 text-sm font-medium mb-4">
            <Settings className="w-4 h-4" />
            轉錄設定
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1.5">語言</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value} className="bg-[#1a1a1a]">{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1.5">輸出格式</label>
              <div className="flex gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors border ${
                      format === f.value
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                        : "bg-white/[0.03] border-white/10 text-white/40 hover:text-white/70"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit button */}
      {!isRunning && !isDone && (
        <button
          onClick={file ? startTranscription : startUrlTranscription}
          disabled={(!file && !sourceUrl) || isSubmitting}
          className="w-full h-12 bg-white text-black font-semibold rounded-full hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {urlDownloadProgress || "上傳中..."}</>
          ) : (
            "開始轉錄"
          )}
        </button>
      )}

      {/* Progress */}
      {(isRunning || isError) && jobEvent && (
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-8 animate-fade-in">
          <div className="text-center mb-6">
            {isError ? (
              <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            ) : (
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin mx-auto mb-3" />
            )}
            <p className="text-white font-medium">{jobEvent.message}</p>
            {jobEvent.error && (
              <p className="text-red-400 text-sm mt-2">{jobEvent.error}</p>
            )}
          </div>

          {!isError && (
            <div className="space-y-2">
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-white/30">
                <span>
                  {["載入模型", "轉錄中", "格式化"].map((s, i) => (
                    <span
                      key={s}
                      className={`mr-4 ${progressPercent > i * 33 ? "text-white/60" : ""}`}
                    >
                      {s}
                    </span>
                  ))}
                </span>
                <span>{progressPercent}%</span>
              </div>
            </div>
          )}

          {isError && (
            <button
              onClick={handleReset}
              className="w-full mt-4 h-10 bg-white/5 hover:bg-white/10 text-white/60 rounded-full text-sm transition-colors"
            >
              重新開始
            </button>
          )}
        </div>
      )}

      {/* Results */}
      {isDone && jobEvent?.result && (
        <div className="space-y-4 animate-fade-in">
          {/* Success header */}
          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-green-500/10 border border-green-500/20">
            <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
            <div className="flex-1">
              <p className="text-white font-medium">轉錄完成！</p>
              <p className="text-white/50 text-sm">
                {jobEvent.result.segments} 段字幕・語言：{jobEvent.result.language}
                （{Math.round(jobEvent.result.language_probability * 100)}% 信心）
              </p>
            </div>
          </div>

          {/* Waveform editor (SRT only, requires audio URL) */}
          {format === "srt" && segments.length > 0 && jobId && (
            <div className="space-y-2">
              <p className="text-xs text-white/30 px-1">波形時間軸編輯器</p>
              <WaveformEditor
                audioUrl={`${API_BASE}/api/result/${jobId}`}
                segments={segments}
                onSegmentsChange={setSegments}
              />
            </div>
          )}

          {/* Subtitle preview */}
          {subtitleContent && (
            <SubtitlePreview content={subtitleContent} format={format} />
          )}

          {/* Download buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FORMATS.map((f) => (
              <a
                key={f.value}
                href={`${API_BASE}/api/result/${jobId}?fmt=${f.value}`}
                download={`subtitle.${f.value}`}
                className="flex items-center justify-center gap-1.5 h-10 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/70 text-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {f.label}
              </a>
            ))}
          </div>

          {/* Burn + Reset */}
          <div className="flex gap-3">
            <button
              onClick={handleBurn}
              disabled={!!burnState}
              className="flex-1 h-11 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-full transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Flame className="w-4 h-4" />
              {burnState ? burnState.message : "燒錄字幕到影片"}
            </button>
            <button
              onClick={handleReset}
              className="h-11 px-4 rounded-full bg-white/5 hover:bg-white/10 text-white/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Burn result */}
          {burnState?.status === "done" && burnState.downloadUrl && (
            <a
              href={burnState.downloadUrl}
              download="output_subtitled.mp4"
              className="flex items-center justify-center gap-2 h-11 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 text-sm hover:bg-green-500/20 transition-colors"
            >
              <Download className="w-4 h-4" />
              下載燒錄影片
            </a>
          )}
          {burnState?.status === "error" && (
            <p className="text-red-400 text-sm text-center">{burnState.message}</p>
          )}
        </div>
      )}
    </div>
  );
}

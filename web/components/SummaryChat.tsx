"use client";

import { useState, useRef } from "react";
import { FileText, MessageCircle, Send, Loader2, Copy } from "lucide-react";
import { streamSummary, sendChatMessage } from "@/lib/api";

interface SummaryChatProps {
  jobId: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function SummaryChat({ jobId }: SummaryChatProps) {
  const [tab, setTab] = useState<"summary" | "chat">("summary");
  const [summary, setSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleGenerateSummary = () => {
    setSummary("");
    setIsGenerating(true);
    streamSummary(
      jobId,
      (token) => setSummary((prev) => prev + token),
      () => setIsGenerating(false),
    );
  };

  const handleSendChat = async () => {
    if (!input.trim() || isSending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsSending(true);

    let assistantContent = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await sendChatMessage(jobId, userMsg);
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              assistantContent += data.token;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                return updated;
              });
            }
          }
        }
      }
    } catch {
      assistantContent += "\n\n[Error: failed to get response]";
    }
    setIsSending(false);
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] overflow-hidden">
      {/* Tab headers */}
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setTab("summary")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors ${
            tab === "summary" ? "text-purple-300 border-b-2 border-purple-500" : "text-white/40 hover:text-white/60"
          }`}
        >
          <FileText className="w-4 h-4" /> 摘要
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors ${
            tab === "chat" ? "text-purple-300 border-b-2 border-purple-500" : "text-white/40 hover:text-white/60"
          }`}
        >
          <MessageCircle className="w-4 h-4" /> Chat
        </button>
      </div>

      {/* Summary tab */}
      {tab === "summary" && (
        <div className="p-6 space-y-4">
          {!summary && !isGenerating && (
            <button
              onClick={handleGenerateSummary}
              className="w-full py-3 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-xl hover:bg-purple-500/20 transition-colors text-sm"
            >
              生成 AI 摘要
            </button>
          )}
          {(summary || isGenerating) && (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-white/70 text-sm">{summary}</div>
              {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-purple-400 mt-2" />}
            </div>
          )}
          {summary && !isGenerating && (
            <button
              onClick={() => navigator.clipboard.writeText(summary)}
              className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              <Copy className="w-3 h-3" /> 複製摘要
            </button>
          )}
        </div>
      )}

      {/* Chat tab */}
      {tab === "chat" && (
        <div className="flex flex-col h-80">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-white/30 text-sm text-center pt-8">
                輸入問題，向逐字稿提問
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === "user"
                    ? "bg-purple-500/20 text-purple-200"
                    : "bg-white/5 text-white/70"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-white/5 p-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              placeholder="輸入問題..."
              className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
            />
            <button
              onClick={handleSendChat}
              disabled={!input.trim() || isSending}
              className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 hover:bg-purple-500/30 disabled:opacity-40 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

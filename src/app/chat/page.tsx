"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  Send,
  Sparkles,
  Trash2,
  Wrench,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Bot,
  Search,
  TrendingUp,
  PiggyBank,
  ShoppingCart,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import Markdown from "@/components/Markdown";
import { useToast } from "@/components/Toast";
import type { ChatMessage, AgentStep } from "@/lib/types";

const SUGGESTIONS = [
  {
    text: "Bütçemi analiz et, tasarruf önerileri ver",
    icon: PiggyBank,
    color: "text-emerald-600",
  },
  {
    text: "5.000₺'lik kulaklığı taksitle alsam bütçeme uyar mı?",
    icon: ShoppingCart,
    color: "text-blue-600",
  },
  {
    text: "Harcamalarımda anormal bir durum var mı?",
    icon: AlertTriangle,
    color: "text-amber-600",
  },
  {
    text: "3 ayda tatil için nasıl para biriktirebilirim?",
    icon: TrendingUp,
    color: "text-purple-600",
  },
  {
    text: "Kredi kartı asgari ödeme yaparsam ne olur?",
    icon: BookOpen,
    color: "text-rose-600",
  },
  {
    text: "Düşük riskli yatırım için aylık ne kadar ayırmalıyım?",
    icon: Search,
    color: "text-sky-600",
  },
];

interface MessageWithSteps extends ChatMessage {
  agentSteps?: AgentStep[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<MessageWithSteps[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    api.getMessages().then((r) => setMessages(r.messages));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function send(content?: string) {
    const text = (content ?? input).trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [
      ...m,
      {
        _id: "tmp_" + Date.now(),
        userId: "demo",
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);
    setLoading(true);
    try {
      const res = await api.sendMessage(text);
      setMessages((m) => [
        ...m.filter((x) => !String(x._id).startsWith("tmp_")),
        res.userMessage,
        { ...res.assistantMessage, agentSteps: res.agentSteps },
      ]);
    } catch {
      toast.error("Hata", "Mesaj gönderilemedi. Lütfen tekrar deneyin.");
      setMessages((m) => [
        ...m,
        {
          _id: "err_" + Date.now(),
          userId: "demo",
          role: "assistant",
          content: "Bir hata oluştu. Lütfen tekrar dene.",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    if (!confirm("Tüm sohbet geçmişi silinecek. Emin misin?")) return;
    try {
      await api.clearMessages();
      setMessages([]);
      toast.success("Temizlendi", "Sohbet geçmişi silindi.");
    } catch {
      toast.error("Hata", "Temizleme başarısız oldu.");
    }
  }

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)] flex flex-col">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="text-brand-600" size={22} />
            AI Finans Asistanı
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Agentic AI — Bütçen, harcamaların ve hedeflerine göre araçları
            kullanarak kişiselleştirilmiş analiz yapar.
          </p>
        </div>
        <button
          onClick={clearHistory}
          className="btn-ghost text-rose-600 hover:text-rose-700"
          title="Geçmişi temizle"
        >
          <Trash2 size={16} />
          <span className="hidden sm:inline">Temizle</span>
        </button>
      </header>

      {/* Mesajlar */}
      <div ref={scrollRef} className="card flex-1 overflow-y-auto space-y-3">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 grid place-items-center mb-4">
              <Bot className="text-brand-600" size={32} />
            </div>
            <h3 className="font-semibold text-lg mb-1">
              Merhaba! Ben AI Finans Asistanın 👋
            </h3>
            <p className="text-sm text-slate-500 max-w-md mb-6">
              Harcamalarını analiz eder, tasarruf planı oluşturur, ürünleri
              bütçene göre karşılaştırır ve finansal kavramları açıklarım.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => send(s.text)}
                  className="flex items-center gap-2 text-left text-xs px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-brand-200 text-slate-700 transition group"
                >
                  <s.icon
                    size={16}
                    className={`${s.color} shrink-0 group-hover:scale-110 transition-transform`}
                  />
                  <span className="line-clamp-2">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m) => (
          <div key={m._id}>
            <div
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] text-sm leading-relaxed rounded-2xl px-4 py-3 ${
                  m.role === "user"
                    ? "bg-brand-600 text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-800 rounded-bl-sm"
                }`}
              >
                {m.role === "assistant" ? (
                  <Markdown text={m.content} />
                ) : (
                  m.content
                )}
              </div>
            </div>
            {/* Agent Steps Display */}
            {m.agentSteps && m.agentSteps.length > 1 && (
              <AgentStepsDisplay steps={m.agentSteps} />
            )}
          </div>
        ))}

        {loading ? (
          <div className="flex justify-start">
            <div className="bg-slate-100 text-slate-500 text-sm rounded-2xl px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-brand-500 rounded-full animate-bounce" />
                <span
                  className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <span
                  className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
              <span>Araçlar çalışıyor, analiz yapılıyor…</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Mesajlar varken de hızlı önerileri göster (compact) */}
      {messages.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.slice(0, 4).map((s) => (
            <button
              key={s.text}
              onClick={() => send(s.text)}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
            >
              {s.text.length > 40 ? s.text.slice(0, 40) + "…" : s.text}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2"
      >
        <input
          className="input flex-1"
          placeholder="Soru yaz... (örn. 'Bütçemi analiz et' veya 'Enflasyon nedir?')"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          className="btn-primary"
          type="submit"
          disabled={loading || !input.trim()}
        >
          <Send size={16} /> Gönder
        </button>
      </form>
    </div>
  );
}

/* ─── Agent Steps Component ─────────────────────────────────── */

function AgentStepsDisplay({ steps }: { steps: AgentStep[] }) {
  const [open, setOpen] = useState(false);
  const toolSteps = steps.filter(
    (s) => s.type === "tool_call" || s.type === "tool_result",
  );
  if (toolSteps.length === 0) return null;

  const toolNames = [
    ...new Set(toolSteps.filter((s) => s.toolName).map((s) => s.toolName)),
  ];

  const toolLabels: Record<string, string> = {
    analyze_spending: "📊 Harcama Analizi",
    calculate_savings_plan: "💰 Tasarruf Planı",
    compare_products: "🛒 Ürün Karşılaştırma",
    get_budget_status: "📋 Bütçe Durumu",
    predict_month_end: "📈 Ay Sonu Tahmini",
    detect_anomalies: "🔍 Anomali Tespiti",
    financial_literacy_explain: "📚 Kavram Açıklama",
  };

  return (
    <div className="ml-4 mt-1 mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-700 transition"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Wrench size={11} />
        <span>
          {toolNames.length} araç kullanıldı:{" "}
          {toolNames
            .map((n) => toolLabels[n || ""] || n)
            .join(", ")}
        </span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 pl-5 border-l-2 border-slate-200">
          {toolSteps.map((step, i) => (
            <div key={i} className="text-[11px] text-slate-500 flex items-start gap-1.5">
              {step.type === "tool_call" ? (
                <>
                  <Wrench size={10} className="mt-0.5 text-brand-500" />
                  <span>
                    <strong>{toolLabels[step.toolName || ""] || step.toolName}</strong>
                    {step.toolArgs && Object.keys(step.toolArgs).length > 0 && (
                      <span className="ml-1 text-slate-400">
                        ({Object.entries(step.toolArgs)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(", ")})
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={10} className="mt-0.5 text-emerald-500" />
                  <span>Sonuç alındı</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

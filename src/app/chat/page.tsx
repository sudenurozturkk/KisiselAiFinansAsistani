"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  Plus,
  MessageSquare,
  MoreVertical,
  Pencil,
  X,
} from "lucide-react";
import Markdown from "@/components/Markdown";
import { AiPoweredBadge } from "@/components/AiPoweredBadge";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ui";
import type { ChatMessage, AgentStep, ChatSession } from "@/lib/types";

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

const ACTIVE_SESSION_KEY = "chat_active_session_id";

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageWithSteps[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [renameTarget, setRenameTarget] = useState<ChatSession | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<ChatSession | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  /* ─── Session Yönetimi ─────────────────────────────────── */

  const loadSessions = useCallback(async () => {
    try {
      const r = await api.listChatSessions();
      setSessions(r.sessions);
      return r.sessions;
    } catch {
      return [];
    }
  }, []);

  const loadMessages = useCallback(async (sessionId: string | null) => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    try {
      const r = await api.getMessages(sessionId);
      setMessages(r.messages);
    } catch {
      setMessages([]);
    }
  }, []);

  // İlk yükleme: oturumları getir, en sonki aktif oturumu seç
  useEffect(() => {
    (async () => {
      const list = await loadSessions();
      const saved =
        typeof window !== "undefined"
          ? window.localStorage.getItem(ACTIVE_SESSION_KEY)
          : null;
      const found = saved && list.find((s) => s._id === saved);
      const pick = found ? found._id : list[0]?._id ?? null;
      setActiveSessionId(pick);
      if (pick) await loadMessages(pick);
    })();
  }, [loadSessions, loadMessages]);

  // Aktif oturumu localStorage'a yaz
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeSessionId) {
      window.localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
    }
  }, [activeSessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  async function newSession() {
    try {
      const r = await api.createChatSession("Yeni Sohbet");
      setSessions((prev) => [r.session, ...prev]);
      setActiveSessionId(r.session._id);
      setMessages([]);
      toast.success("Yeni sohbet", "Temiz bir sohbet oturumu oluşturuldu.");
    } catch {
      toast.error("Hata", "Yeni sohbet açılamadı.");
    }
  }

  async function switchSession(id: string) {
    if (id === activeSessionId) return;
    setActiveSessionId(id);
    await loadMessages(id);
  }

  async function renameSession() {
    if (!renameTarget) return;
    const title = renameTitle.trim() || "Yeni Sohbet";
    try {
      await api.updateChatSession(renameTarget._id, title);
      setSessions((prev) =>
        prev.map((s) =>
          s._id === renameTarget._id ? { ...s, title } : s,
        ),
      );
      setRenameTarget(null);
      toast.success("Güncellendi", "Sohbet başlığı değiştirildi.");
    } catch {
      toast.error("Hata", "Başlık güncellenemedi.");
    }
  }

  async function deleteSession(session: ChatSession) {
    try {
      await api.deleteChatSession(session._id);
      const remaining = sessions.filter((s) => s._id !== session._id);
      setSessions(remaining);
      if (session._id === activeSessionId) {
        const next = remaining[0]?._id ?? null;
        setActiveSessionId(next);
        await loadMessages(next);
      }
      toast.success("Silindi", `"${session.title}" silindi.`);
    } catch {
      toast.error("Hata", "Silinemedi.");
    }
  }

  /* ─── Mesaj Gönderme ─────────────────────────────────── */

  async function send(content?: string) {
    const text = (content ?? input).trim();
    if (!text || loading) return;
    setInput("");
    const tempId = "tmp_" + Date.now();
    setMessages((m) => [
      ...m,
      {
        _id: tempId,
        userId: "demo",
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);
    setLoading(true);
    try {
      const res = await api.sendMessage(text, activeSessionId ?? undefined);
      // Backend session oluşturduysa veya başlık güncellediyse listeyi yenile
      if (!activeSessionId || res.sessionId !== activeSessionId) {
        setActiveSessionId(res.sessionId);
      }
      // Session listesini yenile (başlık + updatedAt değişti)
      loadSessions();
      setMessages((m) => [
        ...m.filter((x) => !String(x._id).startsWith("tmp_")),
        res.userMessage,
        { ...res.assistantMessage, agentSteps: res.agentSteps },
      ]);
    } catch {
      toast.error("Hata", "Mesaj gönderilemedi. Lütfen tekrar deneyin.");
      setMessages((m) => [
        ...m.filter((x) => !String(x._id).startsWith("tmp_")),
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

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)] flex flex-col">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold flex items-center gap-2 flex-wrap">
            <Sparkles className="text-brand-600" size={22} />
            AI Finans Asistanı
            <AiPoweredBadge />
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Google Gemini — gerçek AI yanıtları; kural tabanlı veya sahte önizleme yok.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="btn-ghost lg:hidden"
            title="Sohbet geçmişi"
          >
            <MessageSquare size={16} />
          </button>
          <button onClick={newSession} className="btn-primary" title="Yeni sohbet">
            <Plus size={16} />
            <span className="hidden sm:inline">Yeni Sohbet</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-3 overflow-hidden">
        {/* Sohbet listesi sidebar */}
        <aside
          className={`${
            sidebarOpen ? "block" : "hidden lg:block"
          } w-full lg:w-72 shrink-0 card !p-2 overflow-y-auto`}
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sohbetler ({sessions.length})
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-slate-600"
              title="Kapat"
            >
              <X size={14} />
            </button>
          </div>
          {sessions.length === 0 ? (
            <div className="text-center py-8 px-2">
              <MessageSquare size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-500">
                Henüz sohbet yok. Yeni bir sohbet oluştur.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => (
                <SessionItem
                  key={s._id}
                  session={s}
                  active={s._id === activeSessionId}
                  onClick={() => switchSession(s._id)}
                  onRename={() => {
                    setRenameTarget(s);
                    setRenameTitle(s.title);
                  }}
                  onDelete={() => setConfirmDelete(s)}
                />
              ))}
            </div>
          )}
        </aside>

        {/* Mesajlar + Input */}
        <div className={`${sidebarOpen ? "hidden lg:flex" : "flex"} flex-col flex-1 gap-3 overflow-hidden`}>
          <div
            ref={scrollRef}
            className="card flex-1 overflow-y-auto space-y-3"
          >
            {messages.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-brand-50 grid place-items-center mb-4">
                  <Bot className="text-brand-600" size={32} />
                </div>
                <h3 className="font-semibold text-lg mb-1">
                  Merhaba! Ben AI Finans Asistanın 👋
                </h3>
                <p className="text-sm text-slate-500 max-w-md mb-6">
                  Harcamalarını analiz eder, tasarruf planı oluşturur, ürünleri bütçene göre karşılaştırır.
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
      </div>

      {/* Rename modal */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setRenameTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-base">Sohbet Başlığını Düzenle</h3>
            <input
              className="input w-full"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") renameSession();
                if (e.key === "Escape") setRenameTarget(null);
              }}
              autoFocus
              maxLength={80}
            />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setRenameTarget(null)}>
                İptal
              </button>
              <button className="btn-primary" onClick={renameSession}>
                <Pencil size={14} /> Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Silme onayı */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) await deleteSession(confirmDelete);
        }}
        title={`"${confirmDelete?.title ?? ""}" silinsin mi?`}
        description="Bu sohbetteki tüm mesajlar silinecek. Bu işlem geri alınamaz."
        confirmText="Sil"
        destructive
      />
    </div>
  );
}

/* ─── Session Item ─────────────────────────────────────────── */

function SessionItem({
  session,
  active,
  onClick,
  onRename,
  onDelete,
}: {
  session: ChatSession;
  active: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={`group relative rounded-lg ${active ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50"}`}>
      <button
        onClick={onClick}
        className="w-full text-left px-2 py-2 flex items-center gap-2 min-w-0"
      >
        <MessageSquare
          size={14}
          className={active ? "text-brand-600 shrink-0" : "text-slate-400 shrink-0"}
        />
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium truncate ${active ? "text-brand-700" : "text-slate-700"}`}>
            {session.title}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {new Date(session.updatedAt).toLocaleDateString("tr-TR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className="absolute top-2 right-1 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-white opacity-0 group-hover:opacity-100 transition"
        title="Seçenekler"
      >
        <MoreVertical size={12} />
      </button>
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-1 top-7 z-40 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-32">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onRename();
              }}
              className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <Pencil size={11} /> Yeniden Adlandır
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete();
              }}
              className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
            >
              <Trash2 size={11} /> Sil
            </button>
          </div>
        </>
      )}
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

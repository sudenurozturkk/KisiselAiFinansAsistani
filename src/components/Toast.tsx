"use client";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  AlertCircle,
} from "lucide-react";

type ToastTone = "success" | "error" | "info" | "warn";
interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  show: (t: Omit<ToastItem, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warn: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show: ToastContextValue["show"] = useCallback(
    (t) => {
      const id = Math.random().toString(36).slice(2);
      setItems((prev) => [...prev, { ...t, id }]);
      setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  const value: ToastContextValue = {
    show,
    success: (title, description) =>
      show({ tone: "success", title, description }),
    error: (title, description) => show({ tone: "error", title, description }),
    info: (title, description) => show({ tone: "info", title, description }),
    warn: (title, description) => show({ tone: "warn", title, description }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose: () => void;
}) {
  const Icon =
    item.tone === "success"
      ? CheckCircle2
      : item.tone === "error"
        ? AlertCircle
        : item.tone === "warn"
          ? AlertTriangle
          : Info;
  const toneClass = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-rose-200 bg-rose-50 text-rose-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  }[item.tone];
  const iconClass = {
    success: "text-emerald-600",
    error: "text-rose-600",
    warn: "text-amber-600",
    info: "text-sky-600",
  }[item.tone];

  return (
    <div
      className={`shadow-soft border rounded-xl p-3 pr-2 flex items-start gap-3 ${toneClass} animate-in fade-in slide-in-from-top-2`}
    >
      <Icon size={18} className={`mt-0.5 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight">{item.title}</div>
        {item.description ? (
          <div className="text-xs opacity-80 mt-0.5">{item.description}</div>
        ) : null}
      </div>
      <button
        onClick={onClose}
        className="text-current/60 hover:text-current p-1"
        aria-label="Kapat"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// Quick non-context fallback used by libraries — not strictly required.
export function useToastSafe(): ToastContextValue {
  const ctx = useContext(ToastContext);
  return (
    ctx ?? {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      warn: () => {},
    }
  );
}

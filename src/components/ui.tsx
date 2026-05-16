"use client";
import { ReactNode, useEffect, useRef } from "react";

export function ProgressBar({
  value,
  tone = "brand",
}: {
  value: number; // 0-100+
  tone?: "brand" | "good" | "warn" | "bad";
}) {
  const clamped = Math.max(0, Math.min(value, 100));
  const overflow = value > 100;
  const color = {
    brand: "bg-brand-500",
    good: "bg-emerald-500",
    warn: "bg-amber-500",
    bad: "bg-rose-500",
  }[tone];
  return (
    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`${color} h-full rounded-full transition-all`}
        style={{ width: `${clamped}%`, opacity: overflow ? 0.9 : 1 }}
      />
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const hue =
    Math.abs([...name].reduce((a, c) => a + c.charCodeAt(0), 0)) % 360;
  return (
    <div
      className="grid place-items-center rounded-full text-white font-semibold shadow-soft"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))`,
        fontSize: size * 0.42,
      }}
      title={name}
    >
      {initials}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-2xl bg-white/50">
      {icon ? <div className="mx-auto mb-3 text-slate-400">{icon}</div> : null}
      <div className="font-medium">{title}</div>
      {description ? (
        <div className="text-sm text-slate-500 mt-1">{description}</div>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/**
 * Erişilebilir modal: ESC ile kapanır, body scroll kilitlenir,
 * açılışta ilk odaklanabilir öğeye focus verir, kapanışta önceki öğeye geri döner.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // ESC + body scroll lock + focus restore
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Aç açar açmaz dialog'a fokus ver
    queueMicrotask(() => {
      const root = dialogRef.current;
      if (!root) return;
      const focusable = root.querySelector<HTMLElement>(
        'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      (focusable ?? root).focus();
    });

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`bg-white rounded-2xl shadow-xl ${sizeClass} w-full max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col outline-none animate-in zoom-in-95`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 font-semibold flex items-center justify-between gap-4 shrink-0">
          <span className="truncate">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer ? (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 shrink-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Tek tıkta onay modali — native confirm() yerine.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Onayla",
  cancelText = "İptal",
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">
            {cancelText}
          </button>
          <button
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            className={destructive ? "btn-danger" : "btn-primary"}
          >
            {confirmText}
          </button>
        </>
      }
    >
      {description ? (
        <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
      ) : null}
    </Modal>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "good" | "warn" | "bad" | "brand" | "info";
}) {
  const cls = {
    default: "bg-slate-100 text-slate-700",
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    bad: "bg-rose-50 text-rose-700",
    brand: "bg-brand-50 text-brand-700",
    info: "bg-sky-50 text-sky-700",
  }[tone];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

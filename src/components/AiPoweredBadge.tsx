import { Sparkles } from "lucide-react";

/** Gerçek Gemini AI ile üretildiğini belirten rozet */
export function AiPoweredBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-800 border border-violet-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
      title="Bu içerik Google Gemini yapay zeka modeli ile üretilir; sahte veya kural tabanlı önizleme değildir."
    >
      <Sparkles size={10} aria-hidden />
      Gemini AI
    </span>
  );
}

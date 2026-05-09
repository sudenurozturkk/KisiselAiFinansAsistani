"use client";
import { AlertTriangle, CheckCircle2, AlertOctagon } from "lucide-react";
import { ProgressBar } from "./ui";
import { budgetAlertLevel, formatTRY } from "@/lib/finance";

export default function BudgetAlert({
  used,
  budget,
  remaining,
  projected,
}: {
  used: number;
  budget: number;
  remaining: number;
  projected: number;
}) {
  if (budget <= 0) return null;
  const usedPct = Math.round((used / budget) * 100);
  const level = budgetAlertLevel(usedPct);

  const config = {
    ok: {
      title: "Bütçe sağlıklı seyrediyor",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      Icon: CheckCircle2,
      iconClass: "text-emerald-600",
      bar: "good" as const,
    },
    warn: {
      title: "Bütçenin %80'ini geçtin",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
      Icon: AlertTriangle,
      iconClass: "text-amber-600",
      bar: "warn" as const,
    },
    danger: {
      title: "Bütçe aşıldı",
      tone: "border-rose-200 bg-rose-50 text-rose-900",
      Icon: AlertOctagon,
      iconClass: "text-rose-600",
      bar: "bad" as const,
    },
  }[level];

  const projectionOver = projected > budget;

  return (
    <div className={`rounded-2xl border p-4 ${config.tone}`}>
      <div className="flex items-start gap-3">
        <config.Icon className={config.iconClass} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{config.title}</div>
          <div className="text-sm opacity-80 mt-0.5">
            {formatTRY(used)} / {formatTRY(budget)} kullanıldı • Kalan {formatTRY(remaining)} •
            Ay sonu tahmini <span className={projectionOver ? "font-semibold" : ""}>{formatTRY(projected)}</span>
          </div>
          <div className="mt-3">
            <ProgressBar value={usedPct} tone={config.bar} />
            <div className="text-[11px] mt-1 opacity-70">%{usedPct} kullanım</div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import type { Insight } from "@/lib/types";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp, Target, Calendar, Star } from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  "savings-rate": Target,
  "daily-avg": Calendar,
  "expense-delta": TrendingUp,
  "top-category": Star,
  "goal-progress": TrendingDown,
};

const TONE_MAP: Record<Insight["tone"], string> = {
  good: "text-emerald-600 bg-emerald-50",
  warn: "text-amber-600 bg-amber-50",
  bad: "text-rose-600 bg-rose-50",
  info: "text-sky-600 bg-sky-50",
};

export default function InsightsRow({ insights }: { insights: Insight[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {insights.map((i) => {
        const Icon = ICON_MAP[i.id] || Star;
        return (
          <div key={i.id} className="card !p-4 flex flex-col">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${TONE_MAP[i.tone]}`}>
                <Icon size={14} />
              </span>
              <span className="truncate leading-tight">{i.title}</span>
            </div>
            <div className="mt-2 text-lg font-semibold leading-tight">{i.value}</div>
            <div className="text-[11px] text-slate-500 mt-1 min-h-[2rem] line-clamp-2 leading-snug">
              {i.hint ?? ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

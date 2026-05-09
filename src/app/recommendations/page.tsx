"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SpendingPie, IncomeExpenseLine } from "@/components/Charts";
import { formatTRY } from "@/lib/finance";
import {
  Sparkles,
  RefreshCw,
  TrendingUp,
  Wallet,
  PiggyBank,
  ShoppingCart,
  AlertTriangle,
} from "lucide-react";
import { Skeleton } from "@/components/ui";
import Markdown from "@/components/Markdown";
import type {
  RecommendationsResponse,
  StructuredRecommendation,
  SpendingAnomaly,
} from "@/lib/types";

export default function RecommendationsPage() {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.getRecommendations();
      setData(r);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (!data)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );

  const s = data.summary;
  const structured = data.structured || [];
  const anomalies = data.anomalies || [];

  const cardConfig: Record<
    StructuredRecommendation["category"],
    {
      icon: typeof PiggyBank;
      borderClass: string;
      iconClass: string;
    }
  > = {
    tasarruf: {
      icon: PiggyBank,
      borderClass: "border-l-emerald-500",
      iconClass: "text-emerald-600",
    },
    bütçe: {
      icon: Wallet,
      borderClass: "border-l-blue-500",
      iconClass: "text-blue-600",
    },
    yatırım: {
      icon: TrendingUp,
      borderClass: "border-l-purple-500",
      iconClass: "text-purple-600",
    },
    alışveriş: {
      icon: ShoppingCart,
      borderClass: "border-l-orange-500",
      iconClass: "text-orange-600",
    },
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="text-brand-600" size={20} /> Kişisel Öneriler
          </h1>
          <p className="text-slate-500 text-sm">
            Bu ay net:{" "}
            <span className="font-medium">{formatTRY(s.thisMonth.net)}</span> •
            Bütçe kullanımı %{s.thisMonth.budgetUsedPct}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
          Yenile
        </button>
      </header>

      {/* Anomaliler */}
      {anomalies.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            Harcama Anomalileri
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {anomalies.map((a: SpendingAnomaly, idx: number) => (
              <div
                key={idx}
                className={`rounded-xl border p-3 text-sm ${
                  a.severity === "severe"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : a.severity === "moderate"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                <div className="font-medium">{a.category}</div>
                <div className="text-xs mt-0.5">
                  Bu ay: {formatTRY(a.currentAmount)} • Ortalama:{" "}
                  {formatTRY(a.avgAmount)} •{" "}
                  <span className="font-semibold">
                    z-score: {a.zScore}
                  </span>
                </div>
                <div className="text-xs mt-1 opacity-80">{a.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Yapılandırılmış Öneriler */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {structured.length > 0
          ? structured.map((rec, idx) => {
              const config = cardConfig[rec.category] || cardConfig.tasarruf;
              const CardIcon = config.icon;
              return (
                <div
                  key={idx}
                  className={`card space-y-3 border-l-4 ${config.borderClass}`}
                >
                  <div className="flex items-center gap-2">
                    <CardIcon size={20} className={config.iconClass} />
                    <h3 className="font-semibold text-sm">{rec.title}</h3>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {rec.description}
                  </p>
                  {rec.actionItems && rec.actionItems.length > 0 && (
                    <ul className="text-xs text-slate-600 space-y-1">
                      {rec.actionItems.map((a, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-brand-500 mt-0.5">•</span>
                          {a}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Etki: {rec.impact}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium ${
                        rec.priority === "high"
                          ? "bg-rose-50 text-rose-700"
                          : rec.priority === "medium"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {rec.priority === "high"
                        ? "Yüksek"
                        : rec.priority === "medium"
                          ? "Orta"
                          : "Düşük"}{" "}
                      öncelik
                    </span>
                  </div>
                </div>
              );
            })
          : // Fallback: advice metnini göster
            [
              {
                icon: PiggyBank,
                title: "Tasarruf Önerileri",
                borderClass: "border-l-emerald-500",
                iconClass: "text-emerald-600",
              },
              {
                icon: Wallet,
                title: "Bütçe Yönetimi",
                borderClass: "border-l-blue-500",
                iconClass: "text-blue-600",
              },
              {
                icon: TrendingUp,
                title: "Yatırım Tavsiyeleri",
                borderClass: "border-l-purple-500",
                iconClass: "text-purple-600",
              },
              {
                icon: ShoppingCart,
                title: "Alışveriş İpuçları",
                borderClass: "border-l-orange-500",
                iconClass: "text-orange-600",
              },
            ].map((card, idx) => {
              const CardIcon = card.icon;
              return (
                <div
                  key={idx}
                  className={`card space-y-3 border-l-4 ${card.borderClass}`}
                >
                  <div className="flex items-center gap-2">
                    <CardIcon size={20} className={card.iconClass} />
                    <h3 className="font-semibold text-sm">{card.title}</h3>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    AI önerileri yükleniyor...
                  </p>
                </div>
              );
            })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <article className="card lg:col-span-2">
          <h3 className="font-semibold mb-3">Detaylı Analiz</h3>
          <div className="text-sm text-slate-800 leading-relaxed">
            <Markdown text={data.advice} />
          </div>
        </article>
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold mb-2">Harcama dağılımı</h3>
            <SpendingPie data={s.pie} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold mb-2">6 aylık trend</h3>
        <IncomeExpenseLine data={s.trend} />
      </div>
    </div>
  );
}

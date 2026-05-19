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
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
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
  const [aiSource, setAiSource] = useState<"gemini" | "local" | null>(null);
  const [expandedAdvice, setExpandedAdvice] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(
    new Set([0, 1]),
  );

  async function load(forceRefresh = false) {
    setLoading(true);
    try {
      const r = await api.getRecommendations(forceRefresh);
      setData(r);
      // Detect if AI was used based on structured data richness
      const s = r.structured || [];
      const hasPersonalizedContent = s.some(
        (rec) =>
          rec.description &&
          (rec.description.includes(r.user?.name || "__NOMATCH__") ||
            rec.description.match(/₺[\d.,]+/) ||
            rec.description.match(/%\d+/)),
      );
      setAiSource(s.length > 0 && hasPersonalizedContent ? "gemini" : "local");
    } catch {
      setAiSource(null);
    } finally {
      setLoading(false);
    }
  }

  function toggleCard(idx: number) {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  useEffect(() => {
    load();
  }, []);

  const cardConfig: Record<
    StructuredRecommendation["category"],
    {
      icon: typeof PiggyBank;
      borderClass: string;
      iconBg: string;
      iconClass: string;
      label: string;
    }
  > = {
    tasarruf: {
      icon: PiggyBank,
      borderClass: "border-l-emerald-500",
      iconBg: "bg-emerald-50",
      iconClass: "text-emerald-600",
      label: "Tasarruf",
    },
    bütçe: {
      icon: Wallet,
      borderClass: "border-l-blue-500",
      iconBg: "bg-blue-50",
      iconClass: "text-blue-600",
      label: "Bütçe",
    },
    yatırım: {
      icon: TrendingUp,
      borderClass: "border-l-purple-500",
      iconBg: "bg-purple-50",
      iconClass: "text-purple-600",
      label: "Yatırım",
    },
    alışveriş: {
      icon: ShoppingCart,
      borderClass: "border-l-orange-500",
      iconBg: "bg-orange-50",
      iconClass: "text-orange-600",
      label: "Alışveriş",
    },
  };

  if (!data)
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="h-5 w-40" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );

  const s = data.summary;
  const structured = data.structured || [];
  const anomalies = data.anomalies || [];
  const userName = data.user?.name || "Kullanıcı";

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="text-brand-600" size={20} /> Kişisel Öneriler
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {userName} için • Bu ay net:{" "}
            <span
              className={`font-medium ${s.thisMonth.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}
            >
              {formatTRY(s.thisMonth.net)}
            </span>{" "}
            • Bütçe kullanımı{" "}
            <span
              className={`font-medium ${s.thisMonth.budgetUsedPct > 100 ? "text-rose-600" : s.thisMonth.budgetUsedPct > 80 ? "text-amber-600" : "text-emerald-600"}`}
            >
              %{s.thisMonth.budgetUsedPct}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* AI Kaynak Rozeti */}
          {aiSource && (
            <span
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${
                aiSource === "gemini"
                  ? "bg-brand-50 text-brand-700 border border-brand-200"
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              {aiSource === "gemini" ? <Bot size={12} /> : <Zap size={12} />}
              {aiSource === "gemini" ? "Gemini AI" : "Hesaplama Tabanlı"}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="btn-ghost"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />{" "}
            Yenile
          </button>
        </div>
      </header>

      {/* Özet İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Bu Ay Gelir",
            value: formatTRY(s.thisMonth.income),
            color: "text-emerald-600",
          },
          {
            label: "Bu Ay Gider",
            value: formatTRY(s.thisMonth.expense),
            color: "text-rose-600",
          },
          {
            label: "Tasarruf Oranı",
            value: `%${s.savingsRate}`,
            color:
              s.savingsRate >= 20
                ? "text-emerald-600"
                : s.savingsRate >= 10
                  ? "text-amber-600"
                  : "text-rose-600",
          },
          {
            label: "Ay Sonu Tahmini",
            value: formatTRY(s.projectedMonthEnd),
            color:
              s.projectedMonthEnd >= 0 ? "text-emerald-600" : "text-rose-600",
          },
        ].map((stat) => (
          <div key={stat.label} className="card !p-4">
            <div className="text-xs text-slate-500 mb-1">{stat.label}</div>
            <div className={`text-lg font-bold ${stat.color}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Anomaliler */}
      {anomalies.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            Dikkat Gerektiren Harcamalar ({anomalies.length})
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
                <div className="font-semibold">{a.category}</div>
                <div className="text-xs mt-1 flex flex-wrap gap-3">
                  <span>
                    Bu ay: <strong>{formatTRY(a.currentAmount)}</strong>
                  </span>
                  <span>Ortalama: {formatTRY(a.avgAmount)}</span>
                  <span className="font-bold">
                    ↑ %
                    {Math.round(
                      (a.currentAmount / Math.max(1, a.avgAmount) - 1) * 100,
                    )}{" "}
                    fazla
                  </span>
                </div>
                <div className="text-xs mt-1 opacity-80">{a.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Yapılandırılmış Öneriler */}
      <div className="space-y-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Bot size={16} className="text-brand-600" />
          AI Kişisel Öneriler
          <span className="text-xs text-slate-400 font-normal ml-1">
            ({structured.length} öneri)
          </span>
        </h3>

        {structured.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {structured.map((rec, idx) => {
              const config = cardConfig[rec.category] || cardConfig.tasarruf;
              const CardIcon = config.icon;
              const isExpanded = expandedCards.has(idx);
              return (
                <div
                  key={idx}
                  className={`card border-l-4 ${config.borderClass} cursor-pointer hover:shadow-md transition-shadow`}
                  onClick={() => toggleCard(idx)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl ${config.iconBg} grid place-items-center shrink-0 mt-0.5`}
                    >
                      <CardIcon size={18} className={config.iconClass} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${config.iconBg} ${config.iconClass}`}
                        >
                          {config.label}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            rec.priority === "high"
                              ? "bg-rose-50 text-rose-600"
                              : rec.priority === "medium"
                                ? "bg-amber-50 text-amber-600"
                                : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {rec.priority === "high"
                            ? "🔴 Yüksek"
                            : rec.priority === "medium"
                              ? "🟡 Orta"
                              : "🟢 Düşük"}{" "}
                          öncelik
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm mt-1.5 leading-snug">
                        {rec.title}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                        {rec.description}
                      </p>

                      {isExpanded && (
                        <div className="mt-3 space-y-3">
                          {rec.actionItems && rec.actionItems.length > 0 && (
                            <ul className="space-y-1.5">
                              {rec.actionItems.map((a, i) => (
                                <li
                                  key={i}
                                  className="flex items-start gap-2 text-sm text-slate-700"
                                >
                                  <CheckCircle2
                                    size={14}
                                    className={`${config.iconClass} mt-0.5 shrink-0`}
                                  />
                                  {a}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div
                            className={`text-xs font-medium px-3 py-2 rounded-lg ${config.iconBg} ${config.iconClass}`}
                          >
                            📊 Tahmini etki: {rec.impact}
                          </div>
                        </div>
                      )}

                      <button className="flex items-center gap-1 text-xs text-slate-400 mt-2 hover:text-slate-600 transition">
                        {isExpanded ? (
                          <>
                            <ChevronUp size={12} /> Gizle
                          </>
                        ) : (
                          <>
                            <ChevronDown size={12} /> Detaylar & Adımlar
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card text-center py-8 text-slate-400">
            <Bot size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">AI önerileri yükleniyor...</p>
            <p className="text-xs mt-1">
              İşlem geçmişi ekledikçe öneriler kişiselleşir.
            </p>
          </div>
        )}
      </div>

      {/* Detaylı Analiz + Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <article className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Bot size={16} className="text-brand-600" /> Detaylı AI Analizi
            </h3>
            <button
              onClick={() => setExpandedAdvice((v) => !v)}
              className="text-xs text-slate-400 flex items-center gap-1 hover:text-slate-600"
            >
              {expandedAdvice ? (
                <>
                  <ChevronUp size={12} /> Kıs
                </>
              ) : (
                <>
                  <ChevronDown size={12} /> Genişlet
                </>
              )}
            </button>
          </div>
          <div
            className={`text-sm text-slate-800 leading-relaxed ${expandedAdvice ? "" : "line-clamp-6"}`}
          >
            <Markdown text={data.advice} />
          </div>
        </article>
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-sm mb-2">Harcama Dağılımı</h3>
            <SpendingPie data={s.pie} />
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-sm mb-2">6 Aylık Trend</h3>
        <IncomeExpenseLine data={s.trend} />
      </div>
    </div>
  );
}

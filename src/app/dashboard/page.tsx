"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import StatCard from "@/components/StatCard";
import {
  CategoryBars,
  ForecastChart,
  IncomeExpenseLine,
  SpendingPie,
} from "@/components/Charts";
import { formatTRY, calculateHealthScore } from "@/lib/finance";
import type { HealthScoreResult } from "@/lib/finance";
import { computeAchievements } from "@/lib/achievements";
import { forecastSpending } from "@/lib/forecast";
import AchievementsPanel from "@/components/AchievementsPanel";
import {
  ArrowDownRight,
  ArrowUpRight,
  PiggyBank,
  Wallet,
  AlertTriangle,
  Heart,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import Link from "next/link";
import InsightsRow from "@/components/Insights";
import BudgetAlert from "@/components/BudgetAlert";
import { ProgressBar, Skeleton } from "@/components/ui";
import type {
  TransactionsResponse,
  UserProfile,
  Transaction,
  SpendingAnomaly,
} from "@/lib/types";

export default function DashboardPage() {
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    (async () => {
      const [u, t] = await Promise.all([api.getUser(), api.getTransactions()]);
      setUser(u.user);
      setData(t);
    })();
  }, []);

  if (!data || !user)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card !p-4 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>
    );

  const s = data.summary;
  const insights = data.insights || [];
  const anomalies = data.anomalies || [];
  const healthScore = calculateHealthScore(s, user, anomalies.length);
  const achievements = computeAchievements({
    user,
    transactions: data.transactions,
    summary: s,
    anomalyCount: anomalies.length,
  });
  const forecast = forecastSpending(data.transactions, 30, 60);
  const goalProgress =
    user.savingsGoal > 0
      ? Math.round((Math.max(s.thisMonth.net, 0) / user.savingsGoal) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Merhaba, {user.name} 👋</h1>
          <p className="text-slate-500 text-sm">
            Bu ayki finansal özetin ve AI destekli önerilerin.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/chat" className="btn-primary">
            AI ile konuş
          </Link>
          <Link href="/literacy" className="btn-ghost">
            Finansal Eğitim
          </Link>
        </div>
      </header>

      {/* Finansal Sağlık Skoru + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <HealthScoreGauge score={healthScore} />
        <div className="lg:col-span-3">
          <InsightsRow insights={insights} />
        </div>
      </div>

      <BudgetAlert
        used={s.thisMonth.expense}
        budget={user.monthlyBudget}
        remaining={Math.max(user.monthlyBudget - s.thisMonth.expense, 0)}
        projected={s.projectedMonthEnd}
      />

      {/* Anomaliler */}
      {anomalies.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-amber-600" />
            <span className="font-semibold text-amber-900 text-sm">
              Harcama Anomalileri Tespit Edildi
            </span>
          </div>
          <div className="space-y-1">
            {anomalies.slice(0, 3).map((a: SpendingAnomaly, i: number) => (
              <div key={i} className="text-sm text-amber-800">
                {a.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Bu ay gelir"
          value={formatTRY(s.thisMonth.income)}
          tone="good"
          icon={<ArrowUpRight size={18} />}
        />
        <StatCard
          label="Bu ay gider"
          value={formatTRY(s.thisMonth.expense)}
          tone="bad"
          icon={<ArrowDownRight size={18} />}
        />
        <StatCard
          label="Net"
          value={formatTRY(s.thisMonth.net)}
          tone={s.thisMonth.net >= 0 ? "good" : "bad"}
          icon={<Wallet size={18} />}
        />
        <StatCard
          label="Bütçe kullanımı"
          value={`%${s.thisMonth.budgetUsedPct}`}
          hint={`Bütçe: ${formatTRY(user.monthlyBudget)} • Hedef: ${formatTRY(user.savingsGoal)}`}
          tone={
            s.thisMonth.budgetUsedPct > 90
              ? "bad"
              : s.thisMonth.budgetUsedPct > 70
                ? "warn"
                : "good"
          }
          icon={<PiggyBank size={18} />}
        />
      </section>

      {/* Tasarruf Hedefi Progress */}
      {user.savingsGoal > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-semibold text-sm">
                Tasarruf Hedefi İlerleme
              </div>
              <div className="text-xs text-slate-500">
                Bu ay {formatTRY(Math.max(s.thisMonth.net, 0))} tasarruf / Hedef{" "}
                {formatTRY(user.savingsGoal)}
              </div>
            </div>
            <span
              className={`text-lg font-bold ${
                goalProgress >= 100
                  ? "text-emerald-600"
                  : goalProgress >= 50
                    ? "text-amber-600"
                    : "text-rose-600"
              }`}
            >
              %{Math.min(goalProgress, 999)}
            </span>
          </div>
          <ProgressBar
            value={goalProgress}
            tone={
              goalProgress >= 100 ? "good" : goalProgress >= 50 ? "warn" : "bad"
            }
          />
        </div>
      )}

      {/* Forecast + Achievements */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-semibold">30 Günlük Harcama Tahmini</h3>
              <p className="text-xs text-slate-500">
                Geçmiş 60 günün hareketli ortalaması ve haftalık döngüsel
                desenlere göre.
              </p>
            </div>
            <span
              className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                forecast.confidence === "high"
                  ? "bg-emerald-50 text-emerald-700"
                  : forecast.confidence === "medium"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              }`}
              title="Tahmin güven seviyesi"
            >
              {forecast.confidence === "high"
                ? "Yüksek güven"
                : forecast.confidence === "medium"
                  ? "Orta güven"
                  : "Düşük güven"}
            </span>
          </div>
          <ForecastChart forecast={forecast} />
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="rounded-lg bg-slate-50 p-2">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider">
                Günlük ortalama
              </div>
              <div className="text-sm font-bold mt-0.5">
                {formatTRY(forecast.averageDaily)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider">
                Sonraki 30 gün
              </div>
              <div className="text-sm font-bold mt-0.5 text-rose-600">
                {formatTRY(forecast.forecastTotal)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-2">
              <div className="text-[10px] uppercase text-slate-500 tracking-wider">
                Ay sonu (toplam)
              </div>
              <div className="text-sm font-bold mt-0.5">
                {formatTRY(forecast.monthEndTotal)}
              </div>
            </div>
          </div>
        </div>
        <AchievementsPanel achievements={achievements} compact />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <h3 className="font-semibold mb-1">6 aylık gelir-gider trendi</h3>
          <p className="text-xs text-slate-500 mb-3">
            Aylık karşılaştırmalı görünüm.
          </p>
          <IncomeExpenseLine data={s.trend} />
        </div>
        <div className="card">
          <h3 className="font-semibold mb-1">Bu ay harcama dağılımı</h3>
          <p className="text-xs text-slate-500 mb-3">Kategoriye göre.</p>
          <SpendingPie data={s.pie} />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <h3 className="font-semibold mb-1">Kategori bazında</h3>
          <p className="text-xs text-slate-500 mb-3">
            Bu ay en çok hangi kategoriye harcadın?
          </p>
          <CategoryBars data={s.pie} />
        </div>
        <div className="card">
          <h3 className="font-semibold mb-2">Son işlemler</h3>
          <ul className="divide-y divide-slate-100 text-sm">
            {data.transactions.slice(0, 8).map((t: Transaction) => (
              <li
                key={t._id}
                className="py-2 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{t.note || t.category}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(t.date).toLocaleDateString("tr-TR")} •{" "}
                    {t.category}
                  </div>
                </div>
                <div
                  className={
                    t.type === "gelir"
                      ? "text-emerald-600 font-medium"
                      : "text-rose-600 font-medium"
                  }
                >
                  {t.type === "gelir" ? "+" : "-"}
                  {formatTRY(t.amount)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

/* ─── Health Score Gauge Component ───────────────────────────── */

function HealthScoreGauge({ score }: { score: HealthScoreResult }) {
  const { overall, grade, trend, aiSummary, components } = score;
  const circumference = 2 * Math.PI * 54;
  const progress = (overall / 100) * circumference;
  const offset = circumference - progress;

  const gradeColor =
    overall >= 80
      ? "text-emerald-600"
      : overall >= 60
        ? "text-amber-600"
        : "text-rose-600";

  const strokeColor =
    overall >= 80 ? "#059669" : overall >= 60 ? "#d97706" : "#dc2626";

  const TrendIcon =
    trend === "improving"
      ? TrendingUp
      : trend === "declining"
        ? TrendingDown
        : Minus;

  const trendColor =
    trend === "improving"
      ? "text-emerald-600"
      : trend === "declining"
        ? "text-rose-600"
        : "text-slate-500";

  return (
    <div className="card !p-4 flex flex-col items-center justify-center">
      <div className="flex items-center gap-1.5 mb-2">
        <Heart size={16} className="text-brand-600" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Finansal Sağlık
        </span>
      </div>

      {/* SVG Gauge */}
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            stroke="#e2e8f0"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            stroke={strokeColor}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${gradeColor}`}>{grade}</span>
          <span className="text-sm text-slate-500">{overall}/100</span>
        </div>
      </div>

      {/* Trend */}
      <div
        className={`flex items-center gap-1 mt-2 text-xs font-medium ${trendColor}`}
      >
        <TrendIcon size={14} />
        {trend === "improving"
          ? "İyileşiyor"
          : trend === "declining"
            ? "Kötüleşiyor"
            : "Stabil"}
      </div>

      {/* AI Summary */}
      <div className="text-[11px] text-slate-500 text-center mt-2 leading-relaxed">
        {aiSummary}
      </div>

      {/* Component Bars */}
      <div className="w-full mt-3 space-y-1.5">
        {[
          { label: "Bütçe", value: components.budgetAdherence },
          { label: "Tasarruf", value: components.savingsRate },
          { label: "Stabilite", value: components.spendingStability },
          { label: "Risk", value: components.debtRisk },
          { label: "Çeşitlilik", value: components.diversification },
        ].map((c) => (
          <div key={c.label} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 w-14 text-right shrink-0">
              {c.label}
            </span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  c.value >= 70
                    ? "bg-emerald-500"
                    : c.value >= 40
                      ? "bg-amber-500"
                      : "bg-rose-500"
                }`}
                style={{ width: `${Math.min(c.value, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 w-6">{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

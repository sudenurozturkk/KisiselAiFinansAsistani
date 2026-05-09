"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import StatCard from "@/components/StatCard";
import {
  CategoryBars,
  IncomeExpenseLine,
  SpendingPie,
} from "@/components/Charts";
import { formatTRY } from "@/lib/finance";
import {
  ArrowDownRight,
  ArrowUpRight,
  PiggyBank,
  Wallet,
  AlertTriangle,
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
      const [u, t] = await Promise.all([
        api.getUser(),
        api.getTransactions(),
      ]);
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    );

  const s = data.summary;
  const insights = data.insights || [];
  const anomalies = data.anomalies || [];
  const goalProgress =
    user.savingsGoal > 0
      ? Math.round(
          (Math.max(s.thisMonth.net, 0) / user.savingsGoal) * 100,
        )
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

      <InsightsRow insights={insights} />

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
              <div className="font-semibold text-sm">Tasarruf Hedefi İlerleme</div>
              <div className="text-xs text-slate-500">
                Bu ay {formatTRY(Math.max(s.thisMonth.net, 0))} tasarruf / Hedef {formatTRY(user.savingsGoal)}
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
              goalProgress >= 100
                ? "good"
                : goalProgress >= 50
                  ? "warn"
                  : "bad"
            }
          />
        </div>
      )}

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

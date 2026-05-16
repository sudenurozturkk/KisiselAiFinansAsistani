"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { simulateScenario, getCategoryAverages } from "@/lib/simulator";
import type { ScenarioInput, ScenarioResult } from "@/lib/simulator";
import type { UserProfile, Transaction, Category } from "@/lib/types";
import type { FinanceSummary } from "@/lib/finance";
import { formatTRY } from "@/lib/finance";
import {
  TrendingDown,
  TrendingUp,
  Target,
  RotateCcw,
  PiggyBank,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui";

export default function SimulatorPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [incomeBoost, setIncomeBoost] = useState("");
  const [oneTimeExpense, setOneTimeExpense] = useState("");
  const [horizon, setHorizon] = useState(12);

  useEffect(() => {
    (async () => {
      const [u, t] = await Promise.all([api.getUser(), api.getTransactions()]);
      setUser(u.user);
      setTransactions(t.transactions);
      setSummary(t.summary);
    })();
  }, []);

  const categoryAverages = useMemo(
    () => getCategoryAverages(transactions, 3),
    [transactions],
  );

  const result: ScenarioResult | null = useMemo(() => {
    if (!user || !summary) return null;
    const input: ScenarioInput = {
      categoryAdjustments: adjustments as Partial<Record<Category, number>>,
      incomeBoost: incomeBoost ? Number(incomeBoost) : undefined,
      oneTimeExpense: oneTimeExpense ? Number(oneTimeExpense) : undefined,
      monthsHorizon: horizon,
    };
    return simulateScenario(input, user, transactions, summary);
  }, [adjustments, incomeBoost, oneTimeExpense, horizon, user, transactions, summary]);

  function setAdjustment(cat: string, value: number) {
    setAdjustments((prev) => ({ ...prev, [cat]: value }));
  }

  function reset() {
    setAdjustments({});
    setIncomeBoost("");
    setOneTimeExpense("");
    setHorizon(12);
  }

  if (!user || !summary || !result) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const { baseline, scenario, delta, goalMonths, insights } = result;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Target className="text-brand-600" size={22} aria-hidden="true" />
            Senaryo Simülatörü
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            "Eğer şu olsa…" sorularını AI'a sormadan, anlık olarak cevapla. Kategori
            harcamalarını ayarla ve etkisini gör.
          </p>
        </div>
        <button onClick={reset} className="btn-ghost">
          <RotateCcw size={16} aria-hidden="true" /> Sıfırla
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SOL: KONTROL PANELİ */}
        <section className="card space-y-4" aria-label="Senaryo kontrolleri">
          <div>
            <h3 className="font-semibold text-sm mb-1">Kategori Harcaması</h3>
            <p className="text-xs text-slate-500 mb-3">
              Slider'larla harcamalarını yüzde olarak değiştir (-100 ile +100 arası).
            </p>
            {categoryAverages.length === 0 ? (
              <p className="text-xs text-slate-500">
                Yeterli işlem verisi yok. Önce birkaç işlem ekle.
              </p>
            ) : (
              <div className="space-y-3">
                {categoryAverages.map((c) => (
                  <CategorySlider
                    key={c.category}
                    label={c.category}
                    monthlyAvg={c.monthlyAvg}
                    value={adjustments[c.category] ?? 0}
                    onChange={(v) => setAdjustment(c.category, v)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h3 className="font-semibold text-sm">Diğer Senaryolar</h3>
            <div>
              <label className="label">Aylık ek gelir (₺)</label>
              <input
                type="number"
                inputMode="decimal"
                className="input mt-1"
                placeholder="Örn: 5000 (yan iş, zam)"
                value={incomeBoost}
                onChange={(e) => setIncomeBoost(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Tek seferlik gider (₺)</label>
              <input
                type="number"
                inputMode="decimal"
                className="input mt-1"
                placeholder="Örn: 25000 (yeni telefon)"
                value={oneTimeExpense}
                onChange={(e) => setOneTimeExpense(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Süre (ay)</label>
              <select
                className="input mt-1"
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
              >
                <option value={3}>3 ay</option>
                <option value={6}>6 ay</option>
                <option value={12}>12 ay</option>
                <option value={24}>24 ay</option>
                <option value={36}>36 ay</option>
              </select>
            </div>
          </div>
        </section>

        {/* SAĞ: SONUÇLAR */}
        <section className="space-y-4">
          {/* Karşılaştırma kartları */}
          <div className="grid grid-cols-2 gap-3">
            <ComparisonCard
              label="Mevcut net"
              value={baseline.monthlyNet}
              tone="default"
            />
            <ComparisonCard
              label="Senaryo net"
              value={scenario.monthlyNet}
              tone={
                delta.netDiff > 0 ? "good" : delta.netDiff < 0 ? "bad" : "default"
              }
              delta={delta.netDiff}
            />
          </div>

          {/* Yıllık fark */}
          <div
            className={`card border-l-4 ${
              delta.yearlyDiff > 0
                ? "border-l-emerald-500"
                : delta.yearlyDiff < 0
                  ? "border-l-rose-500"
                  : "border-l-slate-300"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1">
              <PiggyBank size={16} aria-hidden="true" />
              {horizon} ay sonra fark
            </div>
            <div
              className={`text-3xl font-bold ${
                delta.yearlyDiff > 0
                  ? "text-emerald-600"
                  : delta.yearlyDiff < 0
                    ? "text-rose-600"
                    : "text-slate-700"
              }`}
            >
              {delta.yearlyDiff > 0 ? "+" : ""}
              {formatTRY(delta.yearlyDiff)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Mevcut: {formatTRY(baseline.yearlySavings)} → Senaryo:{" "}
              {formatTRY(scenario.yearlySavings)}
            </div>
          </div>

          {/* Hedef tahmin */}
          {goalMonths !== undefined && (
            <div className="card bg-gradient-to-br from-brand-50 to-purple-50 border-brand-200">
              <div className="flex items-center gap-2 text-sm font-medium text-brand-700 mb-1">
                <Target size={16} aria-hidden="true" />
                Tasarruf Hedefine Ulaşma
              </div>
              <div className="text-2xl font-bold text-brand-900">
                {goalMonths} ay
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Hedef: {formatTRY(user.savingsGoal)} • Senaryo aylık birikimi:{" "}
                {formatTRY(scenario.monthlyNet)}
              </div>
            </div>
          )}

          {/* AI insights */}
          {insights.length > 0 && (
            <div className="card space-y-2">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Lightbulb size={16} className="text-amber-500" aria-hidden="true" />
                Çıkarımlar
              </h3>
              <ul className="space-y-2">
                {insights.map((ins, i) => (
                  <li
                    key={i}
                    className="text-sm text-slate-700 flex items-start gap-2"
                  >
                    <ArrowRight
                      size={14}
                      className="text-brand-500 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{ins}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CategorySlider({
  label,
  monthlyAvg,
  value,
  onChange,
}: {
  label: string;
  monthlyAvg: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const newAvg = Math.max(0, Math.round(monthlyAvg * (1 + value / 100)));
  const diff = newAvg - monthlyAvg;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">
          {formatTRY(monthlyAvg)} →{" "}
          <strong
            className={
              diff < 0
                ? "text-emerald-600"
                : diff > 0
                  ? "text-rose-600"
                  : "text-slate-700"
            }
          >
            {formatTRY(newAvg)}
          </strong>
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="range"
          min={-100}
          max={100}
          step={5}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-brand-500"
          aria-label={`${label} ayarı`}
        />
        <span
          className={`text-xs font-mono w-12 text-right ${
            value < 0
              ? "text-emerald-600"
              : value > 0
                ? "text-rose-600"
                : "text-slate-400"
          }`}
        >
          {value > 0 ? "+" : ""}
          {value}%
        </span>
      </div>
    </div>
  );
}

function ComparisonCard({
  label,
  value,
  tone,
  delta,
}: {
  label: string;
  value: number;
  tone: "default" | "good" | "bad";
  delta?: number;
}) {
  const colorClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-rose-600"
        : "text-slate-700";

  return (
    <div className="card !p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold mt-1 ${colorClass}`}>
        {formatTRY(value)}
      </div>
      {delta !== undefined && delta !== 0 && (
        <div
          className={`text-xs mt-1 flex items-center gap-1 ${
            delta > 0 ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {delta > 0 ? (
            <TrendingUp size={12} />
          ) : (
            <TrendingDown size={12} />
          )}
          {delta > 0 ? "+" : ""}
          {formatTRY(delta)} fark
        </div>
      )}
    </div>
  );
}

/**
 * Finansal Senaryo Simülatörü
 *
 * Kullanıcının "Eğer şu olsa…" sorularını saf hesaplama ile cevaplar.
 * AI gerekmeden anında sonuç üretir.
 */

import type { Category, Transaction, UserProfile } from "./types";
import type { FinanceSummary } from "./finance";

export interface ScenarioInput {
  categoryAdjustments: Partial<Record<Category, number>>; // -100..+100 yüzde
  incomeBoost?: number;        // ek aylık gelir ₺
  oneTimeExpense?: number;     // tek seferlik gider ₺
  monthsHorizon?: number;      // simülasyon ayı (varsayılan 12)
}

export interface ScenarioResult {
  baseline: {
    monthlyExpense: number;
    monthlyNet: number;
    yearlySavings: number;
  };
  scenario: {
    monthlyExpense: number;
    monthlyNet: number;
    yearlySavings: number;
  };
  delta: {
    expenseDiff: number;     // ₺
    netDiff: number;         // ₺
    yearlyDiff: number;      // ₺
    expensePct: number;      // %
  };
  goalMonths?: number;       // hedefe ulaşmak için ay sayısı (varsa)
  insights: string[];        // doğal dil özet
}

function categorySpending(
  txs: Transaction[],
  monthsBack = 3,
): Record<Category, number> {
  const now = new Date();
  const result: Partial<Record<Category, number>> = {};
  const cutoff = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

  for (const t of txs) {
    if (t.type !== "gider") continue;
    const d = new Date(t.date);
    if (d < cutoff) continue;
    result[t.category] = (result[t.category] ?? 0) + t.amount;
  }

  // Aylık ortalamaya çevir
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(result)) {
    out[k] = (v ?? 0) / monthsBack;
  }
  return out as Record<Category, number>;
}

export function simulateScenario(
  input: ScenarioInput,
  user: UserProfile,
  transactions: Transaction[],
  summary: FinanceSummary,
): ScenarioResult {
  const baseline = {
    monthlyExpense: summary.thisMonth.expense,
    monthlyNet: summary.thisMonth.net,
    yearlySavings: Math.max(summary.thisMonth.net, 0) * 12,
  };

  const catSpending = categorySpending(transactions, 3);

  // Senaryo: kategori ayarları uygulanır
  let scenarioExpense = baseline.monthlyExpense;
  for (const [cat, pct] of Object.entries(input.categoryAdjustments)) {
    const current = catSpending[cat as Category] ?? 0;
    const adjustment = (current * (pct ?? 0)) / 100;
    scenarioExpense += adjustment; // negatif pct → negatif adjustment → düşüş
  }
  scenarioExpense = Math.max(0, Math.round(scenarioExpense));

  const scenarioIncome = baseline.monthlyExpense + baseline.monthlyNet + (input.incomeBoost ?? 0);
  const oneTime = input.oneTimeExpense ?? 0;

  const scenarioNet = scenarioIncome - scenarioExpense;
  const horizon = input.monthsHorizon ?? 12;
  const scenarioYearly = Math.max(scenarioNet, 0) * horizon - oneTime;

  // Hedefe kaç ay?
  let goalMonths: number | undefined;
  if (user.savingsGoal > 0 && scenarioNet > 0) {
    goalMonths = Math.ceil(user.savingsGoal / scenarioNet);
  }

  const expenseDiff = scenarioExpense - baseline.monthlyExpense;
  const netDiff = scenarioNet - baseline.monthlyNet;
  const yearlyDiff = scenarioYearly - baseline.yearlySavings;
  const expensePct =
    baseline.monthlyExpense > 0
      ? Math.round((expenseDiff / baseline.monthlyExpense) * 100)
      : 0;

  /* ─── Doğal dil özet üret ─── */
  const insights: string[] = [];
  if (expenseDiff < 0) {
    insights.push(
      `Aylık ${Math.abs(expenseDiff).toLocaleString("tr-TR")}₺ tasarruf elde ederdin (%${Math.abs(expensePct)} azalma).`,
    );
  } else if (expenseDiff > 0) {
    insights.push(
      `Aylık ${expenseDiff.toLocaleString("tr-TR")}₺ ekstra harcardın (%${expensePct} artış).`,
    );
  } else {
    insights.push("Harcamada belirgin bir değişim olmazdı.");
  }

  if (yearlyDiff > 0) {
    insights.push(
      `${horizon} ay sonra ${yearlyDiff.toLocaleString("tr-TR")}₺ daha fazla biriktirmiş olurdun.`,
    );
  } else if (yearlyDiff < 0) {
    insights.push(
      `${horizon} ay sonra ${Math.abs(yearlyDiff).toLocaleString("tr-TR")}₺ daha az biriktirmiş olurdun.`,
    );
  }

  if (goalMonths !== undefined) {
    if (goalMonths <= 12) {
      insights.push(
        `Bu hızla ${goalMonths} ay içinde tasarruf hedefine ulaşırdın. 🎯`,
      );
    } else {
      insights.push(
        `Tasarruf hedefine ulaşmak ${goalMonths} ay sürerdi.`,
      );
    }
  }

  if (oneTime > 0) {
    const months = scenarioNet > 0 ? Math.ceil(oneTime / scenarioNet) : null;
    insights.push(
      months !== null
        ? `Tek seferlik ${oneTime.toLocaleString("tr-TR")}₺ gideri ${months} ayda telafi ederdin.`
        : `Tek seferlik ${oneTime.toLocaleString("tr-TR")}₺ gider net pozitif gelir gerektirir.`,
    );
  }

  return {
    baseline,
    scenario: {
      monthlyExpense: scenarioExpense,
      monthlyNet: scenarioNet,
      yearlySavings: Math.round(scenarioYearly),
    },
    delta: {
      expenseDiff: Math.round(expenseDiff),
      netDiff: Math.round(netDiff),
      yearlyDiff: Math.round(yearlyDiff),
      expensePct,
    },
    goalMonths,
    insights,
  };
}

/** UI için kategori bazlı aylık ortalama harcama listesi */
export function getCategoryAverages(
  transactions: Transaction[],
  monthsBack = 3,
): { category: Category; monthlyAvg: number }[] {
  const sp = categorySpending(transactions, monthsBack);
  return Object.entries(sp)
    .map(([category, monthlyAvg]) => ({
      category: category as Category,
      monthlyAvg: Math.round(monthlyAvg),
    }))
    .filter((x) => x.monthlyAvg > 0)
    .sort((a, b) => b.monthlyAvg - a.monthlyAvg);
}

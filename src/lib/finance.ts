import type { Category, Insight, Transaction, UserProfile } from "./types";

export interface MonthAggregate {
  income: number;
  expense: number;
  net: number;
  budgetUsedPct: number;
  daysElapsed: number;
  daysInMonth: number;
}

export interface FinanceSummary {
  thisMonth: MonthAggregate;
  lastMonth: MonthAggregate;
  topCategories: { category: Category; amount: number }[];
  trend: { month: string; income: number; expense: number }[];
  pie: { name: string; value: number }[];
  dailyAvg: number;
  projectedMonthEnd: number;
  savingsRate: number; // % gelir - gider / gelir
}

export function summarizeFinance(txs: Transaction[], monthlyBudget = 0): FinanceSummary {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const thisMonthTx = filterMonth(txs, y, m);
  const last = new Date(y, m - 1, 1);
  const lastMonthTx = filterMonth(txs, last.getFullYear(), last.getMonth());

  const thisMonth = aggregate(thisMonthTx, monthlyBudget, now);
  const lastMonth = aggregate(lastMonthTx, monthlyBudget, new Date(last.getFullYear(), last.getMonth() + 1, 0));

  const byCat = new Map<Category, number>();
  for (const t of thisMonthTx) {
    if (t.type !== "gider") continue;
    byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount);
  }
  const topCategories = [...byCat.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const trend: FinanceSummary["trend"] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - i, 1);
    const monthTxs = filterMonth(txs, d.getFullYear(), d.getMonth());
    trend.push({
      month: d.toLocaleString("tr-TR", { month: "short", year: "2-digit" }),
      income: sum(monthTxs.filter((t) => t.type === "gelir")),
      expense: sum(monthTxs.filter((t) => t.type === "gider")),
    });
  }

  const dailyAvg = thisMonth.daysElapsed > 0 ? Math.round(thisMonth.expense / thisMonth.daysElapsed) : 0;
  const projectedMonthEnd = dailyAvg * thisMonth.daysInMonth;
  const savingsRate =
    thisMonth.income > 0 ? Math.round(((thisMonth.income - thisMonth.expense) / thisMonth.income) * 100) : 0;

  return {
    thisMonth,
    lastMonth,
    topCategories,
    trend,
    pie: topCategories.map((c) => ({ name: c.category, value: c.amount })),
    dailyAvg,
    projectedMonthEnd,
    savingsRate,
  };
}

function aggregate(txs: Transaction[], budget: number, ref: Date): MonthAggregate {
  const income = sum(txs.filter((t) => t.type === "gelir"));
  const expense = sum(txs.filter((t) => t.type === "gider"));
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.min(ref.getDate(), daysInMonth);
  return {
    income,
    expense,
    net: income - expense,
    budgetUsedPct: budget > 0 ? Math.round((expense / budget) * 100) : 0,
    daysElapsed,
    daysInMonth,
  };
}

function filterMonth(txs: Transaction[], year: number, month: number) {
  return txs.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function sum(arr: Transaction[]) {
  return arr.reduce((s, t) => s + t.amount, 0);
}

export function formatTRY(n: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(n);
}

export function pct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(0)}%`;
}

export function buildInsights(summary: FinanceSummary, user: UserProfile): Insight[] {
  const { thisMonth, lastMonth, topCategories, dailyAvg, projectedMonthEnd, savingsRate } = summary;
  const expenseDelta =
    lastMonth.expense > 0 ? Math.round(((thisMonth.expense - lastMonth.expense) / lastMonth.expense) * 100) : 0;
  const top = topCategories[0];
  const projOverBudget = user.monthlyBudget > 0 && projectedMonthEnd > user.monthlyBudget;
  const goalProgress =
    user.savingsGoal > 0 ? Math.round((Math.max(thisMonth.net, 0) / user.savingsGoal) * 100) : 0;

  const insights: Insight[] = [
    {
      id: "savings-rate",
      title: "Tasarruf oranı",
      value: `%${savingsRate}`,
      hint: savingsRate >= 20 ? "Sağlıklı seviye" : "Hedef en az %20",
      tone: savingsRate >= 20 ? "good" : savingsRate >= 10 ? "warn" : "bad",
    },
    {
      id: "daily-avg",
      title: "Günlük ortalama",
      value: formatTRY(dailyAvg),
      hint: `Ay sonu tahmini: ${formatTRY(projectedMonthEnd)}`,
      tone: projOverBudget ? "bad" : "info",
    },
    {
      id: "expense-delta",
      title: "Geçen aya göre gider",
      value: pct(expenseDelta),
      delta: expenseDelta,
      hint: expenseDelta <= 0 ? "Tebrikler, daha iyi yöndesin" : "Dikkat: artış var",
      tone: expenseDelta <= 0 ? "good" : expenseDelta < 10 ? "warn" : "bad",
    },
    {
      id: "top-category",
      title: "En yüksek kategori",
      value: top ? top.category : "—",
      hint: top ? `${formatTRY(top.amount)} bu ay` : "Veri yok",
      tone: "info",
    },
    {
      id: "goal-progress",
      title: "Hedefe ilerleme",
      value: `%${Math.min(goalProgress, 999)}`,
      hint: `Hedef: ${formatTRY(user.savingsGoal)}`,
      tone: goalProgress >= 100 ? "good" : goalProgress >= 50 ? "warn" : "bad",
    },
  ];
  return insights;
}

export function budgetAlertLevel(usedPct: number): "ok" | "warn" | "danger" {
  if (usedPct >= 100) return "danger";
  if (usedPct >= 80) return "warn";
  return "ok";
}

/* ─── Finansal Sağlık Skoru ─────────────────────────────────── */

export interface HealthScoreResult {
  overall: number;
  components: {
    budgetAdherence: number;
    savingsRate: number;
    spendingStability: number;
    debtRisk: number;
    diversification: number;
  };
  grade: "A+" | "A" | "B+" | "B" | "C" | "D" | "F";
  trend: "improving" | "stable" | "declining";
  aiSummary: string;
}

export function calculateHealthScore(
  summary: FinanceSummary,
  user: UserProfile,
  anomalyCount: number,
): HealthScoreResult {
  const { thisMonth, lastMonth, topCategories, savingsRate } = summary;

  // 1. Bütçe Uyumu (0-100): Bütçenin altında kalmak iyi
  const budgetUsed = thisMonth.budgetUsedPct;
  const budgetAdherence =
    budgetUsed <= 80
      ? 100
      : budgetUsed <= 100
        ? Math.round(100 - (budgetUsed - 80) * 2.5)
        : Math.max(0, Math.round(50 - (budgetUsed - 100) * 2));

  // 2. Tasarruf Oranı (0-100): %20+ tasarruf ideal
  const savingsScore =
    savingsRate >= 30
      ? 100
      : savingsRate >= 20
        ? Math.round(80 + (savingsRate - 20) * 2)
        : savingsRate >= 10
          ? Math.round(50 + (savingsRate - 10) * 3)
          : savingsRate >= 0
            ? Math.round(savingsRate * 5)
            : 0;

  // 3. Harcama Stabilitesi (0-100): Anomali yoksa iyi
  const spendingStability = Math.max(0, 100 - anomalyCount * 25);

  // 4. Borç Riski (0-100): Gider/gelir oranı düşük olmalı
  const expenseRatio =
    thisMonth.income > 0 ? thisMonth.expense / thisMonth.income : 1;
  const debtRisk =
    expenseRatio <= 0.5
      ? 100
      : expenseRatio <= 0.7
        ? Math.round(80 - (expenseRatio - 0.5) * 100)
        : expenseRatio <= 1.0
          ? Math.round(60 - (expenseRatio - 0.7) * 200)
          : 0;

  // 5. Çeşitlilik (0-100): 3+ kategoriye dağılmış harcama iyi
  const catCount = topCategories.length;
  const topCatRatio =
    topCategories.length > 0 && thisMonth.expense > 0
      ? topCategories[0].amount / thisMonth.expense
      : 1;
  const diversification = Math.min(
    100,
    Math.round(catCount * 15 + (1 - topCatRatio) * 40),
  );

  // Ağırlıklı ortalama
  const overall = Math.round(
    budgetAdherence * 0.3 +
      savingsScore * 0.25 +
      spendingStability * 0.15 +
      debtRisk * 0.2 +
      diversification * 0.1,
  );

  // Not
  const grade: HealthScoreResult["grade"] =
    overall >= 90
      ? "A+"
      : overall >= 80
        ? "A"
        : overall >= 70
          ? "B+"
          : overall >= 60
            ? "B"
            : overall >= 50
              ? "C"
              : overall >= 35
                ? "D"
                : "F";

  // Trend: bu ay vs geçen ay
  const lastExpenseRatio =
    lastMonth.income > 0 ? lastMonth.expense / lastMonth.income : 1;
  const trend: HealthScoreResult["trend"] =
    expenseRatio < lastExpenseRatio - 0.05
      ? "improving"
      : expenseRatio > lastExpenseRatio + 0.05
        ? "declining"
        : "stable";

  // AI özet
  const summaryParts: string[] = [];
  if (budgetAdherence >= 80)
    summaryParts.push("Bütçe kontrolün harika 👏");
  else if (budgetAdherence >= 50)
    summaryParts.push("Bütçeye dikkat etmelisin ⚠️");
  else summaryParts.push("Bütçe aşımı kritik seviyede 🚨");

  if (savingsScore >= 80)
    summaryParts.push("Tasarruf alışkanlığın çok sağlıklı 💰");
  else if (savingsScore >= 40)
    summaryParts.push("Tasarruf oranını artırabilirsin");
  else summaryParts.push("Acil tasarruf planı yapmalısın");

  if (anomalyCount > 0)
    summaryParts.push(
      `${anomalyCount} kategoride anormal harcama tespit edildi`,
    );

  if (trend === "improving") summaryParts.push("Genel trend olumlu 📈");
  else if (trend === "declining")
    summaryParts.push("Geçen aya göre kötüleşme var 📉");

  return {
    overall,
    components: {
      budgetAdherence,
      savingsRate: savingsScore,
      spendingStability,
      debtRisk,
      diversification,
    },
    grade,
    trend,
    aiSummary: summaryParts.join(" • "),
  };
}

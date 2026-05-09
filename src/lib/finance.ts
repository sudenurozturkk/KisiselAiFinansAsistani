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

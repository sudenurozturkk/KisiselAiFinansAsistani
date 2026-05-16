/**
 * Akıllı Bildirim Motoru
 *
 * Proaktif finansal uyarılar üretir:
 * - Yaklaşan abonelik ödemeleri
 * - Bütçe aşım uyarıları
 * - Tasarruf hedefi ilerleme hatırlatmaları
 * - AI bazlı kişisel tavsiyeler
 * - Anomali uyarıları
 */
import type { Transaction, UserProfile, Subscription } from "./types";
import { summarizeFinance, formatTRY } from "./finance";
import { detectAnomalies } from "./anomaly";

/* ─── Türler ───────────────────────────────────────────────── */

export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type AlertCategory =
  | "budget"
  | "subscription"
  | "savings"
  | "anomaly"
  | "insight"
  | "milestone";

export interface SmartAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  icon: string; // lucide icon name
  actionLabel?: string;
  actionHref?: string;
  dismissible: boolean;
}

/* ─── Ana Fonksiyon ────────────────────────────────────────── */

export function generateSmartAlerts(
  user: UserProfile,
  transactions: Transaction[],
  subscriptions: Subscription[],
): SmartAlert[] {
  const alerts: SmartAlert[] = [];
  const summary = summarizeFinance(transactions, user.monthlyBudget);
  const anomalies = detectAnomalies(transactions);
  const tm = summary.thisMonth;

  // 1. Bütçe Uyarıları
  if (tm.budgetUsedPct >= 100) {
    alerts.push({
      id: "budget-exceeded",
      category: "budget",
      severity: "critical",
      title: "Bütçe aşıldı!",
      description: `Bu ay bütçenin %${tm.budgetUsedPct}'ini kullandın. ${formatTRY(tm.expense - user.monthlyBudget)} fazla harcadın. Kalan ${tm.daysInMonth - tm.daysElapsed} gün boyunca harcamayı minimumda tut.`,
      icon: "AlertTriangle",
      actionLabel: "Harcama analizi",
      actionHref: "/dashboard",
      dismissible: false,
    });
  } else if (tm.budgetUsedPct >= 85) {
    const remaining = user.monthlyBudget - tm.expense;
    const daysLeft = tm.daysInMonth - tm.daysElapsed;
    const safeDailySpend = daysLeft > 0 ? Math.round(remaining / daysLeft) : 0;
    alerts.push({
      id: "budget-warning",
      category: "budget",
      severity: "warning",
      title: "Bütçe sınırına yaklaşıyorsun",
      description: `%${tm.budgetUsedPct} kullanıldı. Kalan ${formatTRY(remaining)} ile günlük ${formatTRY(safeDailySpend)} harcayabilirsin.`,
      icon: "TrendingDown",
      actionLabel: "Tasarruf önerileri",
      actionHref: "/recommendations",
      dismissible: true,
    });
  }

  // 2. Yaklaşan Abonelik Ödemeleri (3 gün içinde)
  const now = new Date();
  const threeDaysLater = new Date(now.getTime() + 3 * 86_400_000);
  const activeSubs = subscriptions.filter((s) => s.active);
  const upcomingPayments: { name: string; amount: number; daysUntil: number }[] = [];

  for (const sub of activeSubs) {
    if (!sub.nextPaymentDate) continue;
    const nextDate = new Date(sub.nextPaymentDate);
    const daysUntil = Math.ceil((nextDate.getTime() - now.getTime()) / 86_400_000);
    if (daysUntil >= 0 && daysUntil <= 3) {
      upcomingPayments.push({ name: sub.name, amount: sub.amount, daysUntil });
    }
  }

  if (upcomingPayments.length > 0) {
    const totalUpcoming = upcomingPayments.reduce((s, p) => s + p.amount, 0);
    const names = upcomingPayments.map((p) =>
      `${p.name} (${p.daysUntil === 0 ? "bugün" : `${p.daysUntil} gün`})`
    ).join(", ");
    alerts.push({
      id: "upcoming-subscriptions",
      category: "subscription",
      severity: "info",
      title: `${upcomingPayments.length} abonelik ödemesi yaklaşıyor`,
      description: `${names} — toplam ${formatTRY(totalUpcoming)}. Hazırlıklı ol!`,
      icon: "CreditCard",
      actionLabel: "Abonelikleri gör",
      actionHref: "/subscriptions",
      dismissible: true,
    });
  }

  // 3. Abonelik Optimizasyon Önerisi
  const totalMonthly = activeSubs.reduce((s, sub) => {
    if (sub.frequency === "haftalık") return s + sub.amount * 4.33;
    if (sub.frequency === "yıllık") return s + sub.amount / 12;
    return s + sub.amount;
  }, 0);

  if (totalMonthly > user.monthlyBudget * 0.08) {
    alerts.push({
      id: "subscription-heavy",
      category: "subscription",
      severity: "warning",
      title: "Abonelik harcamaların yüksek",
      description: `Aylık ${formatTRY(Math.round(totalMonthly))} abonelik ödüyorsun — bütçenin %${Math.round((totalMonthly / user.monthlyBudget) * 100)}'i. Kullanmadığın abonelikleri iptal etmeyi düşün.`,
      icon: "Scissors",
      actionLabel: "Abonelikleri analiz et",
      actionHref: "/subscriptions",
      dismissible: true,
    });
  }

  // 4. Tasarruf Hedefi İlerleme
  if (user.savingsGoal > 0) {
    const savedThisMonth = Math.max(0, tm.net);
    const goalProgress = Math.round((savedThisMonth / user.savingsGoal) * 100);

    if (goalProgress >= 100) {
      alerts.push({
        id: "savings-goal-met",
        category: "milestone",
        severity: "success",
        title: "🎉 Tasarruf hedefine ulaştın!",
        description: `Bu ay ${formatTRY(savedThisMonth)} tasarruf ettin — hedefin ${formatTRY(user.savingsGoal)} idi. Tebrikler!`,
        icon: "Trophy",
        dismissible: true,
      });
    } else if (goalProgress < 30 && tm.daysElapsed > tm.daysInMonth * 0.5) {
      alerts.push({
        id: "savings-goal-behind",
        category: "savings",
        severity: "warning",
        title: "Tasarruf hedefinin gerisinde kalıyorsun",
        description: `Ayın yarısı geçti, hedefin %${goalProgress}'ine ulaştın. Günlük harcamalarını ${formatTRY(Math.round((user.monthlyBudget - tm.expense) / (tm.daysInMonth - tm.daysElapsed)))}'ye düşürmelisin.`,
        icon: "Target",
        actionLabel: "Tasarruf planı",
        actionHref: "/chat",
        dismissible: true,
      });
    }
  }

  // 5. Anomali Uyarıları
  for (const anomaly of anomalies.slice(0, 2)) {
    alerts.push({
      id: `anomaly-${anomaly.category}`,
      category: "anomaly",
      severity: anomaly.severity === "severe" ? "critical" : "warning",
      title: `${anomaly.category} harcaması olağandışı`,
      description: anomaly.message,
      icon: "AlertOctagon",
      actionLabel: "Detay gör",
      actionHref: "/dashboard",
      dismissible: true,
    });
  }

  // 6. Pozitif Geri Bildirim (motivasyon)
  if (tm.budgetUsedPct <= 60 && tm.daysElapsed > 10) {
    alerts.push({
      id: "budget-great",
      category: "milestone",
      severity: "success",
      title: "Bütçe kontrolün mükemmel! 💪",
      description: `Ayın %${Math.round((tm.daysElapsed / tm.daysInMonth) * 100)}'inde bütçenin sadece %${tm.budgetUsedPct}'ini kullandın. Bu disiplini sürdür!`,
      icon: "Star",
      dismissible: true,
    });
  }

  // 7. AI Brief — Günlük Özet
  const dailyBudget = (user.monthlyBudget - tm.expense) / Math.max(1, tm.daysInMonth - tm.daysElapsed);
  alerts.push({
    id: "daily-brief",
    category: "insight",
    severity: "info",
    title: "Günlük Finans Özeti",
    description: `Bugün en fazla ${formatTRY(Math.round(dailyBudget))} harcayabilirsin. Bu ay ${formatTRY(tm.income)} gelir, ${formatTRY(tm.expense)} gider. ${tm.net >= 0 ? `${formatTRY(tm.net)} biriktirdin 🟢` : `${formatTRY(Math.abs(tm.net))} açıktan 🔴`}`,
    icon: "BarChart3",
    dismissible: false,
  });

  // Severity'ye göre sırala: critical > warning > info > success
  const severityOrder: Record<AlertSeverity, number> = {
    critical: 0, warning: 1, info: 2, success: 3,
  };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

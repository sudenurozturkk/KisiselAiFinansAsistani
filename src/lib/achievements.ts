/**
 * Rozet (Achievement) sistemi — finansal alışkanlıkları teşvik eder.
 *
 * Özellikler:
 *  - Saf fonksiyonlar; client veya server'da çalışır
 *  - Gerçek işlem verisinden hesaplanır (sahte rozet yok)
 *  - Üç katman: Bronze → Silver → Gold
 */

import type { Transaction, UserProfile } from "./types";
import type { FinanceSummary } from "./finance";

export type AchievementTier = "bronze" | "silver" | "gold";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji
  tier: AchievementTier;
  unlocked: boolean;
  progress: number; // 0-100
  hint?: string;
}

const TIER_ORDER: AchievementTier[] = ["bronze", "silver", "gold"];

export interface AchievementContext {
  user: UserProfile;
  transactions: Transaction[];
  summary: FinanceSummary;
  anomalyCount: number;
  subscriptionsCount?: number;
}

/* ─── Yardımcılar ───────────────────────────────────────────── */

function uniqueCategoryCount(txs: Transaction[]): number {
  return new Set(txs.filter((t) => t.type === "gider").map((t) => t.category)).size;
}

function consecutiveBudgetMonths(summary: FinanceSummary, monthlyBudget: number): number {
  if (monthlyBudget <= 0) return 0;
  let count = 0;
  for (const m of [...summary.trend].reverse()) {
    if (m.expense <= monthlyBudget) count++;
    else break;
  }
  return count;
}

function tierProgress(value: number, thresholds: [number, number, number]): {
  tier: AchievementTier;
  unlocked: boolean;
  progress: number;
} {
  const [b, s, g] = thresholds;
  if (value >= g) return { tier: "gold", unlocked: true, progress: 100 };
  if (value >= s) {
    return { tier: "silver", unlocked: true, progress: Math.round(((value - s) / (g - s)) * 100) };
  }
  if (value >= b) {
    return { tier: "bronze", unlocked: true, progress: Math.round(((value - b) / (s - b)) * 100) };
  }
  return {
    tier: "bronze",
    unlocked: false,
    progress: Math.min(100, Math.round((value / b) * 100)),
  };
}

/* ─── Rozet hesaplayıcılar ─────────────────────────────────── */

export function computeAchievements(ctx: AchievementContext): Achievement[] {
  const { user, transactions, summary, anomalyCount } = ctx;

  const achievements: Achievement[] = [];

  // 1. Tasarruf Canavarı — savings rate ≥ 10/20/30
  {
    const value = Math.max(summary.savingsRate, 0);
    const t = tierProgress(value, [10, 20, 30]);
    achievements.push({
      id: "savings-master",
      title: "Tasarruf Canavarı",
      description: `Aylık gelirinin %${value} kısmını biriktiriyorsun.`,
      icon: t.tier === "gold" ? "🏆" : t.tier === "silver" ? "🥈" : "🥉",
      tier: t.tier,
      unlocked: t.unlocked,
      progress: t.progress,
      hint:
        t.tier === "gold"
          ? "Maksimum seviyedesin!"
          : `Bir sonraki seviyeye %${
              t.tier === "silver" ? 30 : t.tier === "bronze" ? 20 : 10
            } tasarruf oranı`,
    });
  }

  // 2. Bütçe Ustası — bütçeye uyduğun ardışık ay sayısı
  {
    const months = consecutiveBudgetMonths(summary, user.monthlyBudget);
    const t = tierProgress(months, [1, 3, 6]);
    achievements.push({
      id: "budget-master",
      title: "Bütçe Ustası",
      description: `Üst üste ${months} ay bütçenin altında kaldın.`,
      icon: t.tier === "gold" ? "👑" : t.tier === "silver" ? "🎯" : "📊",
      tier: t.tier,
      unlocked: t.unlocked,
      progress: t.progress,
      hint: t.tier === "gold" ? "Disiplin sembolü!" : "Hedef: 6 ay üst üste",
    });
  }

  // 3. Çeşit Avcısı — bu ay farklı kategorilerde harcama
  {
    const cats = uniqueCategoryCount(
      transactions.filter((t) => {
        const d = new Date(t.date);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }),
    );
    const t = tierProgress(cats, [3, 5, 7]);
    achievements.push({
      id: "diversified-spender",
      title: "Dengeli Harcayan",
      description: `Bu ay ${cats} farklı kategoride harcama yaptın.`,
      icon: "🌈",
      tier: t.tier,
      unlocked: t.unlocked,
      progress: t.progress,
    });
  }

  // 4. Düzenli Kayıtçı — toplam işlem sayısı
  {
    const count = transactions.length;
    const t = tierProgress(count, [10, 50, 150]);
    achievements.push({
      id: "diligent-tracker",
      title: "Titiz Takipçi",
      description: `Toplam ${count} işlem kaydettin.`,
      icon: "📝",
      tier: t.tier,
      unlocked: t.unlocked,
      progress: t.progress,
    });
  }

  // 5. Anomali Avcısı — anomali olmayan ay (negatif rozet)
  {
    const value = Math.max(0, 5 - anomalyCount); // 0 anomali = 5
    const t = tierProgress(value, [3, 4, 5]);
    achievements.push({
      id: "stable-spender",
      title: "İstikrarlı Harcayan",
      description:
        anomalyCount === 0
          ? "Bu ay hiç harcama anomalisi yok!"
          : `Bu ay ${anomalyCount} anormal kategori tespit edildi.`,
      icon: anomalyCount === 0 ? "🛡️" : "⚠️",
      tier: t.tier,
      unlocked: t.unlocked,
      progress: t.progress,
      hint: anomalyCount > 0 ? "Anomalileri azaltarak yükselt" : undefined,
    });
  }

  // 6. Hedef Şampiyonu — savings goal'a ulaşma
  if (user.savingsGoal > 0) {
    const ratio = (Math.max(summary.thisMonth.net, 0) / user.savingsGoal) * 100;
    const value = Math.min(ratio, 200);
    const t = tierProgress(value, [50, 100, 150]);
    achievements.push({
      id: "goal-champion",
      title: "Hedef Şampiyonu",
      description: `Tasarruf hedefinin %${Math.round(value)} kadarını başardın.`,
      icon: "🎖️",
      tier: t.tier,
      unlocked: t.unlocked,
      progress: t.progress,
      hint: t.tier === "gold" ? "Hedefini aştın!" : "Hedefi geç ve altın kazan",
    });
  }

  return achievements;
}

/** Kazanılmış rozet sayısı + en yüksek tier */
export function summarizeAchievements(achievements: Achievement[]): {
  unlockedCount: number;
  total: number;
  highestTier: AchievementTier | null;
  completionPct: number;
} {
  const unlocked = achievements.filter((a) => a.unlocked);
  const tiers = unlocked
    .map((a) => TIER_ORDER.indexOf(a.tier))
    .filter((i) => i >= 0);
  const highestIdx = tiers.length > 0 ? Math.max(...tiers) : -1;
  return {
    unlockedCount: unlocked.length,
    total: achievements.length,
    highestTier: highestIdx >= 0 ? TIER_ORDER[highestIdx] ?? null : null,
    completionPct: achievements.length > 0
      ? Math.round((unlocked.length / achievements.length) * 100)
      : 0,
  };
}

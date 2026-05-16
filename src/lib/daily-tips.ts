/**
 * AI Günlük Tavsiye Motoru
 *
 * Kullanıcının finansal durumuna göre kişiselleştirilmiş,
 * eyleme dönüştürülebilir günlük tavsiyeler üretir.
 * Gemini API olmadan da çalışır (rule-based fallback).
 */
import type { Transaction, UserProfile } from "./types";
import { summarizeFinance, formatTRY } from "./finance";

/* ─── Türler ───────────────────────────────────────────────── */

export interface DailyTip {
  id: string;
  emoji: string;
  title: string;
  description: string;
  category: "saving" | "spending" | "investing" | "behavioral" | "goal";
}

/* ─── Ana Fonksiyon ────────────────────────────────────────── */

export function generateDailyTips(
  user: UserProfile,
  transactions: Transaction[],
): DailyTip[] {
  const summary = summarizeFinance(transactions, user.monthlyBudget);
  const tm = summary.thisMonth;
  const tips: DailyTip[] = [];

  const daysLeft = tm.daysInMonth - tm.daysElapsed;
  const remaining = Math.max(0, user.monthlyBudget - tm.expense);
  const dailyBudget = daysLeft > 0 ? Math.round(remaining / daysLeft) : 0;
  const topCat = summary.topCategories[0];

  // 1. Günlük bütçe tavsiyesi
  if (dailyBudget > 0) {
    tips.push({
      id: "daily-budget",
      emoji: "💰",
      title: `Bugün ${formatTRY(dailyBudget)} harcama limiti`,
      description: `Ayın kalan ${daysLeft} günü için günlük ${formatTRY(dailyBudget)} ile bütçenin içinde kalırsın. Bugün harcamasan, yarın ${formatTRY(dailyBudget * 2)} bütçen olur!`,
      category: "spending",
    });
  }

  // 2. En yüksek kategori optimizasyonu
  if (topCat && tm.expense > 0) {
    const catPct = Math.round((topCat.amount / tm.expense) * 100);
    if (catPct > 30) {
      tips.push({
        id: "top-category",
        emoji: "📊",
        title: `${topCat.category} harcaması bütçenin %${catPct}'i`,
        description: `Bu kategoride %10 tasarruf etsen aylık ${formatTRY(Math.round(topCat.amount * 0.1))} biriktirirsin. Alternatif: daha uygun markalar, toplu alım, indirim günleri.`,
        category: "saving",
      });
    }
  }

  // 3. 50/30/20 kuralı analizi
  const needsRatio = tm.expense > 0 ? (summary.topCategories
    .filter((c) => ["Kira/Fatura", "Gıda", "Ulaşım", "Sağlık"].includes(c.category))
    .reduce((s, c) => s + c.amount, 0) / tm.income) * 100 : 0;
  const wantsRatio = tm.expense > 0 ? (summary.topCategories
    .filter((c) => ["Eğlence", "Alışveriş"].includes(c.category))
    .reduce((s, c) => s + c.amount, 0) / tm.income) * 100 : 0;

  if (wantsRatio > 30 && tm.income > 0) {
    tips.push({
      id: "50-30-20",
      emoji: "📐",
      title: "İstek harcamaları yüksek",
      description: `50/30/20 kuralına göre istekler gelirin %30'unu geçmemeli. Senin istek harcaman %${Math.round(wantsRatio)}. Eğlence ve alışverişte ${formatTRY(Math.round(tm.income * (wantsRatio - 30) / 100))} kısarak dengeye getir.`,
      category: "behavioral",
    });
  }

  // 4. Tasarruf hedefi motivasyonu
  if (user.savingsGoal > 0) {
    const saved = Math.max(0, tm.net);
    const progress = Math.round((saved / user.savingsGoal) * 100);
    if (progress >= 80 && progress < 100) {
      tips.push({
        id: "goal-almost",
        emoji: "🎯",
        title: "Hedefine çok yakınsın!",
        description: `Tasarruf hedefinin %${progress}'ine ulaştın. ${formatTRY(user.savingsGoal - saved)} daha biriktirirsen bu ay hedefini tamamlarsın!`,
        category: "goal",
      });
    } else if (progress < 30) {
      tips.push({
        id: "goal-action",
        emoji: "🚀",
        title: "Tasarruf hızlandırma zamanı",
        description: `Hedefin ${formatTRY(user.savingsGoal)}, şu an ${formatTRY(saved)} biriktirdin. Her gün ${formatTRY(Math.round((user.savingsGoal - saved) / Math.max(1, daysLeft)))} ayırırsan hedefe ulaşırsın.`,
        category: "goal",
      });
    }
  }

  // 5. Yatırım önerisi
  if (tm.net > user.monthlyIncome * 0.1 && summary.savingsRate >= 15) {
    const investAmount = Math.round(tm.net * 0.3);
    tips.push({
      id: "invest-nudge",
      emoji: "📈",
      title: "Yatırıma yönlendir",
      description: `Bu ay ${formatTRY(tm.net)} biriktirdin. ${formatTRY(investAmount)}'sini ${user.riskTolerance === "yüksek" ? "hisse senedi/fonlara" : user.riskTolerance === "orta" ? "karma fonlara" : "vadeli mevduata"} yönlendirmeyi düşün. (Yatırım tavsiyesi değildir.)`,
      category: "investing",
    });
  }

  // 6. Geçen aya kıyasla trend
  const expDelta = summary.lastMonth.expense > 0
    ? Math.round(((tm.expense - summary.lastMonth.expense) / summary.lastMonth.expense) * 100)
    : 0;
  if (expDelta > 15) {
    tips.push({
      id: "trend-up",
      emoji: "⚠️",
      title: `Harcamalar geçen aya göre %${expDelta} arttı`,
      description: `Geçen ay ${formatTRY(summary.lastMonth.expense)}, bu ay ${formatTRY(tm.expense)}. Ana artış ${topCat ? topCat.category : "genel"} kategorisinde. Bilinçli harca!`,
      category: "behavioral",
    });
  } else if (expDelta < -10) {
    tips.push({
      id: "trend-down",
      emoji: "🎉",
      title: `Tebrikler! Harcamalar %${Math.abs(expDelta)} azaldı`,
      description: `Geçen ay ${formatTRY(summary.lastMonth.expense)}, bu ay ${formatTRY(tm.expense)}. Bu disiplini sürdür — yıl sonunda ${formatTRY(Math.round(Math.abs(tm.expense - summary.lastMonth.expense) * 12))} tasarruf!`,
      category: "saving",
    });
  }

  // 7. Latte faktörü
  const smallSpending = transactions.filter((t) => {
    const d = new Date(t.date);
    return t.type === "gider" && t.amount <= 100 && d.getMonth() === new Date().getMonth();
  });
  const smallTotal = smallSpending.reduce((s, t) => s + t.amount, 0);
  if (smallSpending.length > 10 && smallTotal > user.monthlyBudget * 0.05) {
    tips.push({
      id: "latte-factor",
      emoji: "☕",
      title: "Küçük harcamalar büyük toplam!",
      description: `Bu ay ${smallSpending.length} küçük harcama (≤100₺) yaptın, toplam ${formatTRY(smallTotal)}. Bunların yarısını kesersen aylık ${formatTRY(Math.round(smallTotal / 2))} tasarruf!`,
      category: "behavioral",
    });
  }

  return tips.slice(0, 4); // En fazla 4 tavsiye
}

/**
 * AI Abonelik Optimizasyonu
 *
 * Her abonelik için Gemini AI ile kişiselleştirilmiş
 * "İptal et / Tut / Düşür" analizi üretir.
 */
import type { Subscription, UserProfile, Transaction } from "./types";
import { summarizeFinance, formatTRY } from "./finance";

/* ─── Türler ───────────────────────────────────────────────── */

export type SubVerdict = "keep" | "cancel" | "downgrade" | "negotiate";

export interface SubOptimization {
  subscriptionId: string;
  name: string;
  verdict: SubVerdict;
  reason: string;
  monthlySaving: number;
  alternative?: string;
  confidence: number; // 0-100
}

export interface SubOptimizationReport {
  optimizations: SubOptimization[];
  totalMonthlySaving: number;
  totalYearlySaving: number;
  summary: string;
}

/* ─── Yardımcılar ──────────────────────────────────────────── */

function monthlyAmount(sub: Subscription): number {
  if (sub.frequency === "haftalık") return sub.amount * 4.33;
  if (sub.frequency === "yıllık") return sub.amount / 12;
  return sub.amount;
}

/** İşlem geçmişinde aboneliğin kullanılıp kullanılmadığını tahmin et */
function estimateUsage(sub: Subscription, txs: Transaction[]): { usedMonths: number; totalMonths: number } {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 86_400_000);
  const subNameLower = sub.name.toLowerCase();

  // Son 6 ayda bu abonelikle ilgili işlem var mı?
  const relatedTx = txs.filter((t) => {
    const d = new Date(t.date);
    if (d < sixMonthsAgo) return false;
    const noteLower = (t.note || "").toLowerCase();
    return noteLower.includes(subNameLower) || subNameLower.includes(noteLower.split(" ")[0]);
  });

  // Kaç farklı ayda kullanılmış?
  const months = new Set(relatedTx.map((t) => {
    const d = new Date(t.date);
    return `${d.getFullYear()}-${d.getMonth()}`;
  }));

  return { usedMonths: months.size, totalMonths: 6 };
}

/* ─── Ana Fonksiyon ────────────────────────────────────────── */

export function generateSubOptimizations(
  subscriptions: Subscription[],
  user: UserProfile,
  transactions: Transaction[],
): SubOptimizationReport {
  const activeSubs = subscriptions.filter((s) => s.active);
  const summary = summarizeFinance(transactions, user.monthlyBudget);

  const totalSubMonthly = activeSubs.reduce((s, sub) => s + monthlyAmount(sub), 0);
  const subBudgetRatio = totalSubMonthly / Math.max(1, user.monthlyBudget);
  const isOverBudget = summary.thisMonth.budgetUsedPct > 90;

  const optimizations: SubOptimization[] = [];

  for (const sub of activeSubs) {
    const monthly = monthlyAmount(sub);
    const usage = estimateUsage(sub, transactions);
    const isExpensive = monthly > user.monthlyBudget * 0.03;
    const isLowUsage = usage.usedMonths < usage.totalMonths * 0.4;

    let verdict: SubVerdict = "keep";
    let reason = "";
    let monthlySaving = 0;
    let alternative: string | undefined;
    let confidence = 50;

    // Spor salonu: en büyük tasarruf potansiyeli
    if (sub.name.toLowerCase().includes("macfit") || sub.name.toLowerCase().includes("spor")) {
      if (isOverBudget) {
        verdict = "cancel";
        reason = `Bütçen %${summary.thisMonth.budgetUsedPct} kullanılmış durumda. Aylık ${formatTRY(monthly)} olan spor salonu aboneliğini iptal edip, ücretsiz ev egzersizleri veya açık hava sporlarına geçmeyi düşün.`;
        monthlySaving = monthly;
        alternative = "YouTube ücretsiz antrenman kanalları, parkta koşu";
        confidence = 75;
      } else {
        verdict = "keep";
        reason = `Sağlık yatırımı olarak değerli. Aylık ${formatTRY(monthly)} ile sağlığına yatırım yapıyorsun.`;
        confidence = 60;
      }
    }
    // Streaming overlap kontrolü
    else if (["netflix", "disney", "blutv", "exxen", "gain", "mubi"].some((s) =>
      sub.name.toLowerCase().includes(s)
    )) {
      const otherStreaming = activeSubs.filter((s) =>
        s._id !== sub._id &&
        ["netflix", "disney", "blutv", "exxen", "gain", "mubi", "youtube"].some((name) =>
          s.name.toLowerCase().includes(name)
        )
      );

      if (otherStreaming.length >= 2) {
        verdict = "cancel";
        reason = `${otherStreaming.length + 1} streaming aboneliğin var (${otherStreaming.map((s) => s.name).join(", ")} ve ${sub.name}). Aynı anda ${otherStreaming.length + 1} platform izlemek pratik değil. En az birini iptal et.`;
        monthlySaving = monthly;
        alternative = `Dönüşümlü kullan: 2 ay ${sub.name}, 2 ay ${otherStreaming[0].name}`;
        confidence = 70;
      } else {
        verdict = "keep";
        reason = `Tek streaming aboneliğin olarak makul bir eğlence harcaması. Aylık ${formatTRY(monthly)}.`;
        confidence = 65;
      }
    }
    // Müzik
    else if (sub.name.toLowerCase().includes("spotify") || sub.name.toLowerCase().includes("apple music")) {
      const ytPremium = activeSubs.find((s) => s.name.toLowerCase().includes("youtube premium"));
      if (ytPremium) {
        verdict = "cancel";
        reason = `YouTube Premium zaten YouTube Music içeriyor. Spotify'a ayrıca ${formatTRY(monthly)} ödemen gereksiz.`;
        monthlySaving = monthly;
        alternative = "YouTube Music (YouTube Premium ile ücretsiz)";
        confidence = 90;
      } else {
        verdict = "keep";
        reason = `Müzik dinlemek mental sağlık için önemli. Aylık ${formatTRY(monthly)} makul.`;
        confidence = 55;
      }
    }
    // YouTube Premium
    else if (sub.name.toLowerCase().includes("youtube")) {
      const spotify = activeSubs.find((s) => s.name.toLowerCase().includes("spotify"));
      if (spotify) {
        verdict = "negotiate";
        reason = `YouTube Premium + Spotify birlikte aylık ${formatTRY(monthly + monthlyAmount(spotify))}. YouTube Premium'u aile planına geçirerek ${formatTRY(Math.round(monthly * 0.4))} tasarruf edebilirsin.`;
        monthlySaving = Math.round(monthly * 0.4);
        alternative = "YouTube Premium Aile Planı (5 kişiye kadar)";
        confidence = 80;
      } else {
        verdict = "keep";
        reason = `Reklamsız izleme + YouTube Music dahil. ${formatTRY(monthly)} için iyi değer.`;
        confidence = 60;
      }
    }
    // Domain / hosting gibi iş araçları
    else if (sub.name.toLowerCase().includes("domain") || sub.name.toLowerCase().includes("hosting") || sub.name.toLowerCase().includes("adobe")) {
      verdict = "keep";
      reason = `Profesyonel/iş aracı — gelir potansiyeli olan bir yatırım. ${formatTRY(monthly)}/ay.`;
      confidence = 85;
    }
    // iCloud
    else if (sub.name.toLowerCase().includes("icloud")) {
      verdict = "downgrade";
      reason = `iCloud ${formatTRY(monthly)}/ay. Fotoğrafları Google Fotoğraflar'a (15GB ücretsiz) yedekleyerek iCloud kapasiteni düşürebilirsin.`;
      monthlySaving = Math.round(monthly * 0.5);
      alternative = "Google Fotoğraflar (15GB ücretsiz) + iCloud 50GB";
      confidence = 65;
    }
    // Genel: pahalı + düşük kullanım
    else if (isExpensive && isLowUsage) {
      verdict = "cancel";
      reason = `${sub.name} aylık ${formatTRY(monthly)} tutuyor ama son 6 ayda sadece ${usage.usedMonths} ay kullanılmış görünüyor. İhtiyacını yeniden değerlendir.`;
      monthlySaving = monthly;
      confidence = 60;
    }
    // Genel: bütçe basıncı
    else if (isOverBudget && isExpensive) {
      verdict = "downgrade";
      reason = `Bütçe baskısı altındasın (%${summary.thisMonth.budgetUsedPct}). ${sub.name} için daha uygun bir plan var mı kontrol et.`;
      monthlySaving = Math.round(monthly * 0.3);
      confidence = 50;
    }
    // Varsayılan
    else {
      verdict = "keep";
      reason = `${sub.name} makul bir harcama. ${formatTRY(monthly)}/ay.`;
      confidence = 40;
    }

    optimizations.push({
      subscriptionId: sub._id,
      name: sub.name,
      verdict,
      reason,
      monthlySaving,
      alternative,
      confidence,
    });
  }

  const totalMonthlySaving = optimizations.reduce((s, o) => s + o.monthlySaving, 0);
  const totalYearlySaving = totalMonthlySaving * 12;

  // Özet metin
  const cancelCount = optimizations.filter((o) => o.verdict === "cancel").length;
  const downgradeCount = optimizations.filter((o) => o.verdict === "downgrade").length;
  const summaryText = totalMonthlySaving > 0
    ? `${cancelCount > 0 ? `${cancelCount} abonelik iptal` : ""}${cancelCount > 0 && downgradeCount > 0 ? " ve " : ""}${downgradeCount > 0 ? `${downgradeCount} abonelik düşürme` : ""} ile aylık ${formatTRY(totalMonthlySaving)}, yıllık ${formatTRY(totalYearlySaving)} tasarruf edebilirsin.`
    : "Aboneliklerinde şu an optimize edilecek önemli bir alan görünmüyor. Güzel yönetiyorsun! 👏";

  return {
    optimizations: optimizations.sort((a, b) => b.monthlySaving - a.monthlySaving),
    totalMonthlySaving,
    totalYearlySaving,
    summary: summaryText,
  };
}

/**
 * Harcama anomali tespiti — z-score bazlı.
 * Son 6 ayın ortalamasına göre bu ayda anormal yüksek harcanan kategorileri tespit eder.
 */
import type { Category, SpendingAnomaly, Transaction } from "./types";

interface CategoryStats {
  category: Category;
  months: number[];
  mean: number;
  stdDev: number;
}

/** Her kategori için aylık harcama istatistiklerini hesapla (son 6 ay) */
function computeCategoryStats(txs: Transaction[]): CategoryStats[] {
  const now = new Date();
  const buckets = new Map<string, Map<number, number>>();

  // Son 6 ayı indeksle (0 = bu ay, 5 = 5 ay önce)
  for (const t of txs) {
    if (t.type !== "gider") continue;
    const d = new Date(t.date);
    const monthDiff =
      (now.getFullYear() - d.getFullYear()) * 12 +
      (now.getMonth() - d.getMonth());
    if (monthDiff < 0 || monthDiff > 5) continue;

    const cat = t.category;
    if (!buckets.has(cat)) buckets.set(cat, new Map());
    const catMap = buckets.get(cat)!;
    catMap.set(monthDiff, (catMap.get(monthDiff) ?? 0) + t.amount);
  }

  const stats: CategoryStats[] = [];
  for (const [cat, monthMap] of buckets) {
    const months: number[] = [];
    for (let i = 0; i <= 5; i++) {
      months.push(monthMap.get(i) ?? 0);
    }
    // Geçmiş aylar (1-5) üzerinden ortalama ve standart sapma
    const pastMonths = months.slice(1);
    const mean =
      pastMonths.length > 0
        ? pastMonths.reduce((a, b) => a + b, 0) / pastMonths.length
        : 0;
    const variance =
      pastMonths.length > 0
        ? pastMonths.reduce((s, v) => s + (v - mean) ** 2, 0) /
          pastMonths.length
        : 0;
    const stdDev = Math.sqrt(variance);

    stats.push({ category: cat as Category, months, mean, stdDev });
  }
  return stats;
}

/** Z-score bazlı anomali tespiti */
export function detectAnomalies(txs: Transaction[]): SpendingAnomaly[] {
  const stats = computeCategoryStats(txs);
  const anomalies: SpendingAnomaly[] = [];

  for (const s of stats) {
    const currentAmount = s.months[0]; // Bu ay
    if (currentAmount === 0 || s.mean === 0) continue;

    // Standart sapma çok düşükse (sabit harcama), küçük artışları yoksay
    const effectiveStdDev = Math.max(s.stdDev, s.mean * 0.15);
    const zScore = (currentAmount - s.mean) / effectiveStdDev;

    if (zScore >= 1.5) {
      const severity: SpendingAnomaly["severity"] =
        zScore >= 3 ? "severe" : zScore >= 2 ? "moderate" : "mild";

      const pctIncrease = Math.round(
        ((currentAmount - s.mean) / s.mean) * 100,
      );

      anomalies.push({
        category: s.category,
        currentAmount,
        avgAmount: Math.round(s.mean),
        zScore: Math.round(zScore * 10) / 10,
        severity,
        message: buildAnomalyMessage(s.category, pctIncrease, severity),
      });
    }
  }

  return anomalies.sort((a, b) => b.zScore - a.zScore);
}

function buildAnomalyMessage(
  category: Category,
  pctIncrease: number,
  severity: SpendingAnomaly["severity"],
): string {
  const prefix = {
    mild: "📊",
    moderate: "⚠️",
    severe: "🚨",
  }[severity];

  return `${prefix} ${category} harcamaların bu ay ortalamaya göre %${pctIncrease} arttı. ${
    severity === "severe"
      ? "Bu ciddi bir sapma — bütçe planını gözden geçir."
      : severity === "moderate"
        ? "Dikkatli olmanı öneririm."
        : "Takip etmende fayda var."
  }`;
}

/**
 * Finansal Ayna — Duygusal Harcama Analizi
 *
 * İstatistiksel desenler (gün/saat matrisi) burada hesaplanır;
 * yorum ve içgörü metinleri Gemini AI ile üretilir (bkz. gemini.ts).
 */
import type { Transaction } from "./types";

/* ─── Türler ───────────────────────────────────────────────── */

const DAY_LABELS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

const HOUR_SLOTS: { label: string; range: [number, number] }[] = [
  { label: "Sabah (06–12)", range: [6, 11] },
  { label: "Öğlen (12–14)", range: [12, 13] },
  { label: "Öğleden sonra (14–18)", range: [14, 17] },
  { label: "Akşam (18–22)", range: [18, 21] },
  { label: "Gece (22–06)", range: [22, 5] },
];

export interface TimePattern {
  dayOfWeek: number;
  dayLabel: string;
  hourSlot: string;
  avgSpend: number;
  txCount: number;
  totalSpend: number;
  deviationPct: number; // Genel ortalamadan sapma (%)
}

export interface EmotionalInsight {
  type: "warning" | "pattern" | "positive";
  title: string;
  description: string;
  dayLabel?: string;
  hourSlot?: string;
  severity: number; // 1-5
}

export interface FinancialMirrorResult {
  patterns: TimePattern[];
  insights: EmotionalInsight[];
  riskDays: string[];
  safeDays: string[];
  weekdayAvg: number;
  weekendAvg: number;
  weekendPremium: number;
  /** Gemini'nin yazdığı genel duygusal harcama özeti */
  aiSummary: string;
  /** Tespit edilen duygusal tetikleyiciler */
  emotionalTriggers: string[];
  /** Uygulanabilir öneriler */
  recommendations: string[];
}

/* ─── Yardımcılar ──────────────────────────────────────────── */

function getHourSlot(hour: number): string {
  if (hour >= 22 || hour < 6) return "Gece (22–06)";
  if (hour >= 6 && hour < 12) return "Sabah (06–12)";
  if (hour >= 12 && hour < 14) return "Öğlen (12–14)";
  if (hour >= 14 && hour < 18) return "Öğleden sonra (14–18)";
  return "Akşam (18–22)";
}

/* ─── Ana Analiz Fonksiyonu ────────────────────────────────── */

/** Son 90 günün gün/saat harcama matrisi ve özet istatistikler (AI öncesi bağlam). */
export function buildEmotionalSpendingContext(
  transactions: Transaction[],
): Omit<
  FinancialMirrorResult,
  "insights" | "aiSummary" | "emotionalTriggers" | "recommendations"
> & { promptForAI: string; expenseCount: number } {
  // Son 90 gündeki gider işlemlerini al
  const now = new Date();
  const cutoff = new Date(now.getTime() - 90 * 86_400_000);
  const expenses = transactions.filter(
    (t) => t.type === "gider" && new Date(t.date) >= cutoff,
  );

  if (expenses.length === 0) {
    return {
      patterns: [],
      riskDays: [],
      safeDays: [],
      weekdayAvg: 0,
      weekendAvg: 0,
      weekendPremium: 0,
      promptForAI: "Yeterli veri yok.",
      expenseCount: 0,
    };
  }

  // Gün × Saat Slotu matrisini oluştur
  const grid = new Map<string, { total: number; count: number }>();
  for (const tx of expenses) {
    const d = new Date(tx.date);
    const key = `${d.getDay()}-${getHourSlot(d.getHours())}`;
    const cell = grid.get(key) || { total: 0, count: 0 };
    cell.total += tx.amount;
    cell.count += 1;
    grid.set(key, cell);
  }

  // Genel ortalama hesapla
  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const overallAvg = totalExpense / expenses.length;

  // Pattern'leri oluştur
  const patterns: TimePattern[] = [];
  for (const [key, cell] of grid) {
    const [dayStr, hourSlot] = key.split("-");
    const dayOfWeek = parseInt(dayStr, 10);
    const avg = cell.total / cell.count;
    const deviationPct = overallAvg > 0
      ? Math.round(((avg - overallAvg) / overallAvg) * 100)
      : 0;

    patterns.push({
      dayOfWeek,
      dayLabel: DAY_LABELS[dayOfWeek],
      hourSlot,
      avgSpend: Math.round(avg),
      txCount: cell.count,
      totalSpend: Math.round(cell.total),
      deviationPct,
    });
  }

  // Gün bazlı toplamlar
  const dayTotals = new Map<number, { total: number; count: number }>();
  for (const tx of expenses) {
    const d = new Date(tx.date);
    const day = d.getDay();
    const entry = dayTotals.get(day) || { total: 0, count: 0 };
    entry.total += tx.amount;
    entry.count += 1;
    dayTotals.set(day, entry);
  }

  // Hafta içi vs hafta sonu
  let weekdayTotal = 0, weekdayCount = 0;
  let weekendTotal = 0, weekendCount = 0;
  for (const [day, data] of dayTotals) {
    if (day === 0 || day === 6) {
      weekendTotal += data.total;
      weekendCount += data.count;
    } else {
      weekdayTotal += data.total;
      weekdayCount += data.count;
    }
  }
  const weekdayAvg = weekdayCount > 0 ? Math.round(weekdayTotal / weekdayCount) : 0;
  const weekendAvg = weekendCount > 0 ? Math.round(weekendTotal / weekendCount) : 0;
  const weekendPremium = weekdayAvg > 0
    ? Math.round(((weekendAvg - weekdayAvg) / weekdayAvg) * 100)
    : 0;

  const riskPatterns = patterns
    .filter((p) => p.deviationPct > 30 && p.txCount >= 2)
    .sort((a, b) => b.deviationPct - a.deviationPct);
  const safePatterns = patterns
    .filter((p) => p.deviationPct < -20 && p.txCount >= 2)
    .sort((a, b) => a.deviationPct - b.deviationPct);

  const riskDays = riskPatterns.map((p) => `${p.dayLabel} ${p.hourSlot.split(" ")[0]}`);
  const safeDays = safePatterns.map((p) => `${p.dayLabel} ${p.hourSlot.split(" ")[0]}`);

  const promptForAI = buildAIPrompt(
    patterns,
    weekdayAvg,
    weekendAvg,
    weekendPremium,
    expenses,
    riskDays,
    safeDays,
  );

  return {
    patterns: patterns.sort((a, b) => b.deviationPct - a.deviationPct),
    riskDays,
    safeDays,
    weekdayAvg,
    weekendAvg,
    weekendPremium,
    promptForAI,
    expenseCount: expenses.length,
  };
}

/** Geriye uyumluluk — yalnızca istatistik bağlamı (içgörüler boş). */
export function analyzeEmotionalPatterns(
  transactions: Transaction[],
): FinancialMirrorResult {
  const ctx = buildEmotionalSpendingContext(transactions);
  return {
    patterns: ctx.patterns,
    insights: [],
    riskDays: ctx.riskDays,
    safeDays: ctx.safeDays,
    weekdayAvg: ctx.weekdayAvg,
    weekendAvg: ctx.weekendAvg,
    weekendPremium: ctx.weekendPremium,
    aiSummary: "",
    emotionalTriggers: [],
    recommendations: [],
  };
}

/* ─── AI Prompt Builder ────────────────────────────────────── */

function buildAIPrompt(
  patterns: TimePattern[],
  weekdayAvg: number,
  weekendAvg: number,
  weekendPremium: number,
  expenses: Transaction[],
  riskDays: string[],
  safeDays: string[],
): string {
  const topRisk = patterns
    .filter((p) => p.deviationPct > 20)
    .slice(0, 8)
    .map(
      (p) =>
        `${p.dayLabel} ${p.hourSlot}: ort. ${p.avgSpend}₺, %${p.deviationPct} sapma, ${p.txCount} işlem`,
    )
    .join("\n");

  const topSafe = patterns
    .filter((p) => p.deviationPct < -15)
    .slice(0, 5)
    .map(
      (p) =>
        `${p.dayLabel} ${p.hourSlot}: ort. ${p.avgSpend}₺, %${Math.abs(p.deviationPct)} altında`,
    )
    .join("\n");

  const catTotals = new Map<string, number>();
  for (const tx of expenses) {
    catTotals.set(tx.category, (catTotals.get(tx.category) ?? 0) + tx.amount);
  }
  const topCategories = [...catTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([c, a]) => `${c}: ${Math.round(a)}₺`)
    .join(", ");

  const sampleTxs = [...expenses]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 40)
    .map((t) => {
      const d = new Date(t.date);
      return `${d.toLocaleDateString("tr-TR")} ${DAY_LABELS[d.getDay()]} ${getHourSlot(d.getHours())} | ${t.category} | ${t.amount}₺ | ${t.note || "—"}`;
    })
    .join("\n");

  return `## İstatistiksel Bağlam (Son 90 gün, ${expenses.length} gider)

Hafta içi ort. işlem: ${weekdayAvg}₺
Hafta sonu ort. işlem: ${weekendAvg}₺
Hafta sonu primi: %${weekendPremium}
En çok harcanan kategoriler: ${topCategories}

### Yüksek risk zaman dilimleri (istatistik):
${topRisk || "—"}

### Düşük harcama zaman dilimleri:
${topSafe || "—"}

Ön hesaplanmış risk günleri: ${riskDays.join(", ") || "—"}
Ön hesaplanmış güvenli günler: ${safeDays.join(", ") || "—"}

### Son işlemler (örnek):
${sampleTxs}`;
}

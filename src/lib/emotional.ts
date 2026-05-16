/**
 * Finansal Ayna — Duygusal Harcama Analizi
 *
 * Kullanıcının harcama verilerinden gün/saat bazlı davranış kalıplarını
 * çıkarır. "Neden harcandığı"nı anlamaya çalışır.
 *
 * Hiçbir ML pipeline'ı gerektirmez — sadece istatistiksel desen eşleştirme
 * + Gemini API ile doğal dil yorumlama.
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
  riskDays: string[];        // Risk günleri: "Perşembe akşam" vs.
  safeDays: string[];        // Tasarruflu günler
  weekdayAvg: number;
  weekendAvg: number;
  weekendPremium: number;    // Hafta sonu ne kadar fazla harcanıyor (%)
  promptForAI: string;       // Gemini'ye gönderilecek özet veri
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

export function analyzeEmotionalPatterns(
  transactions: Transaction[],
): FinancialMirrorResult {
  // Son 90 gündeki gider işlemlerini al
  const now = new Date();
  const cutoff = new Date(now.getTime() - 90 * 86_400_000);
  const expenses = transactions.filter(
    (t) => t.type === "gider" && new Date(t.date) >= cutoff,
  );

  if (expenses.length === 0) {
    return {
      patterns: [],
      insights: [],
      riskDays: [],
      safeDays: [],
      weekdayAvg: 0,
      weekendAvg: 0,
      weekendPremium: 0,
      promptForAI: "Yeterli veri yok.",
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

  // Insights (içgörüler) üret
  const insights: EmotionalInsight[] = [];

  // 1. Yüksek sapma gösteren zaman dilimlerini bul
  const riskPatterns = patterns
    .filter((p) => p.deviationPct > 30 && p.txCount >= 2)
    .sort((a, b) => b.deviationPct - a.deviationPct);

  for (const rp of riskPatterns.slice(0, 3)) {
    insights.push({
      type: "warning",
      title: `${rp.dayLabel} ${rp.hourSlot.split(" ")[0]} tuzağı`,
      description: `${rp.dayLabel} günleri ${rp.hourSlot.toLowerCase()} ortalamanın %${rp.deviationPct} üzerinde harcıyorsun. Bu muhtemelen ${rp.dayOfWeek === 5 ? "hafta sonu rehaveti" : rp.dayOfWeek >= 3 ? "hafta yorgunluğu" : "hafta başı stresi"} ile ilişkili.`,
      dayLabel: rp.dayLabel,
      hourSlot: rp.hourSlot,
      severity: rp.deviationPct > 60 ? 5 : rp.deviationPct > 40 ? 4 : 3,
    });
  }

  // 2. Hafta sonu paterni
  if (weekendPremium > 20) {
    insights.push({
      type: "pattern",
      title: "Hafta sonu harcama artışı",
      description: `Hafta sonları ortalamanın %${weekendPremium} üzerinde harcıyorsun. (Hafta içi: ${weekdayAvg}₺, Hafta sonu: ${weekendAvg}₺)`,
      severity: weekendPremium > 50 ? 4 : 3,
    });
  }

  // 3. Tasarruflu zaman dilimleri
  const safePatterns = patterns
    .filter((p) => p.deviationPct < -20 && p.txCount >= 2)
    .sort((a, b) => a.deviationPct - b.deviationPct);

  for (const sp of safePatterns.slice(0, 2)) {
    insights.push({
      type: "positive",
      title: `${sp.dayLabel} ${sp.hourSlot.split(" ")[0]} disiplinli`,
      description: `${sp.dayLabel} günleri ${sp.hourSlot.toLowerCase()} ortalamanın %${Math.abs(sp.deviationPct)} altında harcıyorsun. Bu disiplini diğer günlere de yay!`,
      dayLabel: sp.dayLabel,
      hourSlot: sp.hourSlot,
      severity: 1,
    });
  }

  // 4. Gece harcaması kontrolü
  const nightSpending = patterns.filter((p) => p.hourSlot.includes("Gece"));
  const nightTotal = nightSpending.reduce((s, p) => s + p.totalSpend, 0);
  if (nightTotal > totalExpense * 0.15) {
    insights.push({
      type: "warning",
      title: "Gece harcamaları yüksek",
      description: `Toplam harcamanın %${Math.round((nightTotal / totalExpense) * 100)}'i gece saatlerinde gerçekleşiyor. Gece alışverişleri genellikle dürtüsel olur.`,
      severity: 4,
    });
  }

  const riskDays = riskPatterns.map((p) => `${p.dayLabel} ${p.hourSlot.split(" ")[0]}`);
  const safeDays = safePatterns.map((p) => `${p.dayLabel} ${p.hourSlot.split(" ")[0]}`);

  // Gemini AI'ya gönderilecek özet prompt
  const promptForAI = buildAIPrompt(patterns, insights, weekdayAvg, weekendAvg, weekendPremium);

  return {
    patterns: patterns.sort((a, b) => b.deviationPct - a.deviationPct),
    insights,
    riskDays,
    safeDays,
    weekdayAvg,
    weekendAvg,
    weekendPremium,
    promptForAI,
  };
}

/* ─── AI Prompt Builder ────────────────────────────────────── */

function buildAIPrompt(
  patterns: TimePattern[],
  insights: EmotionalInsight[],
  weekdayAvg: number,
  weekendAvg: number,
  weekendPremium: number,
): string {
  const topRisk = patterns
    .filter((p) => p.deviationPct > 20)
    .slice(0, 5)
    .map((p) => `${p.dayLabel} ${p.hourSlot}: ortalamadan %${p.deviationPct} fazla (${p.txCount} işlem, ort. ${p.avgSpend}₺)`)
    .join("\n");

  const topSafe = patterns
    .filter((p) => p.deviationPct < -15)
    .slice(0, 3)
    .map((p) => `${p.dayLabel} ${p.hourSlot}: ortalamadan %${Math.abs(p.deviationPct)} az`)
    .join("\n");

  return `## Kullanıcı Harcama Davranış Profili (Son 90 gün)

Hafta içi ortalama: ${weekdayAvg}₺/işlem
Hafta sonu ortalama: ${weekendAvg}₺/işlem
Hafta sonu primi: %${weekendPremium}

### Risk Bölgeleri:
${topRisk || "Belirgin risk bölgesi yok."}

### Güvenli Bölgeler:
${topSafe || "Belirgin güvenli bölge yok."}

### Tespit Edilen Davranış Kalıpları:
${insights.map((i) => `- [${i.type}] ${i.title}: ${i.description}`).join("\n")}

Lütfen bu verileri psikolojik perspektiften yorumla. Duygusal tetikleyicileri tespit et, proaktif öneriler ver. Kullanıcıya empati göster ama gerçekçi ol.`;
}

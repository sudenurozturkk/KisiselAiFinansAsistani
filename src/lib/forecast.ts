/**
 * Harcama Tahmini (Spending Forecast)
 *
 * Geçmiş 60 günün hareketli ortalamasını ve haftalık mevsimselliği kullanarak
 * önümüzdeki N günü tahmin eder.
 *
 * Yöntem:
 *  - Son 60 gün boyunca günlük gider toplamlarını hesaplar
 *  - Haftanın günü (0-6) için mevsimsellik faktörü çıkarır
 *  - Hareketli ortalama (window=14) ile baseline belirler
 *  - Gelecek N gün = baseline × seasonalityFactor
 */

import type { Transaction } from "./types";

export interface DailyExpense {
  date: string; // ISO YYYY-MM-DD
  expense: number;
  isFuture: boolean;
}

export interface ForecastResult {
  series: DailyExpense[];           // geçmiş + gelecek tek dizi
  pastTotal: number;
  forecastTotal: number;            // önümüzdeki gün sayısının toplamı
  monthEndTotal: number;            // bu ay sonu (gerçekleşmiş + tahmin)
  averageDaily: number;
  weeklySeasonality: number[];      // 7 elemanlı, 1.0=ortalama
  confidence: "high" | "medium" | "low";
}

const HISTORY_DAYS = 60;
const FORECAST_DAYS = 30;
const SMA_WINDOW = 14;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function bucketByDay(txs: Transaction[], from: Date, to: Date): Map<string, number> {
  const map = new Map<string, number>();
  for (
    let cur = startOfDay(from);
    cur <= to;
    cur = new Date(cur.getTime() + 86_400_000)
  ) {
    map.set(ymd(cur), 0);
  }
  for (const t of txs) {
    if (t.type !== "gider") continue;
    const d = new Date(t.date);
    const key = ymd(d);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + t.amount);
  }
  return map;
}

function simpleMovingAverage(values: number[], window: number): number {
  if (values.length === 0) return 0;
  const w = Math.min(window, values.length);
  const tail = values.slice(-w);
  return tail.reduce((s, v) => s + v, 0) / w;
}

/** Haftalık (0=Pazar … 6=Cumartesi) mevsimsellik faktörü hesapla. */
function computeWeeklySeasonality(daily: { date: Date; expense: number }[]): number[] {
  const sums = Array(7).fill(0);
  const counts = Array(7).fill(0);
  for (const d of daily) {
    const dow = d.date.getDay();
    sums[dow] += d.expense;
    counts[dow] += 1;
  }
  const avgPerDow = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
  const overallAvg = avgPerDow.reduce((s, v) => s + v, 0) / 7;
  return overallAvg > 0
    ? avgPerDow.map((a) => a / overallAvg)
    : Array(7).fill(1);
}

export function forecastSpending(
  transactions: Transaction[],
  forecastDays = FORECAST_DAYS,
  historyDays = HISTORY_DAYS,
): ForecastResult {
  const today = startOfDay(new Date());
  const start = new Date(today.getTime() - (historyDays - 1) * 86_400_000);

  const dayBucket = bucketByDay(transactions, start, today);
  const daily = Array.from(dayBucket.entries())
    .map(([date, expense]) => ({ date: new Date(date), expense }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const pastValues = daily.map((d) => d.expense);
  const baseline = simpleMovingAverage(pastValues, SMA_WINDOW);
  const weeklySeasonality = computeWeeklySeasonality(daily);

  // Geçmiş seri
  const series: DailyExpense[] = daily.map((d) => ({
    date: ymd(d.date),
    expense: d.expense,
    isFuture: false,
  }));

  // Gelecek tahmin
  let forecastTotal = 0;
  for (let i = 1; i <= forecastDays; i++) {
    const futureDate = new Date(today.getTime() + i * 86_400_000);
    const dow = futureDate.getDay();
    const expected = baseline * (weeklySeasonality[dow] ?? 1);
    forecastTotal += expected;
    series.push({
      date: ymd(futureDate),
      expense: Math.round(expected),
      isFuture: true,
    });
  }

  const pastTotal = pastValues.reduce((s, v) => s + v, 0);

  // Bu ay sonuna kadar olan toplam: bu ay gerçekleşen + bu ay kalan günlerin tahmini
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const monthEndTotal = series
    .filter((s) => {
      const d = new Date(s.date);
      return d >= monthStart && d <= monthEnd;
    })
    .reduce((sum, s) => sum + s.expense, 0);

  // Güven seviyesi: yeterli veri varsa "high"
  const nonZero = pastValues.filter((v) => v > 0).length;
  const confidence: ForecastResult["confidence"] =
    nonZero >= 30 ? "high" : nonZero >= 10 ? "medium" : "low";

  return {
    series,
    pastTotal,
    forecastTotal: Math.round(forecastTotal),
    monthEndTotal: Math.round(monthEndTotal),
    averageDaily: Math.round(baseline),
    weeklySeasonality,
    confidence,
  };
}

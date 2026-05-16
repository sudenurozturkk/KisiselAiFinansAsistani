import { describe, expect, it } from "vitest";
import { forecastSpending } from "./forecast";
import type { Transaction } from "./types";

function tx(amount: number, daysAgo: number, type: "gelir" | "gider" = "gider"): Transaction {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    _id: Math.random().toString(36).slice(2),
    userId: "u1",
    type,
    category: "Gıda",
    amount,
    date: d.toISOString(),
  };
}

describe("forecastSpending", () => {
  it("boş veride low confidence ile sıfır toplam döner", () => {
    const result = forecastSpending([]);
    expect(result.confidence).toBe("low");
    expect(result.pastTotal).toBe(0);
    expect(result.averageDaily).toBe(0);
  });

  it("60 gün geçmiş + 30 gün gelecek = 90 gün serisi üretir", () => {
    const txs: Transaction[] = Array.from({ length: 30 }, (_, i) => tx(100, i));
    const result = forecastSpending(txs, 30, 60);
    expect(result.series.length).toBe(60 + 30);
    expect(result.series.filter((s) => s.isFuture)).toHaveLength(30);
    expect(result.series.filter((s) => !s.isFuture)).toHaveLength(60);
  });

  it("yeterli veriyle high confidence verir", () => {
    const txs: Transaction[] = Array.from({ length: 40 }, (_, i) => tx(150, i));
    const result = forecastSpending(txs, 30, 60);
    expect(result.confidence).toBe("high");
    expect(result.averageDaily).toBeGreaterThan(0);
  });

  it("gelirleri tahminden hariç tutar", () => {
    const txs: Transaction[] = [
      tx(100000, 5, "gelir"),
      tx(100, 5, "gider"),
    ];
    const result = forecastSpending(txs, 30, 60);
    // Sadece gider sayılmalı
    expect(result.pastTotal).toBe(100);
  });

  it("haftalık seasonality 7 elemanlı array döner", () => {
    const txs: Transaction[] = Array.from({ length: 14 }, (_, i) => tx(100, i));
    const result = forecastSpending(txs, 7, 14);
    expect(result.weeklySeasonality).toHaveLength(7);
  });
});

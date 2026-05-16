import { describe, expect, it } from "vitest";
import { detectAnomalies } from "./anomaly";
import type { Transaction } from "./types";

function tx(
  amount: number,
  category: Transaction["category"],
  monthsAgo: number,
  type: "gelir" | "gider" = "gider",
): Transaction {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  d.setDate(15); // ay ortası
  return {
    _id: Math.random().toString(36).slice(2),
    userId: "u1",
    type,
    category,
    amount,
    date: d.toISOString(),
  };
}

describe("detectAnomalies", () => {
  it("boş listede anomali bulmaz", () => {
    expect(detectAnomalies([])).toEqual([]);
  });

  it("sabit harcamada anomali tespit etmez", () => {
    const txs: Transaction[] = [
      tx(1000, "Gıda", 0),
      tx(1000, "Gıda", 1),
      tx(1000, "Gıda", 2),
      tx(1000, "Gıda", 3),
      tx(1000, "Gıda", 4),
      tx(1000, "Gıda", 5),
    ];
    expect(detectAnomalies(txs)).toEqual([]);
  });

  it("ani sıçramayı anomali olarak tespit eder", () => {
    const txs: Transaction[] = [
      tx(8000, "Eğlence", 0), // bu ay 8x arttı
      tx(1000, "Eğlence", 1),
      tx(1000, "Eğlence", 2),
      tx(1000, "Eğlence", 3),
      tx(1000, "Eğlence", 4),
      tx(1000, "Eğlence", 5),
    ];
    const anomalies = detectAnomalies(txs);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0]?.category).toBe("Eğlence");
    expect(anomalies[0]?.zScore).toBeGreaterThanOrEqual(1.5);
  });

  it("severity seviyesini z-score'a göre belirler", () => {
    const txs: Transaction[] = [
      tx(20000, "Alışveriş", 0), // çok büyük sapma
      tx(1000, "Alışveriş", 1),
      tx(1000, "Alışveriş", 2),
      tx(1000, "Alışveriş", 3),
      tx(1000, "Alışveriş", 4),
      tx(1000, "Alışveriş", 5),
    ];
    const anomalies = detectAnomalies(txs);
    expect(anomalies[0]?.severity).toBe("severe");
  });

  it("gelirleri görmezden gelir", () => {
    const txs: Transaction[] = [
      tx(50000, "Diğer", 0, "gelir"),
      tx(1000, "Diğer", 1, "gelir"),
    ];
    expect(detectAnomalies(txs)).toEqual([]);
  });

  it("z-score azalan sırada sıralar", () => {
    const txs: Transaction[] = [
      tx(5000, "Gıda", 0),
      tx(1000, "Gıda", 1),
      tx(1000, "Gıda", 2),
      tx(1000, "Gıda", 3),
      tx(1000, "Gıda", 4),
      tx(1000, "Gıda", 5),
      tx(20000, "Alışveriş", 0),
      tx(1000, "Alışveriş", 1),
      tx(1000, "Alışveriş", 2),
      tx(1000, "Alışveriş", 3),
      tx(1000, "Alışveriş", 4),
      tx(1000, "Alışveriş", 5),
    ];
    const anomalies = detectAnomalies(txs);
    if (anomalies.length >= 2) {
      expect(anomalies[0]!.zScore).toBeGreaterThanOrEqual(anomalies[1]!.zScore);
    }
  });
});

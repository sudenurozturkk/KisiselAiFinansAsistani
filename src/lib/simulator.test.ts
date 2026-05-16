import { describe, expect, it } from "vitest";
import { getCategoryAverages, simulateScenario } from "./simulator";
import { summarizeFinance } from "./finance";
import type { Transaction, UserProfile } from "./types";

const NOW = new Date().toISOString();
const user: UserProfile = {
  userId: "u1",
  name: "Test",
  monthlyIncome: 30000,
  monthlyBudget: 20000,
  savingsGoal: 5000,
  riskTolerance: "orta",
  goals: [],
  createdAt: NOW,
  updatedAt: NOW,
};

function tx(
  type: "gelir" | "gider",
  amount: number,
  category: Transaction["category"],
  daysAgo = 0,
): Transaction {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return {
    _id: Math.random().toString(36).slice(2),
    userId: "u1",
    type,
    category,
    amount,
    date: d.toISOString(),
  };
}

describe("simulateScenario", () => {
  it("ayarsız senaryo baseline ile aynıdır", () => {
    const txs: Transaction[] = [
      tx("gelir", 30000, "Diğer"),
      tx("gider", 5000, "Gıda"),
    ];
    const summary = summarizeFinance(txs, 20000);
    const result = simulateScenario(
      { categoryAdjustments: {} },
      user,
      txs,
      summary,
    );
    expect(result.scenario.monthlyExpense).toBe(result.baseline.monthlyExpense);
    expect(result.scenario.monthlyNet).toBe(result.baseline.monthlyNet);
  });

  it("kategori azaltma harcamayı düşürür", () => {
    // 3 ay boyunca her ay 3000 Eğlence harcadık (ortalama 3000/ay)
    const txs: Transaction[] = [
      tx("gelir", 30000, "Diğer"),
      tx("gider", 3000, "Eğlence", 5),
      tx("gider", 3000, "Eğlence", 35),
      tx("gider", 3000, "Eğlence", 65),
    ];
    const summary = summarizeFinance(txs, 20000);
    const result = simulateScenario(
      { categoryAdjustments: { Eğlence: -50 } },
      user,
      txs,
      summary,
    );
    // %50 azalma → 1500₺ tasarruf bekleniyor
    expect(result.delta.expenseDiff).toBeLessThan(0);
    expect(result.scenario.monthlyExpense).toBeLessThan(result.baseline.monthlyExpense);
  });

  it("incomeBoost net'i artırır", () => {
    const txs: Transaction[] = [
      tx("gelir", 30000, "Diğer"),
      tx("gider", 10000, "Gıda"),
    ];
    const summary = summarizeFinance(txs, 20000);
    const result = simulateScenario(
      { categoryAdjustments: {}, incomeBoost: 5000 },
      user,
      txs,
      summary,
    );
    expect(result.scenario.monthlyNet).toBeGreaterThan(result.baseline.monthlyNet);
    expect(result.delta.netDiff).toBeGreaterThanOrEqual(5000);
  });

  it("hedefe ulaşma süresi hesaplanır", () => {
    const txs: Transaction[] = [
      tx("gelir", 30000, "Diğer"),
      tx("gider", 25000, "Gıda"),
    ];
    const summary = summarizeFinance(txs, 30000);
    const result = simulateScenario(
      { categoryAdjustments: {}, incomeBoost: 0 },
      user,
      txs,
      summary,
    );
    if (result.scenario.monthlyNet > 0) {
      expect(result.goalMonths).toBeGreaterThan(0);
    }
  });

  it("insight metinleri üretir", () => {
    const txs: Transaction[] = [tx("gelir", 30000, "Diğer"), tx("gider", 10000, "Gıda")];
    const summary = summarizeFinance(txs, 20000);
    const result = simulateScenario(
      { categoryAdjustments: {}, incomeBoost: 5000 },
      user,
      txs,
      summary,
    );
    expect(result.insights.length).toBeGreaterThan(0);
  });
});

describe("getCategoryAverages", () => {
  it("kategorileri azalan sırada döner", () => {
    const txs: Transaction[] = [
      tx("gider", 1000, "Gıda", 5),
      tx("gider", 5000, "Eğlence", 5),
      tx("gider", 2000, "Ulaşım", 5),
    ];
    const result = getCategoryAverages(txs, 3);
    expect(result[0]?.category).toBe("Eğlence");
    expect(result.length).toBe(3);
  });

  it("gelirleri görmezden gelir", () => {
    const txs: Transaction[] = [tx("gelir", 50000, "Diğer", 5)];
    const result = getCategoryAverages(txs, 3);
    expect(result.length).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildInsights,
  budgetAlertLevel,
  calculateHealthScore,
  formatTRY,
  pct,
  summarizeFinance,
} from "./finance";
import type { Transaction, UserProfile } from "./types";

const NOW = new Date().toISOString();
const baseUser: UserProfile = {
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

describe("formatTRY", () => {
  it("Türkçe TRY formatı uygular", () => {
    const out = formatTRY(1234);
    // Değer ve sembol içerdiğini kontrol et — locale ayrımı testleri kırılgan yapar
    expect(out).toMatch(/1\.234/);
    expect(out).toMatch(/₺/);
  });

  it("0 ve negatif değerleri formatlar", () => {
    expect(formatTRY(0)).toMatch(/0/);
    expect(formatTRY(-500)).toMatch(/500/);
  });
});

describe("pct", () => {
  it("pozitif sayıya + ekler", () => {
    expect(pct(15)).toBe("+15%");
    expect(pct(0)).toBe("0%");
    expect(pct(-7.5)).toBe("-8%"); // toFixed(0) yuvarlar
  });
});

describe("budgetAlertLevel", () => {
  it("eşik değerlere göre seviye verir", () => {
    expect(budgetAlertLevel(50)).toBe("ok");
    expect(budgetAlertLevel(79.9)).toBe("ok");
    expect(budgetAlertLevel(80)).toBe("warn");
    expect(budgetAlertLevel(99)).toBe("warn");
    expect(budgetAlertLevel(100)).toBe("danger");
    expect(budgetAlertLevel(150)).toBe("danger");
  });
});

describe("summarizeFinance", () => {
  it("boş listeyi sıfır toplamla özetler", () => {
    const s = summarizeFinance([], 20000);
    expect(s.thisMonth.income).toBe(0);
    expect(s.thisMonth.expense).toBe(0);
    expect(s.thisMonth.net).toBe(0);
    expect(s.savingsRate).toBe(0);
    expect(s.trend.length).toBe(6);
  });

  it("gelir/gideri doğru hesaplar ve tasarruf oranını çıkarır", () => {
    const txs: Transaction[] = [
      tx("gelir", 30000, "Diğer"),
      tx("gider", 5000, "Gıda"),
      tx("gider", 3000, "Ulaşım"),
      tx("gider", 2000, "Eğlence"),
    ];
    const s = summarizeFinance(txs, 20000);
    expect(s.thisMonth.income).toBe(30000);
    expect(s.thisMonth.expense).toBe(10000);
    expect(s.thisMonth.net).toBe(20000);
    // (30000-10000)/30000 = 66.6...
    expect(s.savingsRate).toBeGreaterThanOrEqual(66);
    expect(s.savingsRate).toBeLessThanOrEqual(67);
  });

  it("topCategories'i azalan sırada döner", () => {
    const txs: Transaction[] = [
      tx("gider", 1000, "Gıda"),
      tx("gider", 5000, "Kira/Fatura"),
      tx("gider", 2000, "Ulaşım"),
    ];
    const s = summarizeFinance(txs, 0);
    expect(s.topCategories[0]?.category).toBe("Kira/Fatura");
    expect(s.topCategories[0]?.amount).toBe(5000);
    expect(s.topCategories.at(-1)?.amount).toBe(1000);
  });

  it("bütçeUsedPct'i doğru hesaplar", () => {
    const txs: Transaction[] = [tx("gider", 8000, "Gıda")];
    const s = summarizeFinance(txs, 10000);
    expect(s.thisMonth.budgetUsedPct).toBe(80);
  });
});

describe("buildInsights", () => {
  it("5 insight üretir", () => {
    const txs: Transaction[] = [
      tx("gelir", 30000, "Diğer"),
      tx("gider", 5000, "Gıda"),
    ];
    const s = summarizeFinance(txs, 20000);
    const insights = buildInsights(s, baseUser);
    expect(insights).toHaveLength(5);
    expect(insights.map((i) => i.id)).toEqual(
      expect.arrayContaining([
        "savings-rate",
        "daily-avg",
        "expense-delta",
        "top-category",
        "goal-progress",
      ]),
    );
  });
});

describe("calculateHealthScore", () => {
  it("sağlıklı profil için yüksek skor verir", () => {
    const txs: Transaction[] = [
      tx("gelir", 30000, "Diğer"),
      tx("gider", 5000, "Gıda"),
      tx("gider", 3000, "Kira/Fatura"),
      tx("gider", 2000, "Ulaşım"),
    ];
    const s = summarizeFinance(txs, 20000);
    const health = calculateHealthScore(s, baseUser, 0);
    expect(health.overall).toBeGreaterThanOrEqual(70);
    expect(["A+", "A", "B+", "B"]).toContain(health.grade);
  });

  it("kötü profil için düşük skor verir (gider gelirden fazla)", () => {
    const txs: Transaction[] = [
      tx("gelir", 10000, "Diğer"),
      tx("gider", 25000, "Gıda"),
    ];
    const s = summarizeFinance(txs, 10000);
    const health = calculateHealthScore(s, baseUser, 3);
    expect(health.overall).toBeLessThan(50);
    expect(["C", "D", "F"]).toContain(health.grade);
  });

  it("anomaliler stabiliteyi düşürür", () => {
    const txs: Transaction[] = [
      tx("gelir", 30000, "Diğer"),
      tx("gider", 5000, "Gıda"),
    ];
    const s = summarizeFinance(txs, 20000);
    const noAnom = calculateHealthScore(s, baseUser, 0);
    const withAnom = calculateHealthScore(s, baseUser, 4);
    expect(withAnom.components.spendingStability).toBeLessThan(
      noAnom.components.spendingStability,
    );
  });
});

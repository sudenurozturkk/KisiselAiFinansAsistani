import { describe, expect, it } from "vitest";
import { computeAchievements, summarizeAchievements } from "./achievements";
import { summarizeFinance } from "./finance";
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

describe("computeAchievements", () => {
  it("varsayılan rozetleri (savings, budget, diversified, tracker, stable) üretir", () => {
    const summary = summarizeFinance([], 20000);
    const achievements = computeAchievements({
      user: baseUser,
      transactions: [],
      summary,
      anomalyCount: 0,
    });
    const ids = achievements.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "savings-master",
        "budget-master",
        "diversified-spender",
        "diligent-tracker",
        "stable-spender",
      ]),
    );
  });

  it("savingsGoal=0 ise goal-champion rozeti üretmez", () => {
    const userNoGoal = { ...baseUser, savingsGoal: 0 };
    const summary = summarizeFinance([], 20000);
    const a = computeAchievements({
      user: userNoGoal,
      transactions: [],
      summary,
      anomalyCount: 0,
    });
    expect(a.find((x) => x.id === "goal-champion")).toBeUndefined();
  });

  it("yüksek tasarrufla altın rozet kazandırır", () => {
    const txs: Transaction[] = [
      tx("gelir", 30000, "Diğer"),
      tx("gider", 5000, "Gıda"),
    ];
    const summary = summarizeFinance(txs, 20000);
    const a = computeAchievements({
      user: baseUser,
      transactions: txs,
      summary,
      anomalyCount: 0,
    });
    const savings = a.find((x) => x.id === "savings-master");
    expect(savings?.unlocked).toBe(true);
    expect(savings?.tier).toBe("gold");
  });

  it("anomali olmayan ay → istikrar rozeti gold", () => {
    const summary = summarizeFinance([], 20000);
    const a = computeAchievements({
      user: baseUser,
      transactions: [],
      summary,
      anomalyCount: 0,
    });
    const stable = a.find((x) => x.id === "stable-spender");
    expect(stable?.tier).toBe("gold");
  });

  it("çok anomali → istikrar rozeti kilitli", () => {
    const summary = summarizeFinance([], 20000);
    const a = computeAchievements({
      user: baseUser,
      transactions: [],
      summary,
      anomalyCount: 5,
    });
    const stable = a.find((x) => x.id === "stable-spender");
    expect(stable?.unlocked).toBe(false);
  });
});

describe("summarizeAchievements", () => {
  it("kilitli liste için sıfır döner", () => {
    const result = summarizeAchievements([
      {
        id: "a",
        title: "x",
        description: "",
        icon: "",
        tier: "bronze",
        unlocked: false,
        progress: 0,
      },
    ]);
    expect(result.unlockedCount).toBe(0);
    expect(result.completionPct).toBe(0);
    expect(result.highestTier).toBeNull();
  });

  it("en yüksek tier'ı bulur", () => {
    const result = summarizeAchievements([
      { id: "a", title: "x", description: "", icon: "", tier: "bronze", unlocked: true, progress: 100 },
      { id: "b", title: "x", description: "", icon: "", tier: "gold", unlocked: true, progress: 100 },
      { id: "c", title: "x", description: "", icon: "", tier: "silver", unlocked: false, progress: 50 },
    ]);
    expect(result.unlockedCount).toBe(2);
    expect(result.highestTier).toBe("gold");
    expect(result.completionPct).toBe(67);
  });
});

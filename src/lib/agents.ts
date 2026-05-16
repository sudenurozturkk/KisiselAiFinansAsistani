/**
 * Agentic AI — Gemini Function Calling ile Multi-Tool Finance Agent.
 *
 * Bu modül, basit bir chatbot'un ötesine geçerek Gemini'nin function calling
 * özelliğini kullanır. Agent, kullanıcının sorusunu anlayıp hangi araçları
 * çağıracağına kendi karar verir, sonuçları alır ve bütünleşik bir yanıt üretir.
 *
 * Hackathon Agentic Yapılar kriteri (10 puan) için tasarlanmıştır.
 */
import { GoogleGenerativeAI, FunctionDeclaration, SchemaType, type FunctionCall } from "@google/generative-ai";
import type {
  AgentStep,
  Transaction,
  UserProfile,
  Category,
  SpendingAnomaly,
} from "./types";
import { summarizeFinance, formatTRY, buildInsights } from "./finance";
import { detectAnomalies } from "./anomaly";
import { listWishlistItems } from "./repo";
import { analyzeEmotionalPatterns } from "./emotional";

/* ─── Agent Tool Definitions (Gemini Function Declarations) ──── */

const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "analyze_spending",
    description:
      "Belirli bir kategori veya tüm kategoriler için harcama analizi yapar. Aylık toplam, ortalama, trend bilgisi verir.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        category: {
          type: SchemaType.STRING,
          description: "Analiz edilecek kategori. Boş bırakılırsa tüm kategoriler analiz edilir.",
          enum: [
            "Gıda", "Ulaşım", "Kira/Fatura", "Eğlence",
            "Alışveriş", "Sağlık", "Eğitim", "Yatırım", "Diğer", "tümü",
          ],
        },
        period: {
          type: SchemaType.STRING,
          description: "Analiz dönemi: 'bu_ay', 'gecen_ay', 'son_3_ay', 'son_6_ay'",
          enum: ["bu_ay", "gecen_ay", "son_3_ay", "son_6_ay"],
        },
      },
      required: ["period"],
    },
  },
  {
    name: "calculate_savings_plan",
    description:
      "Belirli bir tasarruf hedefi ve süre için kişiselleştirilmiş tasarruf planı oluşturur.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        targetAmount: {
          type: SchemaType.NUMBER,
          description: "Hedef tasarruf tutarı (TL)",
        },
        months: {
          type: SchemaType.NUMBER,
          description: "Hedef süre (ay)",
        },
        purpose: {
          type: SchemaType.STRING,
          description: "Tasarruf amacı (örn: tatil, acil fon, araba)",
        },
      },
      required: ["targetAmount", "months"],
    },
  },
  {
    name: "analyze_wishlist",
    description:
      "Kullanıcının istek listesindeki ürün ve hizmetleri analiz eder, bütçeye göre önceliklendirir ve alternatif önerir.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        focusCategory: {
          type: SchemaType.STRING,
          description: "Odaklanılacak kategori (opsiyonel)",
        },
      },
    },
  },
  {
    name: "get_budget_status",
    description:
      "Anlık bütçe durumunu sorgular: kalan bütçe, harcama yüzdesi, anomaliler.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "predict_month_end",
    description:
      "Mevcut harcama hızına göre ay sonu projeksiyonu yapar ve bütçe riski hesaplar.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "detect_anomalies",
    description:
      "Harcama anomalilerini tespit eder — normalden sapan kategorileri bulur.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: "financial_literacy_explain",
    description:
      "Finansal kavramları (borsa, faiz, enflasyon, kredi, yatırım fonu, bütçe) kullanıcının seviyesine uygun şekilde açıklar.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        concept: {
          type: SchemaType.STRING,
          description: "Açıklanacak finansal kavram",
        },
        level: {
          type: SchemaType.STRING,
          description: "Kullanıcı seviyesi",
          enum: ["başlangıç", "orta", "ileri"],
        },
      },
      required: ["concept"],
    },
  },
  {
    name: "analyze_emotional_patterns",
    description:
      "Kullanıcının harcama davranışlarını gün ve saat bazlı analiz eder. Duygusal tetikleyicileri, risk bölgelerini ve davranış kalıplarını tespit eder. 'Finansal Ayna' özelliği.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
];

/* ─── Tool Execution Functions ──────────────────────────────── */

function executeAnalyzeSpending(
  args: Record<string, unknown>,
  txs: Transaction[],
  user: UserProfile,
): Record<string, unknown> {
  const category = (args.category as string) || "tümü";
  const period = (args.period as string) || "bu_ay";
  const now = new Date();

  let monthsBack = 0;
  switch (period) {
    case "gecen_ay": monthsBack = 1; break;
    case "son_3_ay": monthsBack = 3; break;
    case "son_6_ay": monthsBack = 6; break;
    default: monthsBack = 0;
  }

  const startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const filtered = txs.filter((t) => {
    const d = new Date(t.date);
    if (d < startDate) return false;
    if (t.type !== "gider") return false;
    if (category !== "tümü" && t.category !== category) return false;
    return true;
  });

  const totalExpense = filtered.reduce((s, t) => s + t.amount, 0);
  const byCategory = new Map<string, number>();
  for (const t of filtered) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
  }

  const topCategories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => ({
      category: cat,
      amount: amt,
      percentage: totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0,
    }));

  return {
    period,
    category,
    totalExpense,
    transactionCount: filtered.length,
    topCategories: topCategories.slice(0, 5),
    dailyAverage: filtered.length > 0 ? Math.round(totalExpense / Math.max(1, monthsBack === 0 ? now.getDate() : monthsBack * 30)) : 0,
    budgetUsage: user.monthlyBudget > 0 ? Math.round((totalExpense / (user.monthlyBudget * Math.max(1, monthsBack || 1))) * 100) : 0,
  };
}

function executeCalculateSavingsPlan(
  args: Record<string, unknown>,
  txs: Transaction[],
  user: UserProfile,
): Record<string, unknown> {
  const targetAmount = (args.targetAmount as number) || 10000;
  const months = Math.max(1, (args.months as number) || 6);
  const purpose = (args.purpose as string) || "genel";

  const summary = summarizeFinance(txs, user.monthlyBudget);
  const monthlySavingNeeded = Math.round(targetAmount / months);
  const currentMonthlySaving = Math.max(0, summary.thisMonth.net);
  const gap = monthlySavingNeeded - currentMonthlySaving;

  // Tasarruf edilebilecek kategorileri bul
  const cuttableCategories = summary.topCategories
    .filter((c) => ["Eğlence", "Alışveriş", "Gıda"].includes(c.category))
    .map((c) => ({
      category: c.category,
      currentAmount: c.amount,
      suggestedCut: Math.round(c.amount * 0.2),
      savingPotential: Math.round(c.amount * 0.2),
    }));

  return {
    targetAmount,
    months,
    purpose,
    monthlySavingNeeded,
    currentMonthlySaving,
    gap: Math.max(0, gap),
    feasible: gap <= 0,
    cuttableCategories,
    weeklyTarget: Math.round(monthlySavingNeeded / 4),
    dailyTarget: Math.round(monthlySavingNeeded / 30),
    totalPotentialSavings: cuttableCategories.reduce((s, c) => s + c.savingPotential, 0),
  };
}

async function executeAnalyzeWishlist(
  args: Record<string, unknown>,
  user: UserProfile,
  txs: Transaction[],
): Promise<Record<string, unknown>> {
  const focusCategory = args.focusCategory as string | undefined;
  const summary = summarizeFinance(txs, user.monthlyBudget);
  const remaining = Math.max(user.monthlyBudget - summary.thisMonth.expense, 0);
  const items = await listWishlistItems(user.userId);
  const wishlistItems = items.filter((i) => i.status === "wishlist");

  let filtered = wishlistItems;
  if (focusCategory) {
    const q = focusCategory.toLowerCase();
    filtered = filtered.filter((i) => i.category.toLowerCase().includes(q));
  }

  const analyzed = filtered.map((item) => ({
    name: item.name,
    price: item.price || item.estimatedPrice || null,
    priority: item.priority,
    urgency: item.urgency,
    category: item.category,
    note: item.note || null,
    affordableNow: (item.price || 0) <= remaining,
  }));

  return {
    itemCount: analyzed.length,
    remainingBudget: remaining,
    totalEstimatedCost: analyzed.reduce((s, i) => s + (i.price || 0), 0),
    items: analyzed,
  };
}

function executeGetBudgetStatus(
  txs: Transaction[],
  user: UserProfile,
): Record<string, unknown> {
  const summary = summarizeFinance(txs, user.monthlyBudget);
  const anomalies = detectAnomalies(txs);
  const insights = buildInsights(summary, user);

  return {
    monthlyBudget: user.monthlyBudget,
    monthlyIncome: user.monthlyIncome,
    thisMonthExpense: summary.thisMonth.expense,
    thisMonthIncome: summary.thisMonth.income,
    remaining: Math.max(user.monthlyBudget - summary.thisMonth.expense, 0),
    budgetUsedPct: summary.thisMonth.budgetUsedPct,
    savingsRate: summary.savingsRate,
    savingsGoal: user.savingsGoal,
    savingsProgress: user.savingsGoal > 0 ? Math.round((Math.max(summary.thisMonth.net, 0) / user.savingsGoal) * 100) : 0,
    anomalyCount: anomalies.length,
    anomalies: anomalies.map((a) => ({
      category: a.category,
      severity: a.severity,
      message: a.message,
    })),
    topInsights: insights.slice(0, 3).map((i) => ({
      title: i.title,
      value: i.value,
      tone: i.tone,
    })),
  };
}

function executePredictMonthEnd(
  txs: Transaction[],
  user: UserProfile,
): Record<string, unknown> {
  const summary = summarizeFinance(txs, user.monthlyBudget);
  const daysElapsed = summary.thisMonth.daysElapsed;
  const daysInMonth = summary.thisMonth.daysInMonth;
  const daysRemaining = daysInMonth - daysElapsed;

  const dailyAvg = daysElapsed > 0 ? summary.thisMonth.expense / daysElapsed : 0;
  const projected = Math.round(dailyAvg * daysInMonth);
  const projectedRemaining = user.monthlyBudget - projected;

  // Hafta sonu pattern kontrolü
  const weekdayTxs = txs.filter((t) => {
    const d = new Date(t.date);
    return d.getDay() !== 0 && d.getDay() !== 6 && t.type === "gider";
  });
  const weekendTxs = txs.filter((t) => {
    const d = new Date(t.date);
    return (d.getDay() === 0 || d.getDay() === 6) && t.type === "gider";
  });

  const avgWeekday = weekdayTxs.length > 0 ? weekdayTxs.reduce((s, t) => s + t.amount, 0) / weekdayTxs.length : 0;
  const avgWeekend = weekendTxs.length > 0 ? weekendTxs.reduce((s, t) => s + t.amount, 0) / weekendTxs.length : 0;

  return {
    daysElapsed,
    daysRemaining,
    currentExpense: summary.thisMonth.expense,
    dailyAverage: Math.round(dailyAvg),
    projectedMonthEnd: projected,
    budget: user.monthlyBudget,
    projectedOverBudget: projected > user.monthlyBudget,
    projectedSaving: Math.max(0, user.monthlyIncome - projected),
    riskLevel: projected > user.monthlyBudget * 1.1 ? "high" : projected > user.monthlyBudget * 0.9 ? "medium" : "low",
    weekdayAvg: Math.round(avgWeekday),
    weekendAvg: Math.round(avgWeekend),
    safeDailySpend: daysRemaining > 0 ? Math.round((user.monthlyBudget - summary.thisMonth.expense) / daysRemaining) : 0,
  };
}

function executeDetectAnomalies(txs: Transaction[]): Record<string, unknown> {
  const anomalies = detectAnomalies(txs);
  return {
    totalAnomalies: anomalies.length,
    anomalies: anomalies.map((a) => ({
      category: a.category,
      currentAmount: a.currentAmount,
      averageAmount: a.avgAmount,
      increasePercent: Math.round(((a.currentAmount - a.avgAmount) / a.avgAmount) * 100),
      severity: a.severity,
      zScore: a.zScore,
      message: a.message,
    })),
    summary: anomalies.length === 0
      ? "Harcamalarında belirgin bir anomali tespit edilmedi. 👍"
      : `${anomalies.length} kategoride normalden sapma tespit edildi.`,
  };
}

function executeFinancialLiteracyExplain(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const concept = (args.concept as string) || "bütçe";
  const level = (args.level as string) || "başlangıç";
  // Agent bu tool'u çağırdığında, sonucu Gemini'ye geri gönderir ve
  // Gemini açıklamayı kullanıcı seviyesine göre üretir.
  return {
    concept,
    level,
    instruction: `Kullanıcıya "${concept}" kavramını "${level}" seviyesinde, Türkçe, anlaşılır örneklerle açıkla. Güncel Türkiye ekonomisi bağlamında somut örnekler ver. Gerekirse analoji kullan.`,
  };
}

function executeEmotionalPatterns(
  txs: Transaction[],
): Record<string, unknown> {
  const result = analyzeEmotionalPatterns(txs);
  return {
    insightCount: result.insights.length,
    riskDays: result.riskDays,
    safeDays: result.safeDays,
    weekdayAvg: result.weekdayAvg,
    weekendAvg: result.weekendAvg,
    weekendPremium: result.weekendPremium,
    insights: result.insights.map((i) => ({
      type: i.type,
      title: i.title,
      description: i.description,
      severity: i.severity,
    })),
    behaviorProfile: result.promptForAI,
  };
}

/* ─── Tool Router ───────────────────────────────────────────── */

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  txs: Transaction[],
  user: UserProfile,
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case "analyze_spending":
      return executeAnalyzeSpending(args, txs, user);
    case "calculate_savings_plan":
      return executeCalculateSavingsPlan(args, txs, user);
    case "analyze_wishlist":
      return await executeAnalyzeWishlist(args, user, txs);
    case "get_budget_status":
      return executeGetBudgetStatus(txs, user);
    case "predict_month_end":
      return executePredictMonthEnd(txs, user);
    case "detect_anomalies":
      return executeDetectAnomalies(txs);
    case "analyze_emotional_patterns":
      return executeEmotionalPatterns(txs);
    case "financial_literacy_explain":
      return executeFinancialLiteracyExplain(args);
    default:
      return { error: `Bilinmeyen araç: ${toolName}` };
  }
}

/* ─── Agent Orchestrator ────────────────────────────────────── */

const MAX_AGENT_TURNS = 5;

export async function runFinanceAgent(
  client: GoogleGenerativeAI,
  modelName: string,
  systemPrompt: string,
  history: { role: string; content: string }[],
  userMessage: string,
  txs: Transaction[],
  user: UserProfile,
): Promise<{ reply: string; steps: AgentStep[] }> {
  const steps: AgentStep[] = [];

  const model = client.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: toolDeclarations }],
  });

  const chatHistory = history.slice(-10).map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history: chatHistory });

  let response = await chat.sendMessage(userMessage);
  let candidate = response.response.candidates?.[0];

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    if (!candidate) break;

    const functionCalls: FunctionCall[] = [];
    for (const part of candidate.content?.parts || []) {
      if (part.functionCall) {
        functionCalls.push(part.functionCall as FunctionCall);
      }
    }

    if (functionCalls.length === 0) {
      // No function calls — agent is done, extract text response
      const textParts = candidate.content?.parts
        ?.filter((p) => p.text)
        .map((p) => p.text)
        .join("") || "";
      steps.push({ type: "response", content: textParts });
      return { reply: textParts, steps };
    }

    // Execute all function calls
    const functionResponses = [];
    for (const fc of functionCalls) {
      steps.push({
        type: "tool_call",
        content: `${fc.name} çağrılıyor...`,
        toolName: fc.name,
        toolArgs: (fc.args as Record<string, unknown>) || {},
      });

      const result = await executeTool(
        fc.name,
        (fc.args as Record<string, unknown>) || {},
        txs,
        user,
      );

      steps.push({
        type: "tool_result",
        content: `${fc.name} tamamlandı`,
        toolName: fc.name,
        toolResult: result,
      });

      functionResponses.push({
        functionResponse: {
          name: fc.name,
          response: result,
        },
      });
    }

    // Send function results back to Gemini
    response = await chat.sendMessage(functionResponses);
    candidate = response.response.candidates?.[0];
  }

  // Fallback: extract whatever text we have
  const fallbackText = candidate?.content?.parts
    ?.filter((p) => p.text)
    .map((p) => p.text)
    .join("") || "Analiz tamamlandı, ancak detaylı yanıt oluşturulamadı.";

  steps.push({ type: "response", content: fallbackText });
  return { reply: fallbackText, steps };
}

export { toolDeclarations };

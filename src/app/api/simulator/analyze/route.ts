import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  getOrCreateUser,
  listTransactions,
  listAssets,
  seedAllIfEmpty,
} from "@/lib/repo";
import { summarizeFinance } from "@/lib/finance";
import { simulateScenario, getCategoryAverages } from "@/lib/simulator";
import { getMarketSummaryForAI } from "@/lib/market";
import { withRetry, friendlyError } from "@/lib/gemini";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/simulator/analyze
 *
 * Body: { adjustments, incomeBoost?, oneTimeExpense?, horizon? }
 * Senaryo sonuçlarını + piyasa verisini Gemini'ye gönderip AI yorum üretir.
 */
export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  await seedAllIfEmpty(userId);

  const body = await req.json();
  const { adjustments = {}, incomeBoost, oneTimeExpense, horizon = 12 } = body;

  const [user, txs, assets] = await Promise.all([
    getOrCreateUser(userId),
    listTransactions(userId),
    listAssets(userId),
  ]);

  const summary = summarizeFinance(txs, user.monthlyBudget);
  const result = simulateScenario(
    {
      categoryAdjustments: adjustments,
      incomeBoost: incomeBoost ? Number(incomeBoost) : undefined,
      oneTimeExpense: oneTimeExpense ? Number(oneTimeExpense) : undefined,
      monthsHorizon: horizon,
    },
    user,
    txs,
    summary,
  );

  // Piyasa verisi
  let marketText = "";
  try {
    marketText = await getMarketSummaryForAI();
  } catch {
    /* devam */
  }

  // Portföy özeti
  const portfolioText =
    assets.length > 0
      ? `Portföy: ${assets.map((a) => `${a.name}(${a.ticker || ""}): ${a.quantity} birim × ₺${a.currentPrice}`).join(", ")}`
      : "Portföy bilgisi yok.";

  // AI yorumu üret
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ...result,
      aiAnalysis: result.insights.join(" "),
      source: "local",
    });
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    });

    const prompt = `Sen kıdemli bir kişisel finans danışmanısın. Aşağıdaki senaryo simülasyonu sonuçlarını analiz et ve kullanıcıya kişiselleştirilmiş, somut tavsiyeler ver.

KULLANICI: ${user.name}
Aylık gelir: ₺${user.monthlyIncome} | Bütçe: ₺${user.monthlyBudget} | Tasarruf hedefi: ₺${user.savingsGoal}
Risk toleransı: ${user.riskTolerance}

SENARYO SONUÇLARI:
- Mevcut aylık harcama: ₺${result.baseline.monthlyExpense}
- Senaryo aylık harcama: ₺${result.scenario.monthlyExpense}
- Mevcut net: ₺${result.baseline.monthlyNet} → Senaryo net: ₺${result.scenario.monthlyNet}
- ${horizon} ay sonunda fark: ₺${result.delta.yearlyDiff}
- Harcama değişimi: %${result.delta.expensePct}
${result.goalMonths ? `- Tasarruf hedefine ulaşma: ${result.goalMonths} ay` : ""}

UYGULANAN AYARLAMALAR:
${
  Object.entries(adjustments)
    .map(([k, v]) => `  ${k}: ${(v as number) > 0 ? "+" : ""}${v}%`)
    .join("\n") || "  Değişiklik yok"
}
${incomeBoost ? `  Ek gelir: +₺${incomeBoost}/ay` : ""}
${oneTimeExpense ? `  Tek seferlik gider: ₺${oneTimeExpense}` : ""}

${marketText}
${portfolioText}

Görev:
1. Senaryonun finansal etkisini 2-3 cümle ile özetle
2. Mevcut piyasa koşullarını göz önünde bulundur
3. Somut ve uygulanabilir 2-3 tavsiye ver
4. Portföy ile ilişkilendir (varsa)
5. Türkçe, kısa, net ve pozitif bir ton kullan

Cevabını düz metin olarak ver, başlık kullanma.`;

    const res = await withRetry(() => model.generateContent(prompt), 1, 30000);
    const aiText = res.response.text().trim();

    return NextResponse.json({
      ...result,
      aiAnalysis: aiText || result.insights.join(" "),
      source: "gemini",
    });
  } catch (err) {
    console.error("[simulator/analyze] Gemini error:", friendlyError(err));
    return NextResponse.json({
      ...result,
      aiAnalysis: result.insights.join(" "),
      source: "fallback",
    });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  getOrCreateUser,
  listTransactions,
  listSubscriptions,
} from "@/lib/repo";
import { summarizeFinance, formatTRY } from "@/lib/finance";
import { callGemini } from "@/lib/gemini";
import {
  assertGeminiConfigured,
  geminiErrorResponse,
  getAiMeta,
} from "@/lib/gemini-required";

export const dynamic = "force-dynamic";

/** GET /api/subscriptions/optimize — Gemini ile abonelik optimizasyonu */
export async function GET(req: NextRequest) {
  try {
    assertGeminiConfigured();
    const userId = getUserIdFromReq(req);
    const [user, txs, subs] = await Promise.all([
      getOrCreateUser(userId),
      listTransactions(userId),
      listSubscriptions(userId),
    ]);

    const active = subs.filter((s) => s.active);
    if (active.length === 0) {
      return NextResponse.json({
        optimizations: [],
        totalMonthlySaving: 0,
        totalYearlySaving: 0,
        summary: "Aktif abonelik bulunamadı.",
        ...getAiMeta(),
      });
    }

    const summary = summarizeFinance(txs, user.monthlyBudget);
    const subsText = active
      .map(
        (s, i) =>
          `${i + 1}. ${s.name} — ${formatTRY(s.amount)}/${s.frequency} • ${s.category}`,
      )
      .join("\n");

    const prompt = `Sen abonelik optimizasyon uzmanısın. ${user.name} için abonelikleri analiz et.
Aylık gelir: ${formatTRY(user.monthlyIncome)}, bütçe: ${formatTRY(user.monthlyBudget)}, bu ay gider: ${formatTRY(summary.thisMonth.expense)}.

ABONELİKLER:
${subsText}

Sadece JSON döndür:
{
  "optimizations": [
    { "subscriptionId": "id", "name": "...", "verdict": "keep|cancel|downgrade|negotiate", "reason": "...", "monthlySaving": 0, "alternative": "opsiyonel", "confidence": 85 }
  ],
  "totalMonthlySaving": 0,
  "totalYearlySaving": 0,
  "summary": "2 cümle özet"
}

subscriptionId alanları için şu id'leri kullan:
${active.map((s, i) => `${i + 1}. ${s._id} = ${s.name}`).join("\n")}`;

    const res = await callGemini(
      (client, modelName) => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
        });
        return model.generateContent(prompt);
      },
      { retries: 2, timeoutMs: 30000, label: "sub-optimize" },
    );

    const text = res.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const report = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);

    return NextResponse.json({ ...report, ...getAiMeta() });
  } catch (err) {
    return geminiErrorResponse(err);
  }
}

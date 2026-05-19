import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { listWishlistItems, listTransactions, getOrCreateUser } from "@/lib/repo";
import { summarizeFinance } from "@/lib/finance";
import { callGemini, friendlyError } from "@/lib/gemini";
import {
  assertGeminiConfigured,
  geminiErrorResponse,
  getAiMeta,
} from "@/lib/gemini-required";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    assertGeminiConfigured();
    const userId = getUserIdFromReq(req);

    const [items, txs, user] = await Promise.all([
      listWishlistItems(userId),
      listTransactions(userId),
      getOrCreateUser(userId),
    ]);

    const wishlistItems = items.filter((i) => i.status === "wishlist");

    if (wishlistItems.length === 0) {
      return NextResponse.json({
        analysis: {
          prioritizedItems: [],
          budgetPlan: "İstek listesinde henüz öğe yok.",
          totalEstimatedCost: 0,
          affordableThisMonth: 0,
          summary: "İstek listesine ürün/hizmet ekleyerek başlayın!",
        },
        ...getAiMeta(),
      });
    }

    const summary = summarizeFinance(txs, user.monthlyBudget);
    const remainingBudget = Math.max(user.monthlyBudget - summary.thisMonth.expense, 0);
    const totalEstimatedCost = wishlistItems.reduce(
      (s, i) => s + (i.price || i.estimatedPrice || 0),
      0,
    );

    const urgencyOrder = { acil: 4, "ihtiyaç": 3, istek: 2, hobi: 1 } as const;
    const sortedItems = [...wishlistItems].sort(
      (a, b) =>
        urgencyOrder[b.urgency] * b.priority -
        urgencyOrder[a.urgency] * a.priority,
    );

    const topItems = sortedItems.slice(0, 12);
    const itemsText = topItems
      .map((item, i) => {
        const price = item.price || item.estimatedPrice || "Bilinmiyor";
        return `${i + 1}. "${item.name.slice(0, 60)}" — ${price}₺ • öncelik ${item.priority}/5 • ${item.urgency} • ${item.category}${item.note ? ` • not: ${item.note.slice(0, 50)}` : ""}`;
      })
      .join("\n");

    const prompt = `Sen kişisel finans danışmanısın. Kullanıcının istek listesini analiz et ve JSON döndür.

KULLANICI: ${user.name} • gelir ${user.monthlyIncome}₺ • bütçe ${user.monthlyBudget}₺ • bu ay kalan ${remainingBudget}₺ • tasarruf hedefi ${user.savingsGoal}₺ • risk ${user.riskTolerance}

İSTEK LİSTESİ (öncelikli ${topItems.length} öğe):
${itemsText}

JSON ŞEMA:
{
  "prioritizedItems": [
    { "itemId": "...", "name": "...", "recommendedAction": "buy_now|wait|skip|find_alternative", "reason": "kısa kişisel gerekçe", "alternativeSuggestion": "varsa alternatif", "estimatedSavings": 0 }
  ],
  "budgetPlan": "1-2 cümle bu ay için plan",
  "totalEstimatedCost": ${totalEstimatedCost},
  "affordableThisMonth": ${remainingBudget},
  "summary": "2-3 cümle ${user.name}'e hitaben özet"
}

KURAL: itemId mutlaka yukarıdaki öğenin gerçek _id'si olsun:
${topItems.map((it, i) => `${i + 1}. ${it._id}`).join("  ")}
Acil > ihtiyaç > istek > hobi sırasıyla önceliklendir.`;

    const result = await callGemini(
      (client, modelName) => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
        });
        return model.generateContent(prompt);
      },
      { retries: 2, timeoutMs: 25000, label: "wishlist-analyze" },
    );

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);

    return NextResponse.json({ analysis, ...getAiMeta() });
  } catch (err: unknown) {
    console.error("[wishlist/analyze] Hata:", friendlyError(err));
    return geminiErrorResponse(err);
  }
}

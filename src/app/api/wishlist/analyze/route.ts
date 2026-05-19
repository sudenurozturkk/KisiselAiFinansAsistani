import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { listWishlistItems, listTransactions, getOrCreateUser } from "@/lib/repo";
import { summarizeFinance } from "@/lib/finance";
import { callGemini, friendlyError, isGeminiEnabled } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
    });
  }

  const summary = summarizeFinance(txs, user.monthlyBudget);
  const remainingBudget = Math.max(user.monthlyBudget - summary.thisMonth.expense, 0);
  const totalEstimatedCost = wishlistItems.reduce(
    (s, i) => s + (i.price || i.estimatedPrice || 0),
    0,
  );

  // Deterministik mock: öncelik + aciliyet bazlı sıralama (her zaman çalışır)
  const urgencyOrder = { acil: 4, "ihtiyaç": 3, istek: 2, hobi: 1 } as const;
  const sortedItems = [...wishlistItems].sort(
    (a, b) =>
      urgencyOrder[b.urgency] * b.priority -
      urgencyOrder[a.urgency] * a.priority,
  );
  const buildMockAnalysis = () => ({
    prioritizedItems: sortedItems.map((item) => ({
      itemId: item._id,
      name: item.name,
      recommendedAction: (item.priority >= 4 && item.urgency === "acil"
        ? "buy_now"
        : item.priority >= 3 && item.urgency === "ihtiyaç"
          ? "wait"
          : item.urgency === "hobi"
            ? "skip"
            : "wait") as "buy_now" | "wait" | "skip" | "find_alternative",
      reason: `Öncelik ${item.priority}/5, aciliyet "${item.urgency}". ${
        (item.price || 0) > remainingBudget
          ? "Bu ay kalan bütçeyi aşıyor."
          : "Bütçe el veriyor."
      }`,
    })),
    budgetPlan: `Bu ay kalan bütçen ${remainingBudget}₺. En yüksek öncelikli ${Math.min(3, sortedItems.length)} öğeye odaklan.`,
    totalEstimatedCost,
    affordableThisMonth: remainingBudget,
    summary: `${user.name}, ${wishlistItems.length} istek listesi öğesi var, toplam ${totalEstimatedCost}₺ tahmini maliyet. Acil ihtiyaçlardan başlayıp hobileri sona bırak.`,
  });

  if (!isGeminiEnabled()) {
    return NextResponse.json({ analysis: buildMockAnalysis() });
  }

  // AI prompt'unu kısa tutmak için en yüksek öncelikli 12 öğe
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

KURAL: itemId mutlaka yukarıdaki öğenin gerçek _id'si olsun → şu id'leri kullan:
${topItems.map((it, i) => `${i + 1}. ${it._id}`).join("  ")}
Acil > ihtiyaç > istek > hobi sırasıyla önceliklendir. Bütçeyi aşan hobileri "skip" yap.`;

  try {
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

    if (!result) {
      return NextResponse.json({
        analysis: buildMockAnalysis(),
        fallback: true,
      });
    }

    const text = result.response.text();
    let analysis: Record<string, unknown>;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      return NextResponse.json({
        analysis: buildMockAnalysis(),
        fallback: true,
        parseError: true,
      });
    }
    return NextResponse.json({ analysis });
  } catch (err: unknown) {
    const msg = friendlyError(err);
    console.error("[wishlist/analyze] Hata:", msg);
    return NextResponse.json({
      analysis: buildMockAnalysis(),
      fallback: true,
      error: msg,
    });
  }
}

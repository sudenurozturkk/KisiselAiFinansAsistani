import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { listWishlistItems, listTransactions, getOrCreateUser } from "@/lib/repo";
import { summarizeFinance } from "@/lib/finance";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { withRetry, friendlyError } from "@/lib/gemini";

export const dynamic = "force-dynamic";

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";

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

  if (!apiKey) {
    // Mock fallback
    const prioritized = wishlistItems
      .sort((a, b) => {
        const urgencyOrder = { acil: 4, "ihtiyaç": 3, istek: 2, hobi: 1 };
        return (urgencyOrder[b.urgency] * b.priority) - (urgencyOrder[a.urgency] * a.priority);
      })
      .map((item) => ({
        itemId: item._id,
        name: item.name,
        recommendedAction: (item.priority >= 4 && item.urgency === "acil"
          ? "buy_now"
          : item.priority >= 3
            ? "wait"
            : "skip") as "buy_now" | "wait" | "skip" | "find_alternative",
        reason: `Öncelik: ${item.priority}/5, Aciliyet: ${item.urgency}`,
      }));

    return NextResponse.json({
      analysis: {
        prioritizedItems: prioritized,
        budgetPlan: `Bu ay kalan bütçeniz: ${remainingBudget}₺`,
        totalEstimatedCost: wishlistItems.reduce((s, i) => s + (i.price || i.estimatedPrice || 0), 0),
        affordableThisMonth: remainingBudget,
        summary: "AI analizi için API anahtarı gerekli.",
      },
    });
  }

  // Gemini ile akıllı analiz
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: modelName });

  const itemsText = wishlistItems.map((item, i) => {
    const price = item.price || item.estimatedPrice || "Bilinmiyor";
    return `${i + 1}. "${item.name}" — Fiyat: ${price}₺, Öncelik: ${item.priority}/5, Aciliyet: ${item.urgency}, Kategori: ${item.category}${item.note ? `, Not: "${item.note}"` : ""}${item.url ? `, Link: ${item.url}` : ""}`;
  }).join("\n");

  const prompt = `Sen bir kişisel finans danışmanısın. Kullanıcının istek listesini ve finansal durumunu analiz et.

KULLANICI PROFİLİ:
- İsim: ${user.name}
- Aylık gelir: ${user.monthlyIncome}₺
- Aylık bütçe: ${user.monthlyBudget}₺
- Bu ay harcanan: ${summary.thisMonth.expense}₺
- Kalan bütçe: ${remainingBudget}₺
- Tasarruf hedefi: ${user.savingsGoal}₺
- Risk toleransı: ${user.riskTolerance}
- Hedefler: ${user.goals.join(", ") || "Belirtilmemiş"}

İSTEK LİSTESİ:
${itemsText}

Aşağıdaki JSON formatında yanıt ver. Yalnızca JSON döndür.

{
  "prioritizedItems": [
    {
      "itemId": "öğe _id'si",
      "name": "Ürün adı",
      "recommendedAction": "buy_now | wait | skip | find_alternative",
      "reason": "Neden bu öneri yapılıyor (kişiye özel, detaylı açıklama)",
      "alternativeSuggestion": "Varsa daha uygun fiyatlı veya daha iyi alternatif önerisi",
      "estimatedSavings": 0
    }
  ],
  "budgetPlan": "Bu ay için detaylı bütçe planı ve ne zaman ne alınmalı",
  "totalEstimatedCost": 0,
  "affordableThisMonth": ${remainingBudget},
  "summary": "Genel durum özeti ve kişiye özel tavsiye (2-3 cümle)"
}

KURALLAR:
- Kullanıcının notlarını dikkate al (hobi, ihtiyaç, acil vs.)
- Acil ihtiyaçları öncelikle, hobileri sonraya bırak
- Bütçeyi aşmayacak şekilde plan yap
- Tasarruf hedefini korumaya dikkat et
- "ihtiyaç" ve "acil" olan öğeleri "istek" ve "hobi"den önce öner
- Fiyatı bilinmeyenler için tahmini fiyat öner
- Daha uygun alternatif bulunabiliyorsa öner
- itemId alanında öğenin gerçek _id değerini kullan`;

  try {
    const result = await withRetry(() => model.generateContent(prompt));
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    return NextResponse.json({ analysis });
  } catch (err: unknown) {
    const msg = friendlyError(err);
    console.error("[wishlist/analyze] Hata:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

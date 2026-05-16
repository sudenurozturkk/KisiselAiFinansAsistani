import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  listWishlistItems,
  listTransactions,
  updateWishlistItem,
  getOrCreateUser,
} from "@/lib/repo";
import { analyzeProduct } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/wishlist/:id/ai-analyze
 *
 * Tek bir wishlist öğesini AI ile kişiselleştirilmiş analiz et.
 * Sonucu item üzerine yazar (aiAnalysis, aiVerdict, estimatedPrice).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = getUserIdFromReq(req);
  const { id } = await params;

  const items = await listWishlistItems(userId);
  const item = items.find((i) => i._id === id);
  if (!item) {
    return NextResponse.json({ error: "Öğe bulunamadı" }, { status: 404 });
  }


  const [user, txs] = await Promise.all([
    getOrCreateUser(userId),
    listTransactions(userId),
  ]);

  const result = await analyzeProduct(
    {
      name: item.name,
      description: item.description,
      brand: item.brand,
      siteName: item.siteName,
      price: item.price,
      url: item.url,
      note: item.note,
      urgency: item.urgency,
      category: item.category,
    },
    user,
    txs,
  );

  // Sonucu kalıcı olarak kaydet
  const summaryWithDetail = [
    result.summary,
    result.affordabilityNote && `\n\n💰 ${result.affordabilityNote}`,
    result.pros.length > 0 && `\n\n✅ Artıları: ${result.pros.join(", ")}`,
    result.cons.length > 0 && `\n⚠️ Dikkat: ${result.cons.join(", ")}`,
    result.alternatives && result.alternatives.length > 0
      ? `\n💡 Alternatifler: ${result.alternatives.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const updated = await updateWishlistItem(userId, id, {
    aiAnalysis: summaryWithDetail,
    aiVerdict: result.verdict,
    ...(result.estimatedPrice && !item.price
      ? { estimatedPrice: result.estimatedPrice }
      : {}),
  });

  return NextResponse.json({ item: updated, analysis: result });
}

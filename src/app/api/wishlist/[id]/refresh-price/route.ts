import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { listWishlistItems, updateWishlistItem } from "@/lib/repo";
import { scrapeProductUrl } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/wishlist/:id/refresh-price
 *
 * Ürün URL'sini yeniden kazır, güncel fiyatı çıkarır,
 * priceHistory'e yeni nokta ekler. Fiyat düştüyse ek bilgi döner.
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
  if (!item.url) {
    return NextResponse.json(
      { error: "Bu öğenin URL'si yok, fiyat takibi yapılamaz" },
      { status: 400 },
    );
  }

  let scrape;
  try {
    scrape = await scrapeProductUrl(item.url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json(
      { error: `URL okunamadı: ${msg}` },
      { status: 200 },
    );
  }

  const newPrice = scrape.price;
  if (newPrice === undefined) {
    // En azından son kontrol zamanını güncelle
    const updated = await updateWishlistItem(userId, id, {
      lastCheckedAt: new Date().toISOString(),
    });
    return NextResponse.json({
      item: updated,
      priceFound: false,
      message: "Fiyat çıkarılamadı, sayfa yapısı değişmiş olabilir.",
    });
  }

  const oldPrice = item.price;
  const history = item.priceHistory ?? [];
  const newHistory = [
    ...history,
    { date: new Date().toISOString(), price: newPrice },
  ].slice(-20);

  const patch = {
    price: newPrice,
    priceHistory: newHistory,
    lastCheckedAt: new Date().toISOString(),
    originalPrice: item.originalPrice ?? oldPrice ?? newPrice,
    // Görsel/açıklama güncelleştirmeleri (yenilendiyse)
    ...(scrape.imageUrl && !item.imageUrl ? { imageUrl: scrape.imageUrl } : {}),
    ...(scrape.description && !item.description
      ? { description: scrape.description }
      : {}),
  };

  const updated = await updateWishlistItem(userId, id, patch);

  const dropped = oldPrice !== undefined && newPrice < oldPrice;
  const priceDropPct = dropped
    ? Math.round(((oldPrice - newPrice) / oldPrice) * 100)
    : 0;

  return NextResponse.json({
    item: updated,
    priceFound: true,
    oldPrice,
    newPrice,
    dropped,
    priceDropPct,
    message: dropped
      ? `🎉 Fiyat ${priceDropPct}% düştü! Eski: ${oldPrice}₺ → Yeni: ${newPrice}₺`
      : oldPrice && newPrice > oldPrice
        ? `Fiyat ${oldPrice}₺ → ${newPrice}₺ yükseldi.`
        : `Fiyat değişmedi: ${newPrice}₺`,
  });
}

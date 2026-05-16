import { NextRequest, NextResponse } from "next/server";
import { scrapeProductUrl } from "@/lib/scraper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/wishlist/scrape
 * Body: { url: string }
 * Response: ProductScrapeData
 *
 * URL'den ürün bilgisi çekme: başlık, fiyat, görsel, marka, açıklama.
 */
export async function POST(req: NextRequest) {
  let url: string;
  try {
    const body = await req.json();
    url = String(body.url || "").trim();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }

  if (!url) {
    return NextResponse.json({ error: "url alanı zorunlu" }, { status: 400 });
  }

  try {
    const data = await scrapeProductUrl(url);
    return NextResponse.json({ data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.warn("[scrape] başarısız:", url, "→", msg);
    return NextResponse.json(
      { error: `URL okunamadı: ${msg}`, partial: { url } },
      { status: 200 }, // 200 dön: kullanıcı manuel doldurabilir
    );
  }
}

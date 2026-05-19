import { NextRequest, NextResponse } from "next/server";
import { scrapeWithPlaywright } from "@/lib/playwright-scraper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20; // Playwright daha uzun sürebilir

/**
 * POST /api/wishlist/scrape-browser
 * Body: { url: string }
 *
 * Playwright headless browser ile ürün bilgisi çekme.
 * CSR sitelerde (Trendyol, Hepsiburada vb.) fetch başarısız olduğunda kullanılır.
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
    console.log(`[scrape-browser] Playwright ile scrape başlatılıyor: ${url}`);
    const data = await scrapeWithPlaywright(url);
    return NextResponse.json({
      data,
      method: "playwright",
      success: !!(data.name || data.price),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.warn("[scrape-browser] başarısız:", url, "→", msg);
    return NextResponse.json(
      { error: `Browser scrape başarısız: ${msg}`, partial: { url }, method: "playwright" },
      { status: 200 },
    );
  }
}

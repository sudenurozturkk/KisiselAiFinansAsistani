import { NextRequest, NextResponse } from "next/server";
import {
  fetchPrices,
  resolveSymbol,
  getMarketSummaryForAI,
} from "@/lib/market";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/market?tickers=THYAO,GARAN,XAU/TRY,BTC,USD/TRY
 * Belirtilen ticker'lar için gerçek zamanlı fiyat döner.
 *
 * GET /api/market?resolve=Türk Hava Yolları
 * Türkçe isimden ticker çözümler.
 *
 * GET /api/market?summary=true
 * AI için piyasa özeti döner.
 */
export async function GET(req: NextRequest) {
  const tickersParam = req.nextUrl.searchParams.get("tickers");
  const resolveParam = req.nextUrl.searchParams.get("resolve");
  const summaryParam = req.nextUrl.searchParams.get("summary");

  // AI piyasa özeti
  if (summaryParam === "true") {
    const summary = await getMarketSummaryForAI();
    return NextResponse.json({ summary, updatedAt: new Date().toISOString() });
  }

  // Sembol çözümleme
  if (resolveParam) {
    const resolved = resolveSymbol(resolveParam);
    return NextResponse.json({
      input: resolveParam,
      resolved: resolved?.symbol || null,
      name: resolved?.name || null,
      exchange: resolved?.exchange || null,
    });
  }

  // Fiyat çekme
  if (!tickersParam) {
    return NextResponse.json(
      { error: "tickers parametresi gerekli. Örn: ?tickers=THYAO,BTC,XAU/TRY" },
      { status: 400 },
    );
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "En az 1 ticker belirtin." },
      { status: 400 },
    );
  }

  try {
    const prices = await fetchPrices(tickers);
    return NextResponse.json({
      prices,
      updatedAt: new Date().toISOString(),
      source: process.env.TWELVEDATA_API_KEY ? "twelvedata" : "fallback",
    });
  } catch (err) {
    console.error("[market] Error:", err);
    return NextResponse.json(
      { error: "Piyasa verileri alınamadı." },
      { status: 500 },
    );
  }
}

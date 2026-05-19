import { NextRequest, NextResponse } from "next/server";
import { fetchPrices, fetchTimeSeries, getMarketSummaryForAI, resolveSymbol } from "@/lib/market";

export const dynamic = "force-dynamic";

/**
 * GET /api/market-prices
 *
 * Query params:
 *  - symbols: virgülle ayrılmış semboller (örn: "THYAO,GARAN,USD,BTC,XAU")
 *  - timeseries: tek sembol + fiyat geçmişi (sparkline)
 *  - resolve: doğal dil sembol çözme ("Türk Hava Yolları" → THYAO)
 *  - summary: AI için piyasa özeti (text)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // 1. Sembol çözme
  const resolveQuery = searchParams.get("resolve");
  if (resolveQuery) {
    const resolved = resolveSymbol(resolveQuery);
    return NextResponse.json({
      input: resolveQuery,
      resolved: resolved || null,
      found: !!resolved,
    });
  }

  // 2. AI piyasa özeti
  if (searchParams.has("summary")) {
    const text = await getMarketSummaryForAI();
    return NextResponse.json({ summary: text });
  }

  // 3. Zaman serisi
  const tsSymbol = searchParams.get("timeseries");
  if (tsSymbol) {
    const interval = searchParams.get("interval") || "1day";
    const outputSize = parseInt(searchParams.get("days") || "30", 10);
    const series = await fetchTimeSeries(tsSymbol, interval, outputSize);
    return NextResponse.json({ series });
  }

  // 4. Toplu fiyat
  const symbolsParam = searchParams.get("symbols") || "USD,EUR,XAU,BTC,THYAO,GARAN";
  const symbols = symbolsParam.split(",").map(s => s.trim()).filter(Boolean);
  const prices = await fetchPrices(symbols);

  return NextResponse.json({
    prices,
    count: Object.keys(prices).length,
    updatedAt: new Date().toISOString(),
  });
}

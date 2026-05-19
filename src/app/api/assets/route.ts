import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { listAssets, addAsset, seedAllIfEmpty } from "@/lib/repo";
import { nowIso } from "@/lib/store";
import {
  resolveAssetPrice,
  resolveSymbol,
  fetchPrice,
  fetchPrices,
} from "@/lib/market";
import type { AssetType, AssetsResponse } from "@/lib/types";

/**
 * GET /api/assets — Kullanıcının varlıklarını listele (güncel fiyatlarla)
 */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  await seedAllIfEmpty(userId);
  const assets = await listAssets(userId);

  // Gerçek fiyatlarla güncelle (tekil resolveAssetPrice)
  const updatedAssets = await Promise.all(
    assets.map(async (a) => {
      try {
        const realPrice = await resolveAssetPrice(a.ticker, a.type);
        if (realPrice && realPrice > 0) {
          a.currentPrice = realPrice;
          a.currentValue = a.quantity * realPrice;
          a.updatedAt = nowIso();
        }
      } catch {
        // Fiyat alınamazsa mevcut değeri koru
      }
      return a;
    }),
  );

  // Günlük değişim verisi — ticker'ları toplu çek
  try {
    const tickersWithSymbol = updatedAssets
      .map((a) => a.ticker)
      .filter((t): t is string => !!t);
    if (tickersWithSymbol.length > 0) {
      const priceMap = await fetchPrices(tickersWithSymbol);
      for (const a of updatedAssets) {
        if (!a.ticker) continue;
        const mp =
          priceMap[a.ticker] || priceMap[a.ticker.toUpperCase()] || null;
        if (mp) {
          a.dailyChange = mp.change;
          a.dailyChangePct = mp.changePercent;
        }
      }
    }
  } catch {
    // daily change opsiyonel, hata durumunda boş bırak
  }

  const totalValue = updatedAssets.reduce((s, a) => s + a.currentValue, 0);
  const totalCost = updatedAssets.reduce(
    (s, a) => s + a.quantity * a.buyPrice,
    0,
  );
  const totalProfit = totalValue - totalCost;
  const profitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // Türe göre grupla
  const typeMap = new Map<string, { total: number; count: number }>();
  for (const a of updatedAssets) {
    const existing = typeMap.get(a.type) || { total: 0, count: 0 };
    existing.total += a.currentValue;
    existing.count += 1;
    typeMap.set(a.type, existing);
  }
  const byType = Array.from(typeMap.entries()).map(([type, data]) => ({
    type: type as AssetType,
    label: type,
    ...data,
  }));

  const body: AssetsResponse = {
    assets: updatedAssets,
    totalValue,
    totalProfit,
    profitPercent,
    byType,
  };

  return NextResponse.json(body);
}

/**
 * POST /api/assets — Yeni varlık ekle (AI sembol çözme + gerçek fiyat)
 */
export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const data = await req.json();

  const now = nowIso();
  let ticker = data.ticker || undefined;
  let name = data.name || "Bilinmeyen Varlık";
  let currentPrice = Number(data.currentPrice) || 0;
  const quantity = Number(data.quantity) || 0;

  // AI sembol çözme: "THY" → THYAO, "Türk Hava Yolları" → THYAO
  if (data.naturalInput) {
    const resolved = resolveSymbol(data.naturalInput);
    if (resolved) {
      ticker = resolved.symbol;
      name = resolved.name;
      // Gerçek fiyat çek
      try {
        const realPrice = await resolveAssetPrice(ticker, data.type || "hisse");
        if (realPrice && realPrice > 0) {
          currentPrice = realPrice;
        }
      } catch {
        /* fallback */
      }
    }
  }

  // Ticker varsa ve fiyat 0 ise gerçek fiyat çek
  if (ticker && currentPrice <= 0) {
    try {
      const realPrice = await resolveAssetPrice(ticker, data.type || "diğer");
      if (realPrice && realPrice > 0) {
        currentPrice = realPrice;
      }
    } catch {
      /* fallback */
    }
  }

  const asset = await addAsset({
    userId,
    type: data.type || "diğer",
    name,
    ticker,
    quantity,
    buyPrice: Number(data.buyPrice) || currentPrice,
    currentPrice,
    currentValue: quantity * currentPrice,
    currency: data.currency || "TRY",
    note: data.note || undefined,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ asset }, { status: 201 });
}

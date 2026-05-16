import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { listAssets, addAsset } from "@/lib/repo";
import { nowIso } from "@/lib/store";
import type { AssetType, AssetsResponse } from "@/lib/types";

/** GET /api/assets — Kullanıcının varlıklarını listele */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const assets = await listAssets(userId);

  const totalValue = assets.reduce((s, a) => s + a.currentValue, 0);
  const totalCost = assets.reduce((s, a) => s + a.quantity * a.buyPrice, 0);
  const totalProfit = totalValue - totalCost;
  const profitPercent = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

  // Türe göre grupla
  const typeMap = new Map<string, { total: number; count: number }>();
  for (const a of assets) {
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
    assets,
    totalValue,
    totalProfit,
    profitPercent,
    byType,
  };

  return NextResponse.json(body);
}

/** POST /api/assets — Yeni varlık ekle */
export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const data = await req.json();

  const now = nowIso();
  const quantity = Number(data.quantity) || 0;
  const currentPrice = Number(data.currentPrice) || 0;

  const asset = await addAsset({
    userId,
    type: data.type || "diğer",
    name: data.name || "Bilinmeyen Varlık",
    ticker: data.ticker || undefined,
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

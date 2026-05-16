import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  updateWishlistItem,
  deleteWishlistItem,
  listWishlistItems,
} from "@/lib/repo";
import type { WishlistItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = getUserIdFromReq(req);
  const { id } = await params;
  const body = await req.json();

  const patch: Partial<WishlistItem> = {};
  const allowed = [
    "name",
    "url",
    "imageUrl",
    "description",
    "brand",
    "siteName",
    "price",
    "estimatedPrice",
    "originalPrice",
    "priceAlerts",
    "category",
    "priority",
    "urgency",
    "status",
    "note",
    "purchasedAt",
    "purchasedPrice",
    "aiAnalysis",
    "aiVerdict",
  ] as const;

  for (const k of allowed) {
    if (k in body) {
      (patch as Record<string, unknown>)[k] = body[k];
    }
  }

  // Fiyat değiştiyse priceHistory'e ekle
  if ("price" in body && typeof body.price === "number" && body.price > 0) {
    const items = await listWishlistItems(userId);
    const current = items.find((i) => i._id === id);
    if (current && current.price !== body.price) {
      const history = current.priceHistory ?? [];
      patch.priceHistory = [
        ...history,
        { date: new Date().toISOString(), price: body.price },
      ].slice(-20); // son 20 nokta
      patch.lastCheckedAt = new Date().toISOString();
      // İlk fiyatı originalPrice olarak sakla
      if (!current.originalPrice) {
        patch.originalPrice = current.price ?? body.price;
      }
    }
  }

  // Satın alma işlemi
  if (body.status === "purchased" && !body.purchasedAt) {
    patch.purchasedAt = new Date().toISOString();
    if (!body.purchasedPrice && body.price) {
      patch.purchasedPrice = Number(body.price);
    }
  }

  const updated = await updateWishlistItem(userId, id, patch);
  if (!updated)
    return NextResponse.json({ error: "Öğe bulunamadı" }, { status: 404 });
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = getUserIdFromReq(req);
  const { id } = await params;
  const ok = await deleteWishlistItem(userId, id);
  if (!ok)
    return NextResponse.json({ error: "Öğe bulunamadı" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

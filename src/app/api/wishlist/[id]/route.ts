import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { updateWishlistItem, deleteWishlistItem } from "@/lib/repo";
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
    "name", "url", "price", "estimatedPrice", "category",
    "priority", "urgency", "status", "note", "purchasedAt", "purchasedPrice", "aiAnalysis",
  ] as const;

  for (const k of allowed) {
    if (k in body) {
      (patch as Record<string, unknown>)[k] = body[k];
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

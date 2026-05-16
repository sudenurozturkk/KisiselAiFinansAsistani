import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { listWishlistItems, addWishlistItem, seedAllIfEmpty } from "@/lib/repo";
import type { WishlistItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  await seedAllIfEmpty(userId);
  const items = await listWishlistItems(userId);

  const wishlistItems = items.filter((i) => i.status === "wishlist");
  const purchasedItems = items.filter((i) => i.status === "purchased");

  const totalEstimated = wishlistItems.reduce(
    (s, i) => s + (i.price || i.estimatedPrice || 0),
    0,
  );
  const purchasedTotal = purchasedItems.reduce(
    (s, i) => s + (i.purchasedPrice || i.price || 0),
    0,
  );

  return NextResponse.json({
    items,
    totalEstimated,
    purchasedTotal,
    wishlistCount: wishlistItems.length,
    purchasedCount: purchasedItems.length,
  });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const body = await req.json();

  const {
    name,
    url,
    imageUrl,
    description,
    brand,
    siteName,
    price,
    estimatedPrice,
    category = "Diğer",
    priority = 3,
    urgency = "istek",
    note,
    priceAlerts,
  } = body as Partial<WishlistItem>;

  if (!name || name.trim().length < 2) {
    return NextResponse.json(
      { error: "Ürün/hizmet adı gerekli (en az 2 karakter)" },
      { status: 400 },
    );
  }

  const initialPrice = price ? Number(price) : undefined;
  const item = await addWishlistItem({
    userId,
    name: name.trim(),
    url: url?.trim() || undefined,
    imageUrl: imageUrl?.trim() || undefined,
    description: description?.trim() || undefined,
    brand: brand?.trim() || undefined,
    siteName: siteName?.trim() || undefined,
    price: initialPrice,
    originalPrice: initialPrice, // ekleme anındaki fiyatı sakla
    priceHistory: initialPrice
      ? [{ date: new Date().toISOString(), price: initialPrice }]
      : undefined,
    estimatedPrice: estimatedPrice ? Number(estimatedPrice) : undefined,
    category: category as WishlistItem["category"],
    priority: (priority as WishlistItem["priority"]) || 3,
    urgency: (urgency as WishlistItem["urgency"]) || "istek",
    status: "wishlist",
    note: note?.trim() || undefined,
    priceAlerts: priceAlerts ?? true,
    lastCheckedAt: new Date().toISOString(),
  });

  return NextResponse.json({ item }, { status: 201 });
}

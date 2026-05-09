import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { addTransaction } from "@/lib/repo";
import { PRODUCTS } from "@/lib/products";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const { productId, installments = 1 } = await req.json();
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
  }
  const inst = Math.max(1, Math.floor(Number(installments) || 1));
  const monthlyAmount = Math.round(product.price / inst);

  // Bu ay düşecek ilk taksit / tek çekim:
  const tx = await addTransaction({
    userId,
    type: "gider",
    category: product.category,
    amount: monthlyAmount,
    note: inst > 1 ? `${product.name} — 1/${inst} taksit` : product.name,
    date: new Date().toISOString(),
  });

  return NextResponse.json({
    transaction: tx,
    purchase: {
      productId: product.id,
      total: product.price,
      installments: inst,
      monthlyAmount,
    },
  });
}

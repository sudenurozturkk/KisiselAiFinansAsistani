import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { listSubscriptions, addSubscription } from "@/lib/repo";
import type { Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function monthlyEquivalent(amount: number, freq: Subscription["frequency"]) {
  if (freq === "haftalık") return amount * 4.33;
  if (freq === "yıllık") return amount / 12;
  return amount;
}

export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const subs = await listSubscriptions(userId);
  const activeSubs = subs.filter((s) => s.active);

  const totalMonthly = activeSubs.reduce(
    (s, sub) => s + monthlyEquivalent(sub.amount, sub.frequency),
    0,
  );

  return NextResponse.json({
    subscriptions: subs,
    totalMonthly: Math.round(totalMonthly),
    totalYearly: Math.round(totalMonthly * 12),
    activeCount: activeSubs.length,
  });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const body = await req.json();

  const { name, amount, frequency = "aylık", category = "Diğer", nextPaymentDate, note } =
    body as Partial<Subscription>;

  if (!name || name.trim().length < 2) {
    return NextResponse.json(
      { error: "Abonelik adı gerekli (en az 2 karakter)" },
      { status: 400 },
    );
  }
  if (!amount || amount <= 0) {
    return NextResponse.json(
      { error: "Geçerli bir tutar giriniz" },
      { status: 400 },
    );
  }

  const sub = await addSubscription({
    userId,
    name: name.trim(),
    amount: Number(amount),
    frequency: frequency as Subscription["frequency"],
    category: category as Subscription["category"],
    nextPaymentDate: nextPaymentDate || undefined,
    note: note?.trim() || undefined,
    active: true,
  });

  return NextResponse.json({ subscription: sub }, { status: 201 });
}

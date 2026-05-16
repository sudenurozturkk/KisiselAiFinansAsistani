import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { listIncomes, addIncome } from "@/lib/repo";
import type { IncomesResponse } from "@/lib/types";

/** Frekansa göre aylık tutara normalize et */
function toMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case "haftalık":
      return amount * 4.33;
    case "yıllık":
      return amount / 12;
    default:
      return amount;
  }
}

/** GET /api/incomes — Ek gelirleri listele */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const incomes = await listIncomes(userId);
  const activeIncomes = incomes.filter((i) => i.active);

  const totalMonthly = activeIncomes.reduce(
    (sum, i) => sum + toMonthly(i.amount, i.frequency),
    0,
  );

  const body: IncomesResponse = {
    incomes,
    totalMonthly: Math.round(totalMonthly),
    activeCount: activeIncomes.length,
  };

  return NextResponse.json(body);
}

/** POST /api/incomes — Yeni ek gelir ekle */
export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const data = await req.json();

  const income = await addIncome({
    userId,
    name: data.name || "Bilinmeyen Gelir",
    amount: Number(data.amount) || 0,
    frequency: data.frequency || "aylık",
    category: data.category || "diğer",
    active: data.active !== false,
    note: data.note || undefined,
  });

  return NextResponse.json({ income }, { status: 201 });
}

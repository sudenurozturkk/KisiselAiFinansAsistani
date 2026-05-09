import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  getOrCreateUser,
  listTransactions,
  seedTransactionsIfEmpty,
} from "@/lib/repo";
import { summarizeFinance } from "@/lib/finance";
import { PRODUCTS } from "@/lib/products";
import type { EnrichedProduct } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const user = await getOrCreateUser(userId);
  await seedTransactionsIfEmpty(userId);
  const txs = await listTransactions(userId);
  const summary = summarizeFinance(txs, user.monthlyBudget);

  const remaining = Math.max(user.monthlyBudget - summary.thisMonth.expense, 0);

  const enriched: EnrichedProduct[] = PRODUCTS.map((p) => {
    const affordableNow = p.price <= remaining;
    const recommendedInstallment = pickInstallment(
      p.price,
      remaining,
      p.installments,
    );
    const monthly = recommendedInstallment
      ? Math.round(p.price / recommendedInstallment)
      : p.price;
    const budgetImpactPct =
      user.monthlyBudget > 0
        ? Math.round((monthly / user.monthlyBudget) * 100)
        : 0;
    const riskLevel =
      budgetImpactPct < 10 ? "low" : budgetImpactPct < 25 ? "medium" : "high";
    const advice = buildAdvice(
      p,
      user,
      remaining,
      recommendedInstallment,
      monthly,
    );
    return {
      ...p,
      affordableNow,
      recommendedInstallment,
      monthly,
      advice,
      budgetImpactPct,
      riskLevel,
    };
  });

  return NextResponse.json({
    products: enriched,
    context: { remainingBudget: remaining, summary, user },
  });
}

function pickInstallment(price: number, remaining: number, options: number[]) {
  if (price <= remaining) return 1;
  const sorted = [...options].sort((a, b) => a - b);
  for (const n of sorted) {
    if (price / n <= remaining) return n;
  }
  return sorted[sorted.length - 1] || 1;
}

function buildAdvice(
  p: { price: number; name: string },
  user: { savingsGoal: number },
  remaining: number,
  inst: number,
  monthly: number,
): string {
  if (p.price <= remaining * 0.3) {
    return `Bu ürün bütçeyi rahat etmez — tek çekim alabilirsin, tasarruf hedefin sağlam kalır.`;
  }
  if (p.price <= remaining) {
    return `Bütçe yeterli ama nakit pozisyonunu zorlar. ${inst} taksit (~${monthly}₺/ay) daha güvenli bir yöntem.`;
  }
  const overBy = p.price - remaining;
  const stress = monthly > user.savingsGoal / 2;
  return `Bu ay nakit yetersiz (${overBy}₺ açık). ${inst} taksitte ~${monthly}₺/ay olur; ${stress ? "ertelemeyi değerlendir." : "kontrollü ilerleyebilirsin."}`;
}

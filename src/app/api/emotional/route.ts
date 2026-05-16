import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { getOrCreateUser, listTransactions } from "@/lib/repo";
import { analyzeEmotionalPatterns } from "@/lib/emotional";

export const dynamic = "force-dynamic";

/** GET /api/emotional — Duygusal harcama analizi */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const [user, txs] = await Promise.all([
    getOrCreateUser(userId),
    listTransactions(userId),
  ]);

  const result = analyzeEmotionalPatterns(txs);

  return NextResponse.json({
    ...result,
    userName: user.name,
    monthlyBudget: user.monthlyBudget,
  });
}

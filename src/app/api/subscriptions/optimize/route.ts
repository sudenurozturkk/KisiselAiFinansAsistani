import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  getOrCreateUser,
  listTransactions,
  listSubscriptions,
} from "@/lib/repo";
import { generateSubOptimizations } from "@/lib/sub-optimizer";

export const dynamic = "force-dynamic";

/** GET /api/subscriptions/optimize — AI abonelik optimizasyonu */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const [user, txs, subs] = await Promise.all([
    getOrCreateUser(userId),
    listTransactions(userId),
    listSubscriptions(userId),
  ]);

  const report = generateSubOptimizations(subs, user, txs);

  return NextResponse.json(report);
}

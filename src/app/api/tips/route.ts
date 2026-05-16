import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { getOrCreateUser, listTransactions } from "@/lib/repo";
import { generateDailyTips } from "@/lib/daily-tips";

export const dynamic = "force-dynamic";

/** GET /api/tips — Kişiselleştirilmiş günlük AI tavsiyeleri */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const [user, txs] = await Promise.all([
    getOrCreateUser(userId),
    listTransactions(userId),
  ]);

  const tips = generateDailyTips(user, txs);

  return NextResponse.json({ tips });
}

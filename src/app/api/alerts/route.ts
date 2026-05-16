import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  getOrCreateUser,
  listTransactions,
  listSubscriptions,
} from "@/lib/repo";
import { generateSmartAlerts } from "@/lib/smart-alerts";

export const dynamic = "force-dynamic";

/** GET /api/alerts — Akıllı bildirimler */
export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const [user, txs, subs] = await Promise.all([
    getOrCreateUser(userId),
    listTransactions(userId),
    listSubscriptions(userId),
  ]);

  const alerts = generateSmartAlerts(user, txs, subs);

  return NextResponse.json({ alerts });
}

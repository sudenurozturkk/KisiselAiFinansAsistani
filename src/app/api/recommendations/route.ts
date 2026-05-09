import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  getOrCreateUser,
  listTransactions,
  seedTransactionsIfEmpty,
} from "@/lib/repo";
import { generateRecommendations } from "@/lib/gemini";
import { buildInsights, summarizeFinance } from "@/lib/finance";
import { detectAnomalies } from "@/lib/anomaly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const user = await getOrCreateUser(userId);
  await seedTransactionsIfEmpty(userId);
  const txs = await listTransactions(userId);
  const summary = summarizeFinance(txs, user.monthlyBudget);
  const insights = buildInsights(summary, user);
  const anomalies = detectAnomalies(txs);
  const { text: advice, structured } = await generateRecommendations(user, txs);

  return NextResponse.json({
    advice,
    structured,
    summary,
    insights,
    anomalies,
    user,
  });
}

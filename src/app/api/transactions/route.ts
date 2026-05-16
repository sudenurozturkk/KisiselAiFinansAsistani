import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  addTransaction,
  getOrCreateUser,
  listTransactions,
} from "@/lib/repo";
import { buildInsights, summarizeFinance } from "@/lib/finance";
import { detectAnomalies } from "@/lib/anomaly";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const user = await getOrCreateUser(userId);
  const txs = await listTransactions(userId);
  const summary = summarizeFinance(txs, user.monthlyBudget);
  const insights = buildInsights(summary, user);
  const anomalies = detectAnomalies(txs);
  return NextResponse.json({ transactions: txs, summary, insights, anomalies });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const body = await req.json();
  const tx = await addTransaction({
    userId,
    type: body.type,
    category: body.category,
    amount: Number(body.amount),
    note: body.note,
    date: body.date || new Date().toISOString(),
  });
  return NextResponse.json({ transaction: tx });
}

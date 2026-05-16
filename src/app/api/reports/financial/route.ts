import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  getOrCreateUser,
  listTransactions,
  seedAllIfEmpty,
} from "@/lib/repo";
import { generateFinancialReport } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  await seedAllIfEmpty(userId);
  const user = await getOrCreateUser(userId);
  const txs = await listTransactions(userId);
  const markdown = await generateFinancialReport({ user, txs });
  const generatedAt = new Date().toISOString();
  return NextResponse.json({ markdown, generatedAt, user });
}

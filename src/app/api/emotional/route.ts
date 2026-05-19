import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { getOrCreateUser, listTransactions } from "@/lib/repo";
import { analyzeEmotionalSpending } from "@/lib/gemini";
import {
  assertGeminiConfigured,
  geminiErrorResponse,
  getAiMeta,
} from "@/lib/gemini-required";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/emotional — Gemini ile duygusal harcama analizi (Finansal Ayna) */
export async function GET(req: NextRequest) {
  try {
    assertGeminiConfigured();
    const userId = getUserIdFromReq(req);
    const [user, txs] = await Promise.all([
      getOrCreateUser(userId),
      listTransactions(userId),
    ]);

    const result = await analyzeEmotionalSpending(user, txs);

    return NextResponse.json({
      ...result,
      userName: user.name,
      monthlyBudget: user.monthlyBudget,
      ...getAiMeta(),
    });
  } catch (err) {
    return geminiErrorResponse(err);
  }
}

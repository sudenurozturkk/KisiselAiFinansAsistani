import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { getOrCreateUser, listTransactions } from "@/lib/repo";
import { generateDailyTipsWithGemini } from "@/lib/gemini";
import {
  geminiErrorResponse,
  getAiMeta,
  assertGeminiConfigured,
} from "@/lib/gemini-required";

export const dynamic = "force-dynamic";

/** GET /api/tips — Gemini ile kişiselleştirilmiş günlük tavsiyeler */
export async function GET(req: NextRequest) {
  try {
    assertGeminiConfigured();
    const userId = getUserIdFromReq(req);
    const [user, txs] = await Promise.all([
      getOrCreateUser(userId),
      listTransactions(userId),
    ]);

    const tips = await generateDailyTipsWithGemini(user, txs);

    return NextResponse.json({ tips, ...getAiMeta() });
  } catch (err) {
    return geminiErrorResponse(err);
  }
}

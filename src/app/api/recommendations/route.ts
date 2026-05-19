import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { getOrCreateUser, listTransactions } from "@/lib/repo";
import { generateRecommendations } from "@/lib/gemini";
import { geminiErrorResponse, getAiMeta } from "@/lib/gemini-required";
import { buildInsights, summarizeFinance } from "@/lib/finance";
import { detectAnomalies } from "@/lib/anomaly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ── Kullanıcı başına 5 dakikalık önbellek ────────────────────── */
type CacheEntry = { data: Record<string, unknown>; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 dakika

export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromReq(req);
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";

    if (!forceRefresh) {
      const cached = cache.get(userId);
      if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json({ ...cached.data, cached: true });
      }
    }

    const user = await getOrCreateUser(userId);
    const txs = await listTransactions(userId);
    const summary = summarizeFinance(txs, user.monthlyBudget);
    const insights = buildInsights(summary, user);
    const anomalies = detectAnomalies(txs);
    const { text: advice, structured } = await generateRecommendations(user, txs);

    const response = {
      advice,
      structured,
      summary,
      insights,
      anomalies,
      user,
      ...getAiMeta(),
    };
    cache.set(userId, {
      data: response as Record<string, unknown>,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return NextResponse.json(response);
  } catch (err) {
    return geminiErrorResponse(err);
  }
}

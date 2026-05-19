import { NextResponse } from "next/server";
import { getKeyPoolStatus, isGeminiEnabled } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Gemini API key yapılandırma durumu (tek GEMINI_API_KEY). */
export async function GET() {
  return NextResponse.json({
    enabled: isGeminiEnabled(),
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    pool: getKeyPoolStatus(),
    timestamp: new Date().toISOString(),
  });
}

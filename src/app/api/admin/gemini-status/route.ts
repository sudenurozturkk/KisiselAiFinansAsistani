import { NextResponse } from "next/server";
import { getKeyPoolStatus, isGeminiEnabled } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Gemini key havuzunun anlık durumunu döndürür.
 * - total: .env.local'de tanımlı toplam key sayısı
 * - alive: 401/403 ile ölmemiş key sayısı
 * - active: anlık kullanıma hazır (cooldown'da olmayan) key sayısı
 * - cooldown: 429/5xx sonrası geçici dinlenmede olan key sayısı
 * - dead: 401/403 sonrası kalıcı devre dışı bırakılmış key sayısı
 */
export async function GET() {
  return NextResponse.json({
    enabled: isGeminiEnabled(),
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    pool: getKeyPoolStatus(),
    timestamp: new Date().toISOString(),
  });
}

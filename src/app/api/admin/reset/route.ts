import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { resetUserData, seedAllIfEmpty } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const { reseed = true } = await req.json().catch(() => ({}));
  await resetUserData(userId);
  if (reseed) await seedAllIfEmpty(userId);
  return NextResponse.json({ ok: true, reseed });
}

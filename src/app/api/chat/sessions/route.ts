import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { createChatSession, listChatSessions } from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const sessions = await listChatSessions(userId);
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  let title = "Yeni Sohbet";
  try {
    const body = await req.json();
    if (body?.title && typeof body.title === "string") {
      title = body.title.trim().slice(0, 80) || "Yeni Sohbet";
    }
  } catch {
    // body opsiyonel
  }
  const session = await createChatSession(userId, title);
  return NextResponse.json({ session }, { status: 201 });
}

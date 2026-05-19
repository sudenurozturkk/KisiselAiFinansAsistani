import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  deleteChatSession,
  getChatSession,
  listMessages,
  updateChatSession,
} from "@/lib/repo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = getUserIdFromReq(req);
  const { id } = await params;
  const session = await getChatSession(userId, id);
  if (!session) {
    return NextResponse.json({ error: "Sohbet bulunamadı" }, { status: 404 });
  }
  const messages = await listMessages(userId, 500, id);
  return NextResponse.json({ session, messages });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = getUserIdFromReq(req);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: { title?: string } = {};
  if (typeof body.title === "string") {
    patch.title = body.title.trim().slice(0, 80) || "Yeni Sohbet";
  }
  const updated = await updateChatSession(userId, id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Sohbet bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ session: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = getUserIdFromReq(req);
  const { id } = await params;
  const ok = await deleteChatSession(userId, id);
  if (!ok) {
    return NextResponse.json({ error: "Sohbet bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

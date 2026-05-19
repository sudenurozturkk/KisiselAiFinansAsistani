import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  addMessage,
  clearMessages,
  createChatSession,
  getChatSession,
  getOrCreateUser,
  listMessages,
  listTransactions,
  updateChatSession,
} from "@/lib/repo";
import { generateChatReply } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** İlk kullanıcı mesajından kısa bir başlık üret */
function deriveTitle(content: string): string {
  const trimmed = content.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 50) return trimmed;
  return trimmed.slice(0, 47) + "…";
}

export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const sessionId = req.nextUrl.searchParams.get("sessionId") ?? undefined;
  const messages = await listMessages(userId, 200, sessionId);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const body = await req.json();
  const { content } = body as { content?: string };
  let sessionId = (body as { sessionId?: string }).sessionId;

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content gerekli" }, { status: 400 });
  }

  // Session yoksa veya bulunamıyorsa otomatik oluştur
  let session = sessionId ? await getChatSession(userId, sessionId) : null;
  if (!session) {
    session = await createChatSession(userId, deriveTitle(content));
    sessionId = session._id;
  } else if (session.title === "Yeni Sohbet") {
    // İlk gerçek mesaj geldiğinde başlığı güncelle
    await updateChatSession(userId, session._id, {
      title: deriveTitle(content),
    });
  }

  const user = await getOrCreateUser(userId);
  const txs = await listTransactions(userId);
  const history = await listMessages(userId, 50, sessionId);

  const userMsg = await addMessage({
    userId,
    sessionId,
    role: "user",
    content,
  });

  const { reply, steps } = await generateChatReply(user, txs, history, content);

  const assistantMsg = await addMessage({
    userId,
    sessionId,
    role: "assistant",
    content: reply,
  });

  return NextResponse.json({
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    agentSteps: steps,
    sessionId,
  });
}

export async function DELETE(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const sessionId = req.nextUrl.searchParams.get("sessionId") ?? undefined;
  await clearMessages(userId, sessionId);
  return NextResponse.json({ ok: true });
}

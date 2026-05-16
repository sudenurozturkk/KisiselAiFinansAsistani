import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import {
  addMessage,
  clearMessages,
  getOrCreateUser,
  listMessages,
  listTransactions,
} from "@/lib/repo";
import { generateChatReply } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const messages = await listMessages(userId);
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const { content } = await req.json();
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content gerekli" }, { status: 400 });
  }

  const user = await getOrCreateUser(userId);
  const txs = await listTransactions(userId);
  const history = await listMessages(userId);

  const userMsg = await addMessage({ userId, role: "user", content });

  // Agentic AI — function calling destekli yanıt üretimi
  const { reply, steps } = await generateChatReply(user, txs, history, content);

  const assistantMsg = await addMessage({
    userId,
    role: "assistant",
    content: reply,
  });

  return NextResponse.json({
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    agentSteps: steps, // Hangi araçları kullandığını frontend'e bildir
  });
}

export async function DELETE(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  await clearMessages(userId);
  return NextResponse.json({ ok: true });
}

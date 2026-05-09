import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { deleteTransaction, updateTransaction } from "@/lib/repo";
import type { Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = getUserIdFromReq(req);
  const { id } = await params;
  const body = await req.json();
  const allowed = ["type", "category", "amount", "note", "date"] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in body) patch[k] = k === "amount" ? Number(body[k]) : body[k];
  }
  const updated = await updateTransaction(
    userId,
    id,
    patch as Partial<Omit<Transaction, "_id" | "userId">>,
  );
  if (!updated)
    return NextResponse.json({ error: "İşlem bulunamadı" }, { status: 404 });
  return NextResponse.json({ transaction: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = getUserIdFromReq(req);
  const { id } = await params;
  const ok = await deleteTransaction(userId, id);
  if (!ok)
    return NextResponse.json({ error: "İşlem bulunamadı" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

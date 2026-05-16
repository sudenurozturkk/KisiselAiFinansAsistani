import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { updateIncome, deleteIncome } from "@/lib/repo";

/** PUT /api/incomes/[id] — Ek gelir güncelle */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = getUserIdFromReq(req);
  const patch = await req.json();

  const updated = await updateIncome(userId, params.id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Gelir kaynağı bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ income: updated });
}

/** DELETE /api/incomes/[id] — Ek gelir sil */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = getUserIdFromReq(req);
  const deleted = await deleteIncome(userId, params.id);

  if (!deleted) {
    return NextResponse.json({ error: "Gelir kaynağı bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { updateAsset, deleteAsset } from "@/lib/repo";

/** PUT /api/assets/[id] — Varlık güncelle */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = getUserIdFromReq(req);
  const patch = await req.json();

  const updated = await updateAsset(userId, params.id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Varlık bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ asset: updated });
}

/** DELETE /api/assets/[id] — Varlık sil */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = getUserIdFromReq(req);
  const deleted = await deleteAsset(userId, params.id);

  if (!deleted) {
    return NextResponse.json({ error: "Varlık bulunamadı." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

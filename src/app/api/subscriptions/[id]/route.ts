import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { updateSubscription, deleteSubscription } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = getUserIdFromReq(req);
  const body = await req.json();
  const updated = await updateSubscription(userId, params.id, body);
  if (!updated) {
    return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ subscription: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = getUserIdFromReq(req);
  const ok = await deleteSubscription(userId, params.id);
  return NextResponse.json({ ok });
}

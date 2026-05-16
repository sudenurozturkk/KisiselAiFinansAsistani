import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { getOrCreateUser, seedAllIfEmpty, updateUser } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const user = await getOrCreateUser(userId);
  await seedAllIfEmpty(userId);
  return NextResponse.json({ user });
}

export async function PUT(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  const body = await req.json();
  const allowed = [
    "name",
    "monthlyIncome",
    "monthlyBudget",
    "savingsGoal",
    "riskTolerance",
    "goals",
  ] as const;
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];
  const user = await updateUser(userId, patch as any);
  return NextResponse.json({ user });
}

import { NextRequest } from "next/server";

export function getUserIdFromReq(req: NextRequest): string {
  const fromHeader = req.headers.get("x-user-id");
  if (fromHeader && fromHeader.length > 0) return fromHeader;
  const fromQuery = req.nextUrl.searchParams.get("userId");
  if (fromQuery) return fromQuery;
  return "anonymous";
}

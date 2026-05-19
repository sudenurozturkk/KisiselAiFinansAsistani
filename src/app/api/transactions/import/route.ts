import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { addTransaction } from "@/lib/repo";
import {
  normalizeImportRow,
  type ImportTransactionInput,
} from "@/lib/transaction-import";

export const dynamic = "force-dynamic";

/**
 * POST /api/transactions/import
 * Toplu işlem içe aktarma (ekstre analizi sonrası).
 */
export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);

  try {
    const body = await req.json();
    const rows = (body as { transactions?: ImportTransactionInput[] })
      .transactions;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: "İçe aktarılacak işlem listesi gerekli." },
        { status: 400 },
      );
    }

    const imported = [];
    const skipped: { index: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const normalized = normalizeImportRow(rows[i]!);
      if (normalized.amount <= 0) {
        skipped.push({ index: i, reason: "Geçersiz tutar" });
        continue;
      }
      const tx = await addTransaction({
        userId,
        type: normalized.type,
        category: normalized.category,
        amount: normalized.amount,
        note: normalized.note,
        date: normalized.date,
      });
      imported.push(tx);
    }

    return NextResponse.json({
      imported: imported.length,
      skipped: skipped.length,
      transactions: imported,
      skippedDetails: skipped,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "İçe aktarma başarısız";
    console.error("[transactions/import]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

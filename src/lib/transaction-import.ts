import { CATEGORIES, type Category } from "./types";

export type ImportTransactionInput = {
  type?: string;
  category?: string;
  amount?: unknown;
  note?: string;
  description?: string;
  date?: unknown;
};

const CATEGORY_MAP: Record<string, Category> = {
  gida: "Gıda",
  gıda: "Gıda",
  market: "Gıda",
  yemek: "Gıda",
  ulasim: "Ulaşım",
  ulaşım: "Ulaşım",
  transport: "Ulaşım",
  kira: "Kira/Fatura",
  fatura: "Kira/Fatura",
  "kira/fatura": "Kira/Fatura",
  eglence: "Eğlence",
  eğlence: "Eğlence",
  alisveris: "Alışveriş",
  alışveriş: "Alışveriş",
  shopping: "Alışveriş",
  saglik: "Sağlık",
  sağlık: "Sağlık",
  egitim: "Eğitim",
  eğitim: "Eğitim",
  yatirim: "Yatırım",
  yatırım: "Yatırım",
  diger: "Diğer",
  diğer: "Diğer",
  other: "Diğer",
};

/** AI veya CSV'den gelen kategoriyi geçerli Category tipine çevirir. */
export function normalizeCategory(input: unknown): Category {
  if (typeof input !== "string" || !input.trim()) return "Diğer";
  const raw = input.trim();
  if (CATEGORIES.includes(raw as Category)) return raw as Category;

  const lower = raw.toLowerCase().replace(/\s+/g, " ");
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];

  for (const cat of CATEGORIES) {
    if (lower.includes(cat.toLowerCase())) return cat;
  }
  return "Diğer";
}

/** Türkçe/İngilizce fiyat string'lerini sayıya çevirir. */
export function normalizeAmount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.abs(value);
  }
  if (typeof value !== "string") return 0;

  let s = value.trim().replace(/[₺TLtl\s]/g, "");
  if (!s) return 0;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // 1.299,99 veya 1,299.99
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }

  const n = parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

/** Tarihi ISO string'e çevirir; geçersizse bugün. */
export function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value !== "string" || !value.trim()) {
    return new Date().toISOString();
  }

  const raw = value.trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  const tr = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (tr) {
    const [, dd, mm, yyyy] = tr;
    const d = new Date(
      `${yyyy}-${mm!.padStart(2, "0")}-${dd!.padStart(2, "0")}T12:00:00.000Z`,
    );
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
}

export function normalizeTransactionType(
  type: unknown,
  amount?: unknown,
): "gelir" | "gider" {
  const t = typeof type === "string" ? type.toLowerCase().trim() : "";
  if (t === "gelir" || t === "income" || t === "credit") return "gelir";
  if (t === "gider" || t === "expense" || t === "debit") return "gider";

  if (typeof amount === "number" && amount < 0) return "gider";
  if (typeof amount === "string" && amount.trim().startsWith("-")) return "gider";
  return "gider";
}

/** Tek satırı içe aktarma için normalize eder. */
export function normalizeImportRow(raw: ImportTransactionInput) {
  const amount = normalizeAmount(raw.amount);
  const type = normalizeTransactionType(raw.type, raw.amount);
  const note =
    (typeof raw.note === "string" && raw.note.trim()) ||
    (typeof raw.description === "string" && raw.description.trim()) ||
    "İçe aktarılan işlem";

  return {
    type,
    category: normalizeCategory(raw.category),
    amount: amount > 0 ? amount : 0,
    note,
    date: normalizeDate(raw.date),
  };
}

export type StatementTransaction = {
  date: string;
  description: string;
  amount: number;
  category: Category;
  type: "gelir" | "gider";
  isInstallment: boolean;
  installmentInfo: string;
};

/** AI ekstre yanıtını güvenli şekilde normalize eder. */
export function normalizeStatementPayload(parsed: Record<string, unknown>) {
  const rawTxs = parsed.transactions;
  const list = Array.isArray(rawTxs)
    ? rawTxs
    : Array.isArray((rawTxs as { items?: unknown })?.items)
      ? (rawTxs as { items: unknown[] }).items
      : [];

  const transactions: StatementTransaction[] = list
    .map((row) => {
      const r = row as ImportTransactionInput & {
        description?: string;
        isInstallment?: boolean;
        installmentInfo?: string;
      };
      const normalized = normalizeImportRow(r);
      if (normalized.amount <= 0) return null;
      return {
        date: normalized.date.slice(0, 10),
        description: normalized.note,
        amount: normalized.amount,
        category: normalized.category,
        type: normalized.type,
        isInstallment: Boolean(r.isInstallment),
        installmentInfo:
          typeof r.installmentInfo === "string" ? r.installmentInfo : "",
      };
    })
    .filter((t): t is StatementTransaction => t !== null);

  const cardInfo =
    (parsed.cardInfo as Record<string, unknown> | undefined) ?? {};
  const summary =
    (parsed.summary as Record<string, unknown> | undefined) ?? {};

  return {
    cardInfo: {
      bankName: String(cardInfo.bankName ?? ""),
      cardLast4: String(cardInfo.cardLast4 ?? ""),
      statementPeriod: String(cardInfo.statementPeriod ?? ""),
      totalAmount: normalizeAmount(cardInfo.totalAmount),
      minimumPayment: normalizeAmount(cardInfo.minimumPayment),
    },
    transactions,
    summary: {
      totalExpense:
        normalizeAmount(summary.totalExpense) ||
        transactions
          .filter((t) => t.type === "gider")
          .reduce((s, t) => s + t.amount, 0),
      transactionCount: transactions.length,
      topCategory: (() => {
        const fromAi = String(summary.topCategory ?? "").trim();
        if (fromAi) return fromAi;
        const byCat = transactions.reduce(
          (acc, t) => {
            acc[t.category] = (acc[t.category] ?? 0) + t.amount;
            return acc;
          },
          {} as Record<string, number>,
        );
        const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
        return top?.[0] ?? "Diğer";
      })(),
    },
    confidence:
      typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
  };
}

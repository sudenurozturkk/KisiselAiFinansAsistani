import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { callGemini, friendlyError, isGeminiEnabled } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const userId = getUserIdFromReq(req);
  void userId;

  try {
    const body = await req.json();
    const { csvText } = body as { csvText: string };

    if (!csvText || csvText.trim().length < 10) {
      return NextResponse.json(
        { error: "CSV verisi gerekli (en az birkaç satır)" },
        { status: 400 },
      );
    }

    const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim());

    if (!isGeminiEnabled()) {
      // Mock fallback: basit ayrıştırma
      const rows = lines.slice(1).map((line) => {
        const parts = line.split(/[,;\t]/).map((s) => s.trim().replace(/^"|"$/g, ""));
        return {
          date: parts[0] || new Date().toISOString().slice(0, 10),
          description: parts[1] || "Bilinmeyen",
          amount: Math.abs(parseFloat(parts[2]?.replace(/[^\d,.-]/g, "").replace(",", ".")) || 0),
          type: (parseFloat(parts[2]?.replace(/[^\d,.-]/g, "").replace(",", ".")) || 0) > 0 ? "gelir" as const : "gider" as const,
          category: "Diğer" as const,
          confidence: 0.5,
          originalLine: line,
        };
      });
      return NextResponse.json({
        rows,
        totalIncome: rows.filter((r) => r.type === "gelir").reduce((s, r) => s + r.amount, 0),
        totalExpense: rows.filter((r) => r.type === "gider").reduce((s, r) => s + r.amount, 0),
        categorySummary: [],
      });
    }

    void lines;
    const prompt = `Aşağıdaki banka ekstresi CSV verisi Türkiye'deki bir banka müşterisine ait.
Her satırı analiz et ve aşağıdaki JSON array formatında döndür. Sadece JSON döndür, başka metin ekleme.

Kategori seçenekleri: Gıda, Ulaşım, Kira/Fatura, Eğlence, Alışveriş, Sağlık, Eğitim, Yatırım, Diğer

CSV VERİSİ:
${csvText.slice(0, 5000)}

JSON formatı:
[
  {
    "date": "YYYY-MM-DD",
    "description": "Açıklama (temizlenmiş)",
    "amount": 150.00,
    "type": "gider",
    "category": "Gıda",
    "confidence": 0.9,
    "originalLine": "orijinal CSV satırı"
  }
]

Kurallar:
- "POS", "HARCAMA" içeren satırlar genelde "gider" dir.
- "MAAŞ", "HAVALE GELEN", "EFT GELEN" içerenler "gelir" dir.
- MIGROS, BIM, A101, ŞOK, CARREFOUR → "Gıda"
- AKARYAKIT, SHELL, BP, OPET, IETT, METRO → "Ulaşım"
- VODAFONE, TURKCELL, ENERJISA, IGDAS, DOGALGAZ → "Kira/Fatura"
- NETFLIX, SPOTIFY, SINEMA → "Eğlence"
- Tanıyamadığın işlemleri "Diğer" yap, confidence düşük ver.
- amount her zaman pozitif olsun, type alanı gelir/gider olarak ayırılsın.`;

    const result = await callGemini(
      (client, modelName) => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
        });
        return model.generateContent(prompt);
      },
      { retries: 3, timeoutMs: 30000, label: "import-csv" },
    );

    if (!result) {
      return NextResponse.json(
        { error: "AI servisi şu an müsait değil. Lütfen birazdan tekrar deneyin." },
        { status: 503 },
      );
    }

    const text = result.response.text();

    let rows;
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      rows = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "CSV analizi başarısız oldu. Farklı bir format deneyin." },
        { status: 422 },
      );
    }

    // Kategori özeti hesapla
    const catMap = new Map<string, { count: number; total: number }>();
    for (const r of rows) {
      const cat = r.category || "Diğer";
      const cur = catMap.get(cat) || { count: 0, total: 0 };
      cur.count++;
      cur.total += r.amount || 0;
      catMap.set(cat, cur);
    }

    return NextResponse.json({
      rows,
      totalIncome: rows.filter((r: { type: string }) => r.type === "gelir").reduce((s: number, r: { amount: number }) => s + r.amount, 0),
      totalExpense: rows.filter((r: { type: string }) => r.type === "gider").reduce((s: number, r: { amount: number }) => s + r.amount, 0),
      categorySummary: [...catMap.entries()].map(([category, d]) => ({ category, ...d })),
    });
  } catch (err: unknown) {
    const msg = friendlyError(err);
    console.error("[import] Hata:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

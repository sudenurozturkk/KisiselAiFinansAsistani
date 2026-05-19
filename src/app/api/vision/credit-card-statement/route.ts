import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { withRetry, friendlyError } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";

/**
 * POST /api/vision/credit-card-statement
 *
 * Kredi kartı ekstresi (görsel veya text) yükle → AI ile satır satır oku → işlem listesi döndür.
 */
export async function POST(req: NextRequest) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY tanımlı değil" },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const { image, mimeType, textContent } = body as {
      image?: string;    // base64
      mimeType?: string;
      textContent?: string; // metin olarak yapıştırma
    };

    if (!image && !textContent) {
      return NextResponse.json(
        { error: "Görüntü (base64) veya metin içeriği gerekli." },
        { status: 400 },
      );
    }

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `Sen bir kredi kartı ekstresi analiz uzmanısın. Aşağıdaki kredi kartı ekstresini dikkatle oku ve tüm harcamaları çıkar.

Her bir harcamayı aşağıdaki JSON formatında döndür. Yalnızca JSON döndür:

{
  "cardInfo": {
    "bankName": "Banka adı (tespit edilebildiyse)",
    "cardLast4": "Kartın son 4 hanesi (tespit edilebildiyse)",
    "statementPeriod": "Ekstre dönemi (tespit edilebildiyse)",
    "totalAmount": 0.00,
    "minimumPayment": 0.00
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "İşlem açıklaması",
      "amount": 0.00,
      "category": "Gıda|Ulaşım|Kira/Fatura|Eğlence|Alışveriş|Sağlık|Eğitim|Yatırım|Diğer",
      "type": "gider",
      "isInstallment": false,
      "installmentInfo": "Taksit bilgisi (varsa, ör: 3/6)"
    }
  ],
  "summary": {
    "totalExpense": 0.00,
    "transactionCount": 0,
    "topCategory": "En çok harcanan kategori",
    "categorySummary": [
      { "category": "Gıda", "total": 0.00, "count": 0 }
    ]
  },
  "confidence": 0.95
}

KURALLAR:
- Tarihleri YYYY-MM-DD formatına çevir.
- Tutarları sayı olarak yaz (string değil).
- Her harcamayı uygun kategoriye ata:
  • Market, restoran, kafe → "Gıda"
  • Akaryakıt, taksi, toplu taşıma → "Ulaşım"
  • Elektrik, su, doğalgaz, internet, telefon → "Kira/Fatura"
  • Sinema, Netflix, Spotify, eğlence → "Eğlence"
  • Giyim, elektronik, online alışveriş → "Alışveriş"
  • Eczane, hastane, doktor → "Sağlık"
  • Kurs, kitap, eğitim → "Eğitim"
  • Diğer her şey → "Diğer"
- Taksitli işlemleri belirt.
- Ödeme ve iade kayıtlarını ayrı tut (type: "gelir").
- Okunamayan kısımlar için confidence düşür.
- Türkçe açıklamalar kullan.`;

    let result;
    if (image) {
      result = await withRetry(() =>
        model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: image,
            },
          },
        ]),
      );
    } else {
      result = await withRetry(() =>
        model.generateContent(`${prompt}\n\nEKSTRE İÇERİĞİ:\n${textContent}`),
      );
    }

    const text = result.response.text();

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          error: "Ekstre okunamadı. Lütfen daha net bir fotoğraf veya metin deneyin.",
          rawText: text.slice(0, 500),
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ statement: parsed });
  } catch (err: unknown) {
    const msg = friendlyError(err);
    console.error("[vision/credit-card-statement] Hata:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

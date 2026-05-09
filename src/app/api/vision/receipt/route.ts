import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { withRetry, friendlyError } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export async function POST(req: NextRequest) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY tanımlı değil" },
      { status: 500 },
    );
  }

  try {
    const body = await req.json();
    const { image, mimeType } = body as {
      image: string; // base64
      mimeType: string;
    };

    if (!image) {
      return NextResponse.json(
        { error: "Görüntü verisi (base64) gerekli" },
        { status: 400 },
      );
    }

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: modelName });

    const prompt = `Bu bir market, restoran veya mağaza fişinin fotoğrafı. Lütfen fişi oku ve aşağıdaki JSON formatında bilgileri çıkar. Yalnızca JSON döndür, başka bir şey ekleme.

{
  "storeName": "Mağaza/restoran adı",
  "date": "YYYY-MM-DD formatında tarih (yoksa bugünün tarihi)",
  "totalAmount": 0.00,
  "category": "Gıda|Ulaşım|Kira/Fatura|Eğlence|Alışveriş|Sağlık|Eğitim|Yatırım|Diğer",
  "items": [
    { "name": "Ürün adı", "quantity": 1, "unitPrice": 0.00, "totalPrice": 0.00 }
  ],
  "currency": "TRY",
  "confidence": 0.95
}

Kurallar:
- category alanı, mağaza ve ürünlere göre en uygun kategoriyi seç.
- Market fişleri → "Gıda", restoran → "Gıda", eczane → "Sağlık", kıyafet → "Alışveriş"
- totalAmount fişin en altındaki TOPLAM tutarı olsun.
- Eğer fiş okunamıyorsa confidence değerini düşük (0.3 altı) ver.
- Türk Lirası ise currency: "TRY".`;

    const result = await withRetry(() => model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: image,
        },
      },
    ]));

    const text = result.response.text();

    let parsed;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Fiş okunamadı. Lütfen daha net bir fotoğraf deneyin." },
        { status: 422 },
      );
    }

    return NextResponse.json({ receipt: parsed });
  } catch (err: unknown) {
    const msg = friendlyError(err);
    console.error("[vision/receipt] Hata:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

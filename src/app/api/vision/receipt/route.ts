import { NextRequest, NextResponse } from "next/server";
import { callGemini, friendlyError, isGeminiEnabled } from "@/lib/gemini";
import { normalizeAmount, normalizeCategory, normalizeDate } from "@/lib/transaction-import";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isGeminiEnabled()) {
    return NextResponse.json(
      { error: "Gemini API key tanımlı değil (.env.local içine GEMINI_API_KEY ekleyin)" },
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

    const prompt = `Sen profesyonel bir fiş/fatura OCR sistemisin. Verilen görüntüyü dikkatle analiz et.

ÖNCELİKLİ TALİMATLAR:
1. Görüntü bulanık, eğik veya düşük kaliteli olabilir — mümkün olan en iyi şekilde oku.
2. Her satırı dikkatlice incele, rakamları doğru çıkar.
3. Türkçe karakterleri (ö, ü, ç, ş, ğ, ı, İ) doğru kullan.
4. KDV, toplam, ara toplam gibi satırları ayırt et.
5. Tarihi bulmaya çalış; bulamazsan bugünün tarihini kullan.

JSON formatında döndür. Yalnızca JSON döndür, başka metin ekleme:

{
  "storeName": "Mağaza/restoran adı (büyük harfle başlasın)",
  "date": "YYYY-MM-DD formatında tarih",
  "totalAmount": 0.00,
  "category": "Gıda|Ulaşım|Kira/Fatura|Eğlence|Alışveriş|Sağlık|Eğitim|Yatırım|Diğer",
  "items": [
    { "name": "Ürün adı", "quantity": 1, "unitPrice": 0.00, "totalPrice": 0.00 }
  ],
  "currency": "TRY",
  "confidence": 0.95,
  "notes": "Ek bilgi veya uyarı (opsiyonel)"
}

KATEGORİ KURALLARI:
- Market (Migros, BİM, A101, CarrefourSA, ŞOK, Macro Center) → "Gıda"
- Restoran, kafe, fast food (McDonald's, Burger King, Starbucks) → "Gıda"
- Akaryakıt (Shell, BP, Opet, Petrol Ofisi) → "Ulaşım"
- Eczane, hastane, optik → "Sağlık"
- Kıyafet, elektronik, Trendyol, Hepsiburada → "Alışveriş"
- Sinema, tiyatro, etkinlik → "Eğlence"
- Elektrik, su, doğalgaz, internet → "Kira/Fatura"
- Kurs, kitapçı, kırtasiye → "Eğitim"

DOĞRULUK KURALLARI:
- totalAmount fişin en altındaki TOPLAM/GENEL TOPLAM tutarı olsun
- items listesi boş olabilir ama totalAmount kesinlikle doğru olmalı
- Eğer fiş hiç okunamıyorsa confidence değerini 0.2 yap
- Kısmen okunabilen fişlerde mümkün olan kadar veri çıkar
- Fiyat formatı: Türkçe (1.299,99) veya İngilizce (1,299.99) olabilir — ikisini de tanı`;

    const result = await callGemini(
      (client, modelName) => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
        });
        return model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType: mimeType || "image/jpeg",
              data: image,
            },
          },
        ]);
      },
      { retries: 3, timeoutMs: 20000, label: "vision-receipt" },
    );

    if (!result) {
      return NextResponse.json(
        { error: "AI servisi şu an müsait değil. Lütfen birazdan tekrar deneyin." },
        { status: 503 },
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
          error: "Fiş okunamadı. Lütfen daha net bir fotoğraf deneyin.",
          hint: "Fişi düz bir zemine koyup, iyi aydınlatılmış ortamda, yakından ve net çekin.",
          rawText: text.slice(0, 300),
        },
        { status: 422 },
      );
    }

    const receipt = {
      ...parsed,
      storeName: String(parsed.storeName ?? "Bilinmeyen"),
      date: normalizeDate(parsed.date).slice(0, 10),
      totalAmount: normalizeAmount(parsed.totalAmount),
      category: normalizeCategory(parsed.category),
      confidence:
        typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
    };

    if (receipt.totalAmount <= 0) {
      return NextResponse.json(
        {
          error: "Fiş tutarı okunamadı. Daha net bir fotoğraf deneyin.",
          receipt,
        },
        { status: 422 },
      );
    }

    if (receipt.confidence < 0.3) {
      return NextResponse.json({
        receipt,
        warning: "Fiş düşük güvenle okundu. Lütfen verileri kontrol edin.",
      });
    }

    return NextResponse.json({ receipt });
  } catch (err: unknown) {
    const msg = friendlyError(err);
    console.error("[vision/receipt] Hata:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

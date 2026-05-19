import { NextResponse } from "next/server";

/** Kullanıcıya gösterilen standart mesaj */
export const GEMINI_REQUIRED_MESSAGE =
  "GEMINI_API_KEY zorunludur. .env.local dosyasına Google AI Studio anahtarını ekleyin (https://aistudio.google.com).";

export class GeminiRequiredError extends Error {
  readonly code = "GEMINI_API_KEY_REQUIRED" as const;

  constructor(message = GEMINI_REQUIRED_MESSAGE) {
    super(message);
    this.name = "GeminiRequiredError";
  }
}

export class GeminiApiError extends Error {
  readonly code = "GEMINI_API_ERROR" as const;

  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GeminiApiError";
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/** Sunucu tarafı AI çağrılarından önce çağırın — key yoksa hata fırlatır. */
export function assertGeminiConfigured(): void {
  if (!isGeminiConfigured()) {
    throw new GeminiRequiredError();
  }
}

export function geminiRequiredResponse() {
  return NextResponse.json(
    {
      error: GEMINI_REQUIRED_MESSAGE,
      code: "GEMINI_API_KEY_REQUIRED",
      aiSource: null,
    },
    { status: 503 },
  );
}

export function geminiErrorResponse(err: unknown) {
  const message =
    err instanceof GeminiRequiredError || err instanceof GeminiApiError
      ? err.message
      : err instanceof Error
        ? err.message
        : GEMINI_REQUIRED_MESSAGE;

  const status =
    err instanceof GeminiRequiredError ? 503 : 502;

  return NextResponse.json(
    {
      error: message,
      code:
        err instanceof GeminiRequiredError
          ? "GEMINI_API_KEY_REQUIRED"
          : "GEMINI_API_ERROR",
      aiSource: null,
    },
    { status },
  );
}

/** API yanıtlarına eklenecek gerçek AI meta verisi */
export function getAiMeta() {
  return {
    aiSource: "gemini" as const,
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    poweredBy: "Google Gemini",
    isMock: false as const,
  };
}

/** Uygulama açılışında eksik key uyarısı */
export function warnIfGeminiMissingOnBoot() {
  if (process.env.NODE_ENV === "test") return;
  if (!isGeminiConfigured()) {
    console.error(
      "\n❌ GEMINI_API_KEY tanımlı değil — tüm AI özellikleri devre dışı.\n" +
        "   .env.local dosyasına anahtar ekleyin: GEMINI_API_KEY=...\n",
    );
  }
}

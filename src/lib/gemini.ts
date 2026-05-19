/**
 * Gemini AI entegrasyonu — Agentic yapı desteğiyle.
 *
 * Zorunlu: GEMINI_API_KEY (.env.local)
 * Sahte/mock yanıt üretilmez; key yoksa veya API hata verirse istisna fırlatılır.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  assertGeminiConfigured,
  GeminiApiError,
  getAiMeta,
  isGeminiConfigured,
} from "@/lib/gemini-required";
import type {
  AgentStep,
  ChatMessage,
  StructuredRecommendation,
  Transaction,
  UserProfile,
} from "./types";
import { summarizeFinance, formatTRY } from "./finance";
import { detectAnomalies } from "./anomaly";
import { runFinanceAgent } from "./agents";

/* ─── Tek API Key ───────────────────────────────────────────── */

function getApiKey(): string {
  return process.env.GEMINI_API_KEY?.trim() ?? "";
}

function getModelName() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

/** Gemini API etkin mi? (GEMINI_API_KEY tanımlı mı) */
export function isGeminiEnabled(): boolean {
  return isGeminiConfigured();
}

export { getAiMeta };

function getClient(): GoogleGenerativeAI | null {
  const key = getApiKey();
  return key ? new GoogleGenerativeAI(key) : null;
}

/** API key durumu (debug / monitoring). */
export function getKeyPoolStatus() {
  const configured = isGeminiEnabled();
  return {
    configured,
    total: configured ? 1 : 0,
    alive: configured ? 1 : 0,
    active: configured ? 1 : 0,
    cooldown: 0,
    dead: 0,
  };
}

/** Verilen ms süresinde tamamlanmayan çağrıyı reddeder. */
export function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label = "gemini",
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`[${label}] timeout after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Rate-limit / sunucu hatası bilinçli retry wrapper.
 *
 * Yakalanan hatalar:
 *  - 429 (rate limit / quota): aktif key'i cooldown'a alır, key rotasyonu
 *  - 503 / 500 / 502 / 504 (sunucu tarafı): exponential backoff ile yeniden dener
 *  - timeout: kısa bekleme + yeniden deneme
 *
 * Varsayılan: 3 retry (toplam 4 deneme), per-attempt 30s timeout.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  perAttemptTimeoutMs = 30000,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await withTimeout(fn(), perAttemptTimeoutMs, "gemini");
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);

      const is429 =
        msg.includes("429") ||
        msg.includes("quota") ||
        msg.includes("Too Many Requests");
      const is5xx =
        msg.includes("503") ||
        msg.includes("500") ||
        msg.includes("502") ||
        msg.includes("504") ||
        msg.includes("Service Unavailable") ||
        msg.includes("Internal Server Error") ||
        msg.includes("Bad Gateway") ||
        msg.includes("Gateway Timeout") ||
        msg.includes("high demand") ||
        msg.includes("overloaded");
      const isTimeout = msg.includes("timeout");
      const isRetryable = is429 || is5xx || isTimeout;

      if (isRetryable && i < retries) {
        const base = is429 ? 1500 : is5xx ? 1000 : 400;
        const waitMs = Math.min(base * Math.pow(2, i), 8000);
        const reason = is429
          ? "Rate limit (429)"
          : is5xx
            ? "Sunucu hatası (5xx)"
            : "Timeout";
        console.warn(
          `[gemini] ${reason} — ${waitMs / 1000}s backoff (deneme ${i + 2}/${retries + 1})`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Retry exhausted");
}

/**
 * Gemini çağrısı — tek API key, 429/5xx/timeout için retry.
 * Key yoksa veya kalıcı hata varsa istisna fırlatır (mock yok).
 */
export async function callGemini<T>(
  task: (
    client: GoogleGenerativeAI,
    modelName: string,
  ) => Promise<T>,
  options: { retries?: number; timeoutMs?: number; label?: string } = {},
): Promise<T> {
  assertGeminiConfigured();
  const client = getClient();
  if (!client) {
    throw new GeminiApiError("Gemini istemcisi oluşturulamadı.");
  }

  const modelName = getModelName();
  const label = options.label ?? "gemini";

  try {
    return await withRetry(
      () => withTimeout(task(client, modelName), options.timeoutMs ?? 30000, label),
      options.retries ?? 3,
      options.timeoutMs ?? 30000,
    );
  } catch (err) {
    const msg = friendlyError(err);
    console.error(`[${label}]`, msg);
    throw new GeminiApiError(msg, err);
  }
}

export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429") || msg.includes("quota")) {
    return "⏳ AI kota limiti aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.";
  }
  if (msg.includes("API_KEY") || msg.includes("401") || msg.includes("403")) {
    return "🔑 API anahtarı geçersiz veya yetkisiz. Lütfen .env.local dosyasını kontrol edin.";
  }
  return `AI hatası: ${msg.slice(0, 200)}`;
}

/* ─── System Prompt ─────────────────────────────────────────── */

export function buildSystemPrompt(user: UserProfile, txs: Transaction[]) {
  const s = summarizeFinance(txs, user.monthlyBudget);
  const anomalies = detectAnomalies(txs);
  const anomalyText =
    anomalies.length > 0
      ? anomalies.map((a) => `  - ${a.message}`).join("\n")
      : "  Anomali tespit edilmedi.";

  return `Sen "Akıllı Finans Asistanı"sın — kişisel finans yönetimi ve e-ticaret konusunda uzmanlaşmış
bir yapay zeka asistanısın. Türkçe, kısa, net ve eyleme yönelik konuşursun.

Kullanıcının kişisel finans verilerini ve hedeflerini bilirsin. Tavsiyelerini her zaman bütçeye, harcama
alışkanlığına ve risk toleransına göre kişiselleştirirsin.

KULLANICI PROFİLİ
- İsim: ${user.name}
- Aylık gelir: ${formatTRY(user.monthlyIncome)}
- Aylık bütçe: ${formatTRY(user.monthlyBudget)}
- Tasarruf hedefi: ${formatTRY(user.savingsGoal)}
- Risk toleransı: ${user.riskTolerance}
- Hedefler: ${(user.goals || []).join(", ") || "—"}

GÜNCEL FİNANS DURUMU (bu ay)
- Toplam gelir: ${formatTRY(s.thisMonth.income)}
- Toplam gider: ${formatTRY(s.thisMonth.expense)}
- Net: ${formatTRY(s.thisMonth.net)}
- Bütçe kullanımı: %${s.thisMonth.budgetUsedPct}
- Tasarruf oranı: %${s.savingsRate}
- Günlük ortalama harcama: ${formatTRY(s.dailyAvg)}
- Ay sonu tahmini: ${formatTRY(s.projectedMonthEnd)}
- En yüksek 3 kategori: ${
    s.topCategories
      .slice(0, 3)
      .map((c) => `${c.category} (${formatTRY(c.amount)})`)
      .join(", ") || "—"
  }

ANOMALİLER
${anomalyText}

SANA VERİLEN ARAÇLAR
Sana çeşitli finansal analiz araçları verildi. Kullanıcının sorusuna en iyi yanıtı verebilmek için
bu araçları kullanabilirsin. Her araç sana güncel ve doğru veri sağlar.

YANIT KURALLARI
- Gerektiğinde madde işaretleri ve markdown formatı kullan.
- Sayısal öneriler ver (örn. "ayda 1.500₺ tasarruf et").
- Alışveriş soruluyorsa: bütçeye etki + taksit önerisi + alternatif düşük maliyetli seçenek sun.
- Asla uydurma rakamlarla kullanıcıyı yanıltma; bilmiyorsan açıkça söyle.
- Yatırım tavsiyelerinde "bu yatırım danışmanlığı değildir, genel bilgidir" uyarısı ekle.
- Finansal okuryazarlık sorularında somut Türkiye örnekleri ve güncel ekonomik bağlam kullan.
- Kısa ve öz ol, gereksiz uzun cümlelerden kaçın.`;
}

/* ─── Agentic Chat Reply ────────────────────────────────────── */

export async function generateChatReply(
  user: UserProfile,
  txs: Transaction[],
  history: ChatMessage[],
  userMessage: string,
): Promise<{ reply: string; steps: AgentStep[] }> {
  assertGeminiConfigured();

  const systemPrompt = buildSystemPrompt(user, txs);
  const historyForAgent = history.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    const result = await callGemini(
      (client, modelName) =>
        runFinanceAgent(
          client,
          modelName,
          systemPrompt,
          historyForAgent,
          userMessage,
          txs,
          user,
        ),
      { retries: 3, timeoutMs: 35000, label: "gemini-agent" },
    );

    return result;
  } catch (err: unknown) {
    if (err instanceof GeminiApiError) throw err;
    throw new GeminiApiError(friendlyError(err), err);
  }
}

/* ─── Structured Recommendations ────────────────────────────── */

export async function generateRecommendations(
  user: UserProfile,
  txs: Transaction[],
): Promise<{ text: string; structured: StructuredRecommendation[] }> {
  const s = summarizeFinance(txs, user.monthlyBudget);
  const anomalies = detectAnomalies(txs);
  const topCats = s.topCategories.slice(0, 5);
  const today = new Date();
  const monthLabel = today.toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });

  const prompt = `Sen kıdemli bir kişisel finans danışmanısın. ${user.name} adlı kullanıcının ${monthLabel} ayı finansal verilerini analiz edip KİŞİYE ÖZEL, SOMUT ve VERİ ODAKLI 5 öneri üreteceksin.

KULLANICI PROFİLİ:
- İsim: ${user.name}
- Aylık gelir: ${formatTRY(user.monthlyIncome)}
- Aylık bütçe: ${formatTRY(user.monthlyBudget)}
- Tasarruf hedefi: ${formatTRY(user.savingsGoal)}/ay
- Risk toleransı: ${user.riskTolerance}
- Hedefler: ${(user.goals || []).join(", ") || "Belirtilmemiş"}

BU AY VERİLERİ:
- Toplam gelir: ${formatTRY(s.thisMonth.income)}
- Toplam gider: ${formatTRY(s.thisMonth.expense)}
- Net: ${formatTRY(s.thisMonth.net)}
- Bütçe kullanımı: %${s.thisMonth.budgetUsedPct}
- Tasarruf oranı: %${s.savingsRate}
- Günlük ort. harcama: ${formatTRY(s.dailyAvg)}
- Ay sonu tahmini: ${formatTRY(s.projectedMonthEnd)}

KATEGORİ DAĞILIMI:
${topCats.map((c) => `- ${c.category}: ${formatTRY(c.amount)} (toplam giderin %${Math.round((c.amount / Math.max(1, s.thisMonth.expense)) * 100)}'i)`).join("\n")}

ANOMALİLER:
${anomalies.length > 0 ? anomalies.map((a) => `- ${a.category}: ${a.message} (z-score: ${a.zScore})`).join("\n") : "Anomali tespit edilmedi."}

ÖNEMLİ KURALLAR:
1. Her öneri MUTLAKA kullanıcının gerçek verilerine dayansın (TL tutarları, yüzdeler, kategori adları)
2. Genel/klişe öneriler YASAK. "Market listesi yap" gibi herkes için geçerli öneriler verme.
3. Kullanıcının AD'ını kullanarak kişisel hitap et.
4. Somut TL miktarları ve yüzdeler kullan.
5. Türkiye ekonomisi bağlamında güncel ve gerçekçi öneriler ver.
6. Her öneri farklı bir "category" olsun.
7. actionItems en az 3, en fazla 5 madde olsun.

5 öneriyi şu JSON formatında döndür:
[
  {
    "category": "tasarruf" | "bütçe" | "yatırım" | "alışveriş",
    "title": "Kısa ama spesifik başlık (kullanıcı verisine dayalı)",
    "description": "2-3 cümle, kullanıcının adını kullanarak, somut verilerle desteklenmiş açıklama",
    "actionItems": ["Somut eylem 1 (TL/yüzde ile)", "Somut eylem 2", "Somut eylem 3"],
    "impact": "Tahmini etki (kesin TL miktarı veya yüzde)",
    "priority": "high" | "medium" | "low"
  }
]`;

  assertGeminiConfigured();

  try {
    const res = await callGemini(
      (client, modelName) => {
        const model = client.getGenerativeModel({
          model: modelName,
          systemInstruction: buildSystemPrompt(user, txs),
          generationConfig: { responseMimeType: "application/json" },
        });
        return model.generateContent(prompt);
      },
      { retries: 3, timeoutMs: 35000, label: "gemini-recommendations" },
    );

    const responseText = res.response.text();
    console.log(
      "[gemini] Recommendations raw response length:",
      responseText.length,
    );

    let structured: StructuredRecommendation[] = [];
    try {
      const parsed = JSON.parse(responseText);
      structured = Array.isArray(parsed)
        ? parsed
        : parsed.recommendations || parsed.data || [];
      // Validate structure
      structured = structured
        .filter(
          (r) => r && r.title && r.description && Array.isArray(r.actionItems),
        )
        .map((r) => ({
          category: ["tasarruf", "bütçe", "yatırım", "alışveriş"].includes(
            r.category,
          )
            ? r.category
            : "tasarruf",
          title: String(r.title).slice(0, 100),
          description: String(r.description).slice(0, 500),
          actionItems: r.actionItems.slice(0, 5).map(String),
          impact: String(r.impact || "Hesaplanıyor").slice(0, 150),
          priority: ["high", "medium", "low"].includes(r.priority)
            ? r.priority
            : "medium",
        }));
    } catch (parseErr) {
      console.error(
        "[gemini] Recommendations JSON parse hatası:",
        parseErr,
        "Raw:",
        responseText.slice(0, 500),
      );
      // Try regex fallback
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) structured = JSON.parse(jsonMatch[0]);
      } catch {
        throw new GeminiApiError(
          "Öneri yanıtı JSON olarak ayrıştırılamadı. Lütfen tekrar deneyin.",
        );
      }
    }

    if (structured.length === 0) {
      throw new GeminiApiError(
        "Gemini geçerli öneri listesi döndürmedi. Lütfen tekrar deneyin.",
      );
    }

    const textVersion = structured
      .map(
        (r, i) =>
          `**${i + 1}. ${r.title}** (${r.category})\n${r.description}\n${r.actionItems.map((a) => `- ${a}`).join("\n")}\n*Etki: ${r.impact}*`,
      )
      .join("\n\n");

    return { text: textVersion || responseText, structured };
  } catch (err: unknown) {
    if (err instanceof GeminiApiError) throw err;
    throw new GeminiApiError(friendlyError(err), err);
  }
}

/* ─── Financial Literacy ────────────────────────────────────── */

export async function generateQuiz(
  topic: string,
  difficulty: string,
): Promise<string> {
  assertGeminiConfigured();

  const prompt = `"${topic}" konusunda "${difficulty}" seviyesinde bir Türkçe finansal okuryazarlık quiz sorusu üret.
Türkiye ekonomisi bağlamında somut örnekler kullan.

JSON formatında döndür (sadece JSON, başka bir şey ekleme):
{
  "question": "Soru metni",
  "options": ["A şıkkı", "B şıkkı", "C şıkkı", "D şıkkı"],
  "correctIndex": 0,
  "explanation": "Doğru cevabın detaylı açıklaması",
  "difficulty": "${difficulty}",
  "topic": "${topic}"
}`;

  try {
    const res = await callGemini(
      (client, modelName) => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
        });
        return model.generateContent(prompt);
      },
      { retries: 3, timeoutMs: 25000, label: "gemini-quiz" },
    );
    return res.response.text();
  } catch (err: unknown) {
    if (err instanceof GeminiApiError) throw err;
    throw new GeminiApiError(friendlyError(err), err);
  }
}

export async function generateScenarioAnalysis(
  scenario: string,
): Promise<string> {
  assertGeminiConfigured();

  const prompt = `Aşağıdaki finansal senaryoyu Türkiye ekonomisi bağlamında analiz et:
"${scenario}"

JSON formatında döndür (sadece JSON):
{
  "scenario": "${scenario}",
  "analysis": "Detaylı analiz",
  "risks": ["Risk 1", "Risk 2"],
  "recommendations": ["Öneri 1", "Öneri 2"],
  "financialImpact": "Finansal etki açıklaması"
}`;

  try {
    const res = await callGemini(
      (client, modelName) => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
        });
        return model.generateContent(prompt);
      },
      { retries: 3, timeoutMs: 25000, label: "gemini-scenario" },
    );
    return res.response.text();
  } catch (err: unknown) {
    if (err instanceof GeminiApiError) throw err;
    throw new GeminiApiError(friendlyError(err), err);
  }
}

export async function explainConcept(
  concept: string,
  level: string,
): Promise<string> {
  assertGeminiConfigured();

  const prompt = `"${concept}" kavramını "${level}" seviyesinde, Türkçe olarak açıkla.
Türkiye ekonomisinden somut örnekler ver.
Markdown formatında, kısa ve öz, anlaşılır bir şekilde yaz.
Güncel veriler ve gerçekçi senaryolar kullan.`;

  try {
    const res = await callGemini(
      (client, modelName) => {
        const model = client.getGenerativeModel({ model: modelName });
        return model.generateContent(prompt);
      },
      { retries: 3, timeoutMs: 25000, label: "gemini-explain" },
    );
    return res.response.text();
  } catch (err: unknown) {
    if (err instanceof GeminiApiError) throw err;
    throw new GeminiApiError(friendlyError(err), err);
  }
}

/* ─── Ürün Analizi (Wishlist Item) ──────────────────────────── */

export interface ProductAnalysisResult {
  verdict: "buy_now" | "wait" | "skip" | "find_alternative";
  summary: string; // 2-3 cümlelik kişiselleştirilmiş yorum
  pros: string[];
  cons: string[];
  alternatives?: string[];
  estimatedPrice?: number; // ürün fiyatı bilinmiyorsa AI tahmini
  affordabilityNote: string; // bütçeye uygun mu
}

/**
 * Ürünü kullanıcının finansal durumuna göre analiz et.
 * Gerçek fiyat ve scrape edilen açıklama varsa kullanır.
 */
export async function analyzeProduct(
  product: {
    name: string;
    description?: string;
    brand?: string;
    siteName?: string;
    price?: number;
    url?: string;
    note?: string;
    urgency?: string;
    category?: string;
  },
  user: UserProfile,
  txs: Transaction[],
): Promise<ProductAnalysisResult> {
  // Mali durum özeti — Gemini olsa da olmasa da kullanılır
  const s = summarizeFinance(txs, user.monthlyBudget);
  const monthlyNet = s.thisMonth.net;
  const remainingBudget = Math.max(0, user.monthlyBudget - s.thisMonth.expense);

  assertGeminiConfigured();

  const prompt = `Sen bir kişisel finans danışmanısın. Bir kullanıcının istek listesindeki ürünü, finansal durumuna göre analiz edeceksin.

KULLANICI PROFİLİ:
- İsim: ${user.name}
- Aylık gelir: ${formatTRY(user.monthlyIncome)}
- Aylık bütçe: ${formatTRY(user.monthlyBudget)}
- Tasarruf hedefi: ${formatTRY(user.savingsGoal)}
- Risk toleransı: ${user.riskTolerance}
- Bu ay net birikim: ${formatTRY(monthlyNet)}
- Bütçeden kalan: ${formatTRY(remainingBudget)}

ÜRÜN BİLGİSİ:
- Ad: ${product.name}
${product.brand ? `- Marka: ${product.brand}` : ""}
${product.siteName ? `- Satıcı: ${product.siteName}` : ""}
${product.price ? `- Fiyat: ${formatTRY(product.price)}` : "- Fiyat bilinmiyor (sen tahmin et)"}
${product.category ? `- Kategori: ${product.category}` : ""}
${product.urgency ? `- Aciliyet: ${product.urgency}` : ""}
${product.description ? `- Açıklama: ${product.description.slice(0, 300)}` : ""}
${product.note ? `- Kullanıcı notu: ${product.note}` : ""}

GÖREVİN:
1. Bu ürünü kullanıcının bütçesine ve hedeflerine göre değerlendir
2. Almasını mı, beklemesini mi, vazgeçmesini mi, yoksa alternatif aramasını mı önerdiğini belirt
3. Türkiye piyasasında benzer ve daha uygun alternatif ürünler/markalar öner (varsa)
4. Fiyat bilinmiyorsa tahmin et (TRY cinsinden, mevcut piyasa fiyatları)

Sadece geçerli JSON döndür, açıklama ekleme. ŞEMA:
{
  "verdict": "buy_now" | "wait" | "skip" | "find_alternative",
  "summary": "2-3 cümle kişiselleştirilmiş yorum (Türkçe, ${user.name}'e hitaben)",
  "pros": ["pro1", "pro2", ...],
  "cons": ["con1", "con2", ...],
  "alternatives": ["alternatif marka/ürün 1", "alternatif 2"],
  "estimatedPrice": fiyat_yoksa_tahmini_sayi_yoksa_null,
  "affordabilityNote": "Bütçeye uygunluk hakkında kısa not"
}`;

  try {
    const res = await callGemini(
      (client, modelName) => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
        });
        return model.generateContent(prompt);
      },
      { retries: 3, timeoutMs: 25000, label: "gemini-product" },
    );
    const text = res.response.text();
    const parsed = JSON.parse(text);
    return {
      verdict: ["buy_now", "wait", "skip", "find_alternative"].includes(
        parsed.verdict,
      )
        ? parsed.verdict
        : "wait",
      summary: String(parsed.summary || "").slice(0, 600),
      pros: Array.isArray(parsed.pros)
        ? parsed.pros.slice(0, 5).map(String)
        : [],
      cons: Array.isArray(parsed.cons)
        ? parsed.cons.slice(0, 5).map(String)
        : [],
      alternatives: Array.isArray(parsed.alternatives)
        ? parsed.alternatives.slice(0, 4).map(String)
        : [],
      estimatedPrice:
        typeof parsed.estimatedPrice === "number" && parsed.estimatedPrice > 0
          ? Math.round(parsed.estimatedPrice)
          : undefined,
      affordabilityNote: String(parsed.affordabilityNote || "").slice(0, 250),
    };
  } catch (err) {
    if (err instanceof GeminiApiError) throw err;
    throw new GeminiApiError(friendlyError(err), err);
  }
}

/* ─── Kapsamlı Finansal Rapor (Markdown) ───────────────────── */

export interface FinancialReportInput {
  user: UserProfile;
  txs: Transaction[];
  extraContext?: string; // Piyasa verisi, portföy özeti vs.
}

/**
 * Kişiye özel, aylık kapsamlı finansal raporu Markdown formatında üretir.
 * Yalnızca Gemini ile üretilir (deterministik sahte rapor yok).
 */
export async function generateFinancialReport(
  input: FinancialReportInput,
): Promise<string> {
  assertGeminiConfigured();
  const { user, txs, extraContext } = input;
  const s = summarizeFinance(txs, user.monthlyBudget);
  const anomalies = detectAnomalies(txs);
  const today = new Date();
  const monthLabel = today.toLocaleDateString("tr-TR", {
    month: "long",
    year: "numeric",
  });

  const baseMarkdown = buildBaseReportMarkdown({
    user,
    s,
    anomalies,
    monthLabel,
    txCount: txs.length,
  });

  const prompt = `Sen kıdemli bir kişisel finans danışmanısın. Aşağıda kullanıcının ${monthLabel} ayına ait finansal verileri var. Bu verileri kullanarak Türkçe, profesyonel, **Markdown formatında** detaylı bir aylık finansal rapor üret.

Rapor şu bölümleri içersin:
1. **Yönetici Özeti** (3-4 cümle, kullanıcıya hitaben)
2. **Finansal Sağlık Skoru** (0-100 arası bir puan ve A/B/C derecesi, gerekçesiyle)
3. **Güçlü Yönler** (madde madde, somut)
4. **Risk ve Endişeler** (madde madde, somut TL veya % ile)
5. **Kategori Analizi** (en yüksek 3 kategori için neden + öneri)
6. **Aksiyon Planı (gelecek 30 gün)** (5-7 net, ölçülebilir adım)
7. **Hedef Takibi** (tasarruf hedefine ne kadar yakın?)
8. **Kapanış** (motive edici tek paragraf)

Aşağıdaki "Veri Özeti" sayısal bloğunu tablo olarak rapora dahil etme — yorum kısmında doğal biçimde geç.

VERİ ÖZETİ:
- Kullanıcı: ${user.name}
- Aylık gelir: ${formatTRY(user.monthlyIncome)} • Bütçe: ${formatTRY(user.monthlyBudget)} • Tasarruf hedefi: ${formatTRY(user.savingsGoal)}
- Risk: ${user.riskTolerance}
- Hedefler: ${(user.goals || []).join(" • ") || "—"}
- Bu ay gelir: ${formatTRY(s.thisMonth.income)} • gider: ${formatTRY(s.thisMonth.expense)} • net: ${formatTRY(s.thisMonth.net)}
- Bütçe kullanımı: %${s.thisMonth.budgetUsedPct} • Tasarruf oranı: %${s.savingsRate}
- Günlük ortalama harcama: ${formatTRY(s.dailyAvg)} • Ay sonu tahmini: ${formatTRY(s.projectedMonthEnd)}
- En yüksek 3 kategori: ${s.topCategories
      .slice(0, 3)
      .map((c) => `${c.category} ${formatTRY(c.amount)}`)
      .join(", ")}
- Anomali sayısı: ${anomalies.length}${anomalies.length ? " — " + anomalies.map((a) => `${a.category} (z=${a.zScore})`).join(", ") : ""}
- Toplam kayıtlı işlem (6 ay): ${txs.length}
${extraContext ? `\n${extraContext}` : ""}

Raporu doğrudan Markdown ile başlat (\`# ${user.name} • ${monthLabel} Finansal Raporu\` başlığıyla). Emoji kullanabilirsin ama abartma. ${user.name}'e ikinci tekil "sen" ile hitap et. Portföy verisi varsa yatırım performansını da yorumla.`;

  try {
    const res = await callGemini(
      (client, modelName) => {
        const model = client.getGenerativeModel({ model: modelName });
        return model.generateContent(prompt);
      },
      { retries: 3, timeoutMs: 35000, label: "gemini-report" },
    );
    const text = res.response.text().trim();
    if (text.length < 200) {
      throw new GeminiApiError(
        "Finansal rapor yanıtı çok kısa geldi. Lütfen tekrar deneyin.",
      );
    }
    return text;
  } catch (err) {
    if (err instanceof GeminiApiError) throw err;
    throw new GeminiApiError(friendlyError(err), err);
  }
}

function buildBaseReportMarkdown(args: {
  user: UserProfile;
  s: ReturnType<typeof summarizeFinance>;
  anomalies: ReturnType<typeof detectAnomalies>;
  monthLabel: string;
  txCount: number;
}): string {
  const { user, s, anomalies, monthLabel, txCount } = args;
  const score = computeHealthScore(user, s);
  const grade =
    score >= 85
      ? "A"
      : score >= 70
        ? "B"
        : score >= 55
          ? "C"
          : score >= 40
            ? "D"
            : "F";
  const top = s.topCategories.slice(0, 3);
  const goalProgress = Math.min(
    100,
    Math.round(
      (Math.max(0, s.thisMonth.net) / Math.max(1, user.savingsGoal)) * 100,
    ),
  );

  const lines: string[] = [];
  lines.push(`# ${user.name} • ${monthLabel} Finansal Raporu`);
  lines.push("");
  lines.push(`> Bu rapor son 6 aylık ${txCount} işleme dayanılarak üretildi.`);
  lines.push("");
  lines.push("## Yönetici Özeti");
  lines.push(
    `Bu ay ${formatTRY(s.thisMonth.income)} gelir, ${formatTRY(s.thisMonth.expense)} gider ile **${formatTRY(s.thisMonth.net)} net** sonuçtasın. Bütçenin %${s.thisMonth.budgetUsedPct}'ini kullandın, tasarruf oranın **%${s.savingsRate}**. Günlük ortalama harcama ${formatTRY(s.dailyAvg)}, ay sonu tahmini ${formatTRY(s.projectedMonthEnd)}.`,
  );
  lines.push("");
  lines.push(`## Finansal Sağlık Skoru: **${score}/100 (${grade})**`);
  lines.push("");
  lines.push("| Bileşen | Puan | Yorum |");
  lines.push("|---|---|---|");
  lines.push(
    `| Bütçe Disiplini | ${Math.max(0, Math.round(100 - s.thisMonth.budgetUsedPct))} | ${s.thisMonth.budgetUsedPct <= 90 ? "Sağlıklı" : "Bütçeyi aşma riski yüksek"} |`,
  );
  lines.push(
    `| Tasarruf Oranı | ${Math.min(100, Math.max(0, s.savingsRate * 5))} | ${s.savingsRate >= 20 ? "Güçlü" : s.savingsRate >= 10 ? "İyi" : "Geliştirilmeli"} |`,
  );
  lines.push(
    `| Harcama İstikrarı | ${anomalies.length === 0 ? 90 : 70 - anomalies.length * 10} | ${anomalies.length === 0 ? "Anomali yok" : `${anomalies.length} anomali tespit edildi`} |`,
  );
  lines.push("");
  lines.push("## Güçlü Yönler");
  if (s.savingsRate >= 15)
    lines.push(`- 💪 Tasarruf oranın %${s.savingsRate} — ortalama üstü.`);
  if (s.thisMonth.budgetUsedPct < 90)
    lines.push(`- ✅ Bütçeni aşmadın (%${s.thisMonth.budgetUsedPct}).`);
  if (anomalies.length === 0)
    lines.push(`- 📊 Bu ay olağandışı harcama paterni gözlenmedi.`);
  if (s.thisMonth.net > 0)
    lines.push(
      `- 🟢 Pozitif net (${formatTRY(s.thisMonth.net)}) — gelir > gider.`,
    );
  if (lines.at(-1) === "## Güçlü Yönler")
    lines.push("- (Bu ay öne çıkan bir güçlü yön bulunamadı.)");
  lines.push("");
  lines.push("## Risk ve Endişeler");
  if (s.thisMonth.budgetUsedPct > 95)
    lines.push(
      `- ⚠️ Bütçe kullanımı %${s.thisMonth.budgetUsedPct} — sınırı aşmak üzeresin.`,
    );
  if (s.savingsRate < 10)
    lines.push(
      `- ⚠️ Tasarruf oranı düşük (%${s.savingsRate}). Hedef en az %15.`,
    );
  for (const a of anomalies) lines.push(`- ⚠️ **${a.category}**: ${a.message}`);
  if (s.projectedMonthEnd < 0)
    lines.push(
      `- 🔴 Ay sonu net tahmini negatif (${formatTRY(s.projectedMonthEnd)}).`,
    );
  if (lines.at(-1) === "## Risk ve Endişeler")
    lines.push("- ✅ Önemli bir risk gözlenmedi.");
  lines.push("");
  lines.push("## Kategori Analizi");
  for (const c of top) {
    const pct = Math.round((c.amount / Math.max(1, s.thisMonth.expense)) * 100);
    lines.push(
      `- **${c.category}** — ${formatTRY(c.amount)} (toplam giderin %${pct}'i). ${pct > 35 ? "Bu kategori bütçende ağırlıklı; %10 azaltırsan ~" + formatTRY(Math.round(c.amount * 0.1)) + " tasarruf." : "Makul seviyede."}`,
    );
  }
  lines.push("");
  lines.push("## Aksiyon Planı (Gelecek 30 Gün)");
  lines.push(
    `1. ${formatTRY(Math.round(user.savingsGoal / 4))} haftalık otomatik tasarruf transferi kur.`,
  );
  if (top[0])
    lines.push(
      `2. **${top[0].category}** kategorisinde haftalık limit belirle: ${formatTRY(Math.round((top[0].amount * 0.85) / 4))}.`,
    );
  lines.push(
    `3. Aboneliklerini gözden geçir; aktif kullanmadıklarını iptal et.`,
  );
  lines.push(`4. Büyük alışverişlerde 48 saatlik bekleme kuralını uygula.`);
  lines.push(
    `5. Risk toleransın "${user.riskTolerance}" — ${user.riskTolerance === "yüksek" ? "fon/hisse" : user.riskTolerance === "orta" ? "karma fon" : "vadeli mevduat"} için aylık ${formatTRY(Math.round(user.monthlyIncome * 0.1))} ayır (yatırım tavsiyesi değildir).`,
  );
  lines.push(`6. Ay sonunda bu raporu yeniden üret ve karşılaştır.`);
  lines.push("");
  lines.push("## Hedef Takibi");
  lines.push(
    `- Tasarruf hedefi: ${formatTRY(user.savingsGoal)}/ay — bu ay net: ${formatTRY(s.thisMonth.net)} (**%${goalProgress}** ilerleme).`,
  );
  if ((user.goals || []).length)
    lines.push(`- Kişisel hedeflerin: ${user.goals.join(", ")}`);
  lines.push("");
  lines.push("## Kapanış");
  lines.push(
    score >= 70
      ? `${user.name}, finansal disiplinin oldukça iyi. Mevcut alışkanlıkları sürdür ve küçük optimizasyonlarla skoru daha da yükselt.`
      : `${user.name}, atılacak birkaç küçük adım skorunu hızla yukarı taşıyabilir. Yukarıdaki aksiyon planını birer birer uygulamayı dene — bir sonraki ay raporunda farkı göreceksin.`,
  );
  return lines.join("\n");
}

function computeHealthScore(
  user: UserProfile,
  s: ReturnType<typeof summarizeFinance>,
): number {
  const budgetScore = Math.max(0, 100 - s.thisMonth.budgetUsedPct);
  const savingsScore = Math.min(100, Math.max(0, s.savingsRate * 5));
  const netScore =
    s.thisMonth.net >= 0
      ? Math.min(100, (s.thisMonth.net / Math.max(1, user.savingsGoal)) * 100)
      : 0;
  const overall = Math.round(
    budgetScore * 0.35 + savingsScore * 0.4 + netScore * 0.25,
  );
  return Math.max(0, Math.min(100, overall));
}

/* ─── Günlük AI Tavsiyeleri ─────────────────────────────────── */

export interface DailyTipAi {
  id: string;
  emoji: string;
  title: string;
  description: string;
  category: "saving" | "spending" | "investing" | "behavioral" | "goal";
}

export async function generateDailyTipsWithGemini(
  user: UserProfile,
  txs: Transaction[],
): Promise<DailyTipAi[]> {
  assertGeminiConfigured();
  const s = summarizeFinance(txs, user.monthlyBudget);

  const prompt = `Sen kişisel finans koçusun. ${user.name} için bugüne özel 4 kısa Türkçe tavsiye üret.
Gelir: ${formatTRY(user.monthlyIncome)}, bütçe: ${formatTRY(user.monthlyBudget)}, bu ay gider: ${formatTRY(s.thisMonth.expense)}, net: ${formatTRY(s.thisMonth.net)}.
En yüksek kategori: ${s.topCategories[0]?.category ?? "—"}.

Sadece JSON array döndür:
[{"id":"tip-1","emoji":"💰","title":"...","description":"...","category":"saving|spending|investing|behavioral|goal"}]`;

  const res = await callGemini(
    (client, modelName) => {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" },
      });
      return model.generateContent(prompt);
    },
    { retries: 2, timeoutMs: 25000, label: "daily-tips" },
  );

  const text = res.response.text();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new GeminiApiError("Günlük tavsiyeler üretilemedi.");
  }
  return parsed.slice(0, 5).map((t: DailyTipAi, i: number) => ({
    id: String(t.id ?? `tip-${i + 1}`),
    emoji: String(t.emoji ?? "💡").slice(0, 4),
    title: String(t.title ?? "").slice(0, 120),
    description: String(t.description ?? "").slice(0, 400),
    category: ["saving", "spending", "investing", "behavioral", "goal"].includes(
      t.category,
    )
      ? t.category
      : "saving",
  }));
}

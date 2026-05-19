/**
 * Gemini AI entegrasyonu — Agentic yapı desteğiyle.
 *
 * Gemini API varsa: Function calling destekli agentic chat
 * Gemini API yoksa: Mock fallback yanıtlar (UI tamamen çalışır)
 *
 * Çoklu API Key Desteği:
 * .env.local'e GEMINI_API_KEY_1 ~ GEMINI_API_KEY_5 tanımlayarak
 * kota aşımında otomatik key rotasyonu sağlanır.
 * Geriye uyumlu: Tek GEMINI_API_KEY de desteklenir.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
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

/* ─── Multi-Key Rotasyon Sistemi ───────────────────────────── */

/** Tüm geçerli API key'lerini topla (boş olmayanlar). */
function collectApiKeys(): string[] {
  const keys: string[] = [];
  // Numaralı key'ler: GEMINI_API_KEY_1 ~ GEMINI_API_KEY_5
  for (let i = 1; i <= 5; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`]?.trim();
    if (k) keys.push(k);
  }
  // Geriye uyumluluk: tek GEMINI_API_KEY varsa ve listede yoksa ekle
  const legacy = process.env.GEMINI_API_KEY?.trim();
  if (legacy && !keys.includes(legacy)) keys.push(legacy);
  return keys;
}

/** Round-robin sayacı (sunucu ömrü boyunca). */
let keyIndex = 0;

/** Cooldown takibi — 429/5xx alan key'ler geçici olarak devre dışı. */
const keyCooldowns = new Map<string, number>(); // key → Date.now() + ms

/**
 * Kalıcı olarak devre dışı bırakılmış (geçersiz / yetkisiz) key'ler.
 * 401/403 alan key'ler buraya eklenir ve süreç boyunca bir daha denenmez.
 */
const deadKeys = new Set<string>();

/** Bir sonraki kullanılabilir key'i al (round-robin + cooldown + dead filtreli). */
function getNextApiKey(): string {
  const allKeys = collectApiKeys();
  const keys = allKeys.filter((k) => !deadKeys.has(k));
  if (keys.length === 0) return "";

  const now = Date.now();
  for (const [k, until] of keyCooldowns) {
    if (until <= now) keyCooldowns.delete(k);
  }

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (keyIndex + attempt) % keys.length;
    const key = keys[idx]!;
    const cooldownUntil = keyCooldowns.get(key) ?? 0;
    if (cooldownUntil <= now) {
      keyIndex = (idx + 1) % keys.length;
      return key;
    }
  }

  let bestKey = keys[0]!;
  let bestTime = Infinity;
  for (const key of keys) {
    const until = keyCooldowns.get(key) ?? 0;
    if (until < bestTime) {
      bestTime = until;
      bestKey = key;
    }
  }
  return bestKey;
}

/** 429/5xx alan key'i geçici olarak devre dışı bırak. */
function markKeyRateLimited(key: string, cooldownMs = 15_000) {
  keyCooldowns.set(key, Date.now() + cooldownMs);
  const totalCount = collectApiKeys().length;
  const aliveCount = totalCount - deadKeys.size;
  console.warn(
    `[gemini] Key ...${key.slice(-6)} cooldown ${cooldownMs / 1000}s. ` +
      `(canlı ${aliveCount}/${totalCount})`,
  );
}

/** 401/403 alan key'i kalıcı olarak devre dışı bırak. */
function markKeyDead(key: string, reason: string) {
  if (deadKeys.has(key)) return;
  deadKeys.add(key);
  const totalCount = collectApiKeys().length;
  const aliveCount = totalCount - deadKeys.size;
  console.error(
    `[gemini] Key ...${key.slice(-6)} KALICI olarak devre dışı (${reason}). ` +
      `(canlı ${aliveCount}/${totalCount})`,
  );
}

function getModelName() {
  return process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

/** Gemini API etkin mi? (en az 1 key var mı) */
export function isGeminiEnabled(): boolean {
  return collectApiKeys().length > 0;
}
// Geriye uyumluluk: modül yüklendiğinde boolean gibi çalışması gerekiyorsa
// export const isGeminiEnabled = ... yerine fonksiyon kullanıyoruz.

function getClient(): GoogleGenerativeAI | null {
  const key = getNextApiKey();
  return key ? new GoogleGenerativeAI(key) : null;
}

/** Mevcut key havuzu durumu (debug / monitoring). */
export function getKeyPoolStatus() {
  const keys = collectApiKeys();
  const now = Date.now();
  const dead = keys.filter((k) => deadKeys.has(k)).length;
  const alive = keys.filter((k) => !deadKeys.has(k));
  const active = alive.filter((k) => (keyCooldowns.get(k) ?? 0) <= now).length;
  const cooldown = alive.length - active;
  return {
    total: keys.length,
    alive: alive.length,
    active,
    cooldown,
    dead,
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

      if (is429) {
        const currentKey = getNextApiKey();
        if (currentKey) markKeyRateLimited(currentKey);
      }

      if (isRetryable && i < retries) {
        const base = is429 ? 1500 : is5xx ? 1000 : 400;
        const waitMs = Math.min(base * Math.pow(2, i), 8000);
        const reason = is429
          ? "Rate limit (429)"
          : is5xx
            ? "Sunucu hatası (5xx)"
            : "Timeout";
        console.warn(
          `[gemini] ${reason} — ${waitMs / 1000}s backoff, key rotasyonu (deneme ${i + 2}/${retries + 1})`,
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
 * Gemini çağrısı için akıllı wrapper:
 *  - Her denemede yeni `getClient()` (key rotation otomatik)
 *  - 429/5xx/timeout için exponential backoff retry
 *  - Tüm key'ler tükenirse null döner (caller mock fallback'e geçer)
 */
export async function callGemini<T>(
  task: (
    client: GoogleGenerativeAI,
    modelName: string,
  ) => Promise<T>,
  options: { retries?: number; timeoutMs?: number; label?: string } = {},
): Promise<T | null> {
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 30000;
  const label = options.label ?? "gemini";

  if (collectApiKeys().length === 0) return null;

  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    const usedKey = getNextApiKey();
    if (!usedKey) {
      console.error(`[${label}] Kullanılabilir key kalmadı (hepsi ölü).`);
      return null;
    }
    const client = new GoogleGenerativeAI(usedKey);
    const modelName = getModelName();
    try {
      return await withTimeout(task(client, modelName), timeoutMs, label);
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);

      const is401_403 =
        msg.includes("401") ||
        msg.includes("403") ||
        msg.includes("API_KEY_INVALID") ||
        msg.includes("PERMISSION_DENIED") ||
        msg.includes("denied access") ||
        msg.includes("Forbidden") ||
        msg.includes("Unauthorized");
      const is429 =
        !is401_403 &&
        (msg.includes("429") ||
          msg.includes("quota") ||
          msg.includes("Too Many Requests"));
      const is5xx =
        !is401_403 &&
        (msg.includes("503") ||
          msg.includes("500") ||
          msg.includes("502") ||
          msg.includes("504") ||
          msg.includes("Service Unavailable") ||
          msg.includes("Internal Server Error") ||
          msg.includes("Bad Gateway") ||
          msg.includes("Gateway Timeout") ||
          msg.includes("high demand") ||
          msg.includes("overloaded"));
      const isTimeout = msg.includes("timeout");

      // 401/403 → key kalıcı olarak öldür, hemen başka key dene
      if (is401_403) {
        markKeyDead(
          usedKey,
          msg.includes("403") || msg.includes("denied")
            ? "403 Forbidden"
            : "401 Unauthorized",
        );
      } else if (is429) {
        markKeyRateLimited(usedKey, 60_000);
      } else if (is5xx) {
        markKeyRateLimited(usedKey, 8_000);
      }

      const isRetryable = is401_403 || is429 || is5xx || isTimeout;

      if (isRetryable && i < retries) {
        // 401/403 ve 5xx için hemen başka key dene — kullanıcıyı bekletme
        const base = is429 ? 1500 : is401_403 ? 0 : is5xx ? 500 : 400;
        const waitMs = base === 0 ? 0 : Math.min(base * Math.pow(2, i), 8000);
        const reason = is401_403
          ? "Yetkisiz (401/403)"
          : is429
            ? "Rate limit (429)"
            : is5xx
              ? "Sunucu hatası (5xx)"
              : "Timeout";
        console.warn(
          `[${label}] ${reason} → ${waitMs}ms backoff, farklı key (deneme ${i + 2}/${retries + 1})`,
        );
        if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Retry exhausted");
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
  if (!isGeminiEnabled()) {
    const reply = mockReply(user, txs, userMessage);
    return { reply, steps: [{ type: "response", content: reply }] };
  }

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

    if (!result) {
      const reply = mockReply(user, txs, userMessage);
      return { reply, steps: [{ type: "response", content: reply }] };
    }
    return result;
  } catch (err: unknown) {
    const errMsg = friendlyError(err);
    console.error("[gemini-agent] HATA:", errMsg);
    return { reply: errMsg, steps: [{ type: "response", content: errMsg }] };
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

  if (!isGeminiEnabled()) {
    return {
      text: mockReply(user, txs, prompt),
      structured: mockStructuredRecommendations(user, txs),
    };
  }

  try {
    console.log(
      "[gemini] Recommendations: gerçek Gemini API kullanılıyor, model:",
      getModelName(),
    );

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

    if (!res) {
      return {
        text: mockReply(user, txs, prompt),
        structured: mockStructuredRecommendations(user, txs),
      };
    }
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
        structured = mockStructuredRecommendations(user, txs);
      }
    }

    if (structured.length === 0) {
      console.warn("[gemini] Recommendations boş döndü, mock kullanılıyor");
      structured = mockStructuredRecommendations(user, txs);
    }

    const textVersion = structured
      .map(
        (r, i) =>
          `**${i + 1}. ${r.title}** (${r.category})\n${r.description}\n${r.actionItems.map((a) => `- ${a}`).join("\n")}\n*Etki: ${r.impact}*`,
      )
      .join("\n\n");

    return { text: textVersion || responseText, structured };
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const errMsg = friendlyError(err);
    console.error("[gemini] Recommendations HATA raw:", rawMsg.slice(0, 300));
    console.error("[gemini] Recommendations HATA:", errMsg);
    return {
      text: errMsg,
      structured: mockStructuredRecommendations(user, txs),
    };
  }
}

/* ─── Financial Literacy ────────────────────────────────────── */

export async function generateQuiz(
  topic: string,
  difficulty: string,
): Promise<string> {
  if (!isGeminiEnabled()) {
    return JSON.stringify(mockQuiz(topic));
  }

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
    if (!res) return JSON.stringify(mockQuiz(topic));
    return res.response.text();
  } catch (err: unknown) {
    console.error("[gemini] Quiz HATA:", err);
    return JSON.stringify(mockQuiz(topic));
  }
}

export async function generateScenarioAnalysis(
  scenario: string,
): Promise<string> {
  const fallback = JSON.stringify({
    scenario,
    analysis: "Bu senaryo detaylı bir finansal değerlendirme gerektirir.",
    risks: ["Faiz maliyeti artabilir", "Nakit akışı darlaşabilir"],
    recommendations: [
      "Asgari ödemeyle yetinmek yerine mümkün olduğunca fazla ödeme yap",
      "Kart borcu yoksa kredi kartını sadece nakit akışı aracı olarak kullan",
    ],
    financialImpact:
      "Asgari ödeme yapıldığında kalan borç üzerine aylık ~%3-4 faiz uygulanır.",
  });

  if (!isGeminiEnabled()) return fallback;

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
    if (!res) return fallback;
    return res.response.text();
  } catch (err: unknown) {
    console.error("[gemini] Scenario HATA:", err);
    return JSON.stringify({
      scenario,
      analysis: `Analiz şu an yapılamadı: ${friendlyError(err)}`,
      risks: [],
      recommendations: [],
      financialImpact: "",
    });
  }
}

export async function explainConcept(
  concept: string,
  level: string,
): Promise<string> {
  if (!isGeminiEnabled()) {
    return `**${concept}** kavramı hakkında bilgi:\n\nBu kavram finansal okuryazarlığın temel taşlarından biridir. (Mock yanıt — GEMINI_API_KEY eklenince gerçek açıklama üretilir.)`;
  }

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
    if (!res) {
      return `**${concept}** kavramı hakkında bilgi üretilemedi (AI servisi şu an müsait değil). Birazdan tekrar deneyin.`;
    }
    return res.response.text();
  } catch (err: unknown) {
    console.error("[gemini] Explain HATA:", err);
    return `**${concept}** kavramı hakkında bilgi şu an üretilemedi: ${friendlyError(err)}`;
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

  if (!isGeminiEnabled()) {
    return mockProductAnalysis(product, user, monthlyNet, remainingBudget);
  }

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
    if (!res) {
      return mockProductAnalysis(product, user, monthlyNet, remainingBudget);
    }
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
    console.error("[gemini] analyzeProduct HATA:", err);
    return mockProductAnalysis(product, user, monthlyNet, remainingBudget);
  }
}

function mockProductAnalysis(
  product: {
    name: string;
    price?: number;
    urgency?: string;
    category?: string;
  },
  user: UserProfile,
  monthlyNet: number,
  remainingBudget: number,
): ProductAnalysisResult {
  const price = product.price ?? 0;
  const isExpensive = price > user.monthlyIncome * 0.2;
  const fitsBudget = price > 0 && price <= remainingBudget;
  const isUrgent = product.urgency === "acil" || product.urgency === "ihtiyaç";

  let verdict: ProductAnalysisResult["verdict"] = "wait";
  if (isUrgent && fitsBudget) verdict = "buy_now";
  else if (isExpensive && monthlyNet < user.savingsGoal / 2) verdict = "wait";
  else if (price > monthlyNet * 2) verdict = "find_alternative";
  else if (!isUrgent && product.urgency === "hobi" && isExpensive)
    verdict = "skip";

  const summary =
    verdict === "buy_now"
      ? `${user.name}, "${product.name}" senin için uygun bir alım. Aciliyet yüksek ve bütçen el veriyor.`
      : verdict === "wait"
        ? `${user.name}, "${product.name}" güzel bir seçim ama bu ay bütçen sınırlı. Önümüzdeki aya planlaman daha sağlıklı olur.`
        : verdict === "find_alternative"
          ? `${user.name}, "${product.name}" şu fiyata bütçeni sıkıştırır. Daha uygun fiyatlı bir alternatif araştırmanı öneririm.`
          : `${user.name}, bu ürün hobi/lüks kategorisinde ve bütçene yüklük getirir. Tasarruf hedefini düşününce vazgeçmen daha akıllı olabilir.`;

  return {
    verdict,
    summary,
    pros:
      price > 0
        ? [
            `Aylık gelirinin %${Math.round((price / user.monthlyIncome) * 100)}'i`,
          ]
        : ["Fiyat bilgisi gerekiyor"],
    cons:
      price > remainingBudget
        ? [`Bu ay kalan bütçeyi (${formatTRY(remainingBudget)}) aşıyor`]
        : [],
    alternatives: [],
    estimatedPrice:
      price > 0 ? undefined : Math.round(user.monthlyIncome * 0.05),
    affordabilityNote: fitsBudget
      ? `Bu ay kalan bütçen (${formatTRY(remainingBudget)}) yeterli.`
      : `Bu ay kalan bütçen ${formatTRY(remainingBudget)}. ${price > 0 ? `Ürün fiyatı (${formatTRY(price)}) bunu aşıyor.` : ""}`,
  };
}

/* ─── Kapsamlı Finansal Rapor (Markdown) ───────────────────── */

export interface FinancialReportInput {
  user: UserProfile;
  txs: Transaction[];
  extraContext?: string; // Piyasa verisi, portföy özeti vs.
}

/**
 * Kişiye özel, aylık kapsamlı finansal raporu Markdown formatında üretir.
 * Gemini varsa: AI ile zenginleştirilmiş yorum + öneri.
 * Yoksa: deterministik istatistik tabanlı rapor (her durumda yararlı).
 */
export async function generateFinancialReport(
  input: FinancialReportInput,
): Promise<string> {
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

  if (!isGeminiEnabled()) return baseMarkdown;

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
    if (!res) return baseMarkdown;
    const text = res.response.text().trim();
    if (text.length < 200) return baseMarkdown;
    return text;
  } catch (err) {
    console.warn(
      "[gemini] generateFinancialReport fallback:",
      friendlyError(err),
    );
    return baseMarkdown;
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

/* ─── Mock Fallbacks ────────────────────────────────────────── */

function mockReply(user: UserProfile, txs: Transaction[], userMessage: string) {
  const s = summarizeFinance(txs, user.monthlyBudget);
  const top = s.topCategories[0]?.category || "Alışveriş";
  return [
    `Merhaba ${user.name}! (Mock yanıt — GEMINI_API_KEY eklenince gerçek AI modele geçer.)`,
    ``,
    `**Sorunla ilgili özet:** "${userMessage.slice(0, 120)}"`,
    ``,
    `**Bu ayki durum:** Gelir ${formatTRY(s.thisMonth.income)}, Gider ${formatTRY(s.thisMonth.expense)}, Net ${formatTRY(s.thisMonth.net)} — bütçe kullanımı %${s.thisMonth.budgetUsedPct}.`,
    ``,
    `**Öneriler:**`,
    `- En yüksek harcama kategorisi **${top}**. Bu ay %15 azaltırsan ~${formatTRY(Math.round((s.topCategories[0]?.amount || 0) * 0.15))} tasarruf edersin.`,
    `- ${formatTRY(user.savingsGoal)} tasarruf hedefin için günlük ortalama ${formatTRY(Math.round(user.savingsGoal / 30))} ayır.`,
    `- Büyük alışverişlerde 3 taksit + nakit indirim karşılaştırması yap; toplam maliyeti gör.`,
    `- Risk toleransın "${user.riskTolerance}" — düşük riskli mevduat/fon için aylık ${formatTRY(Math.max(500, Math.round(user.monthlyIncome * 0.1)))} ayırabilirsin (yatırım tavsiyesi değildir).`,
  ].join("\n");
}

function mockStructuredRecommendations(
  user: UserProfile,
  txs: Transaction[],
): StructuredRecommendation[] {
  const s = summarizeFinance(txs, user.monthlyBudget);
  const top3 = s.topCategories.slice(0, 3);
  const anomalies = detectAnomalies(txs);
  const today = new Date();
  const budgetOver = s.thisMonth.budgetUsedPct > 100;
  const savingsLow = s.savingsRate < 15;
  const monthlyNet = s.thisMonth.net;
  const results: StructuredRecommendation[] = [];

  // 1. En yüksek harcama kategorisine özel
  if (top3[0]) {
    const cat = top3[0];
    const pct = Math.round(
      (cat.amount / Math.max(1, s.thisMonth.expense)) * 100,
    );
    const saving10 = Math.round(cat.amount * 0.1);
    const saving20 = Math.round(cat.amount * 0.2);
    results.push({
      category: "tasarruf",
      title: `${cat.category} Harcamanı ${formatTRY(saving10)} Azalt`,
      description: `${user.name}, ${cat.category} kategorisi toplam giderinin %${pct}'ini oluşturuyor (${formatTRY(cat.amount)}). Bu kategoride %10-20 azaltma ile ayda ${formatTRY(saving10)}-${formatTRY(saving20)} tasarruf edebilirsin.`,
      actionItems: [
        `${cat.category} harcamana haftalık ${formatTRY(Math.round((cat.amount * 0.9) / 4))} limit koy`,
        `Son 3 aydaki ${cat.category} harcamalarını karşılaştır`,
        `Alternatif/daha uygun seçenekleri araştır`,
        `Her harcama öncesi "gerçekten ihtiyacım var mı" sor`,
      ],
      impact: `Aylık ${formatTRY(saving10)}-${formatTRY(saving20)} tasarruf potansiyeli`,
      priority: "high",
    });
  }

  // 2. Bütçe durumuna özel
  if (budgetOver) {
    const overAmount = s.thisMonth.expense - user.monthlyBudget;
    results.push({
      category: "bütçe",
      title: `Bütçeni ${formatTRY(overAmount)} Aştın — Acil Müdahale`,
      description: `${user.name}, bu ay bütçeni %${s.thisMonth.budgetUsedPct - 100} aştın (${formatTRY(overAmount)} fazla). Ay sonuna kadar günlük harcamanı ${formatTRY(Math.round(Math.max(0, user.monthlyBudget - s.thisMonth.expense) / Math.max(1, 30 - today.getDate())))} altına çekmelisin.`,
      actionItems: [
        `Kalan ${30 - new Date().getDate()} gün için günlük ${formatTRY(Math.max(0, Math.round((user.monthlyBudget - s.thisMonth.expense) / Math.max(1, 30 - new Date().getDate()))))} bütçe uygula`,
        "Zorunlu olmayan harcamaları ay sonuna kadar durdur",
        `${top3[0]?.category || "En yüksek kategori"} harcamalarını gözden geçir`,
        "Otomatik bütçe uyarısı kur",
      ],
      impact: `${formatTRY(overAmount)} bütçe açığını kapatma`,
      priority: "high",
    });
  } else {
    const remaining = user.monthlyBudget - s.thisMonth.expense;
    results.push({
      category: "bütçe",
      title: `Kalan ${formatTRY(remaining)} Bütçeni Akıllıca Kullan`,
      description: `${user.name}, bütçenden ${formatTRY(remaining)} kaldı (%${100 - s.thisMonth.budgetUsedPct}). Bu tutarın bir kısmını tasarrufa, bir kısmını da yatırıma yönlendir.`,
      actionItems: [
        `${formatTRY(Math.round(remaining * 0.5))}'sini tasarruf hesabına aktar`,
        `${formatTRY(Math.round(remaining * 0.3))}'sini yatırım için ayır`,
        `Kalan ${formatTRY(Math.round(remaining * 0.2))}'sini esnek harcama olarak tut`,
      ],
      impact: `${formatTRY(Math.round(remaining * 0.5))} ek tasarruf`,
      priority: "medium",
    });
  }

  // 3. Yatırım — risk toleransına özel
  const investAmount = Math.round(Math.max(0, monthlyNet) * 0.3);
  const riskMap = {
    düşük: { tip: "vadeli mevduat veya devlet tahvili", returnRange: "%25-35" },
    orta: { tip: "karma yatırım fonu veya altın", returnRange: "%30-50" },
    yüksek: { tip: "hisse senedi veya kripto", returnRange: "%40-80+" },
  };
  const riskInfo = riskMap[user.riskTolerance] || riskMap.orta;
  results.push({
    category: "yatırım",
    title: `Aylık ${formatTRY(investAmount)} Yatırım Planı`,
    description: `${user.name}, net gelirinin (${formatTRY(monthlyNet)}) %30'unu (${formatTRY(investAmount)}) yatırıma yönlendirebilirsin. Risk toleransın "${user.riskTolerance}" — ${riskInfo.tip} uygun olabilir. (Yatırım tavsiyesi değildir.)`,
    actionItems: [
      `Her ay ${formatTRY(investAmount)} otomatik yatırım talimatı ver`,
      `${riskInfo.tip} araştır`,
      `Acil durum fonu: ${formatTRY(s.thisMonth.expense * 3)} hedefle (3 aylık gider)`,
      "Yatırımlarını çeşitlendir, tek enstrümana yükleme",
    ],
    impact: `Yıllık ${riskInfo.returnRange} potansiyel getiri`,
    priority: monthlyNet > 0 ? "medium" : "low",
  });

  // 4. Anomali varsa ona özel, yoksa alışveriş stratejisi
  if (anomalies.length > 0) {
    const a = anomalies[0];
    const excessAmount = Math.round(a.currentAmount - a.avgAmount);
    results.push({
      category: "alışveriş",
      title: `${a.category} Anomalisi: ${formatTRY(excessAmount)} Fazla Harcama`,
      description: `${user.name}, ${a.category} kategorisinde normalin üstünde harcama tespit edildi. Bu ay ${formatTRY(a.currentAmount)} harcadın, ortalaman ${formatTRY(a.avgAmount)}. ${a.message}`,
      actionItems: [
        `${a.category} harcamalarını tek tek gözden geçir`,
        `Bir sonraki ay ${formatTRY(a.avgAmount)} limitine geri dön`,
        "Büyük harcamalar için 48 saat bekleme kuralı uygula",
        "Taksit ve abonelik kontrolü yap",
      ],
      impact: `Aylık ${formatTRY(excessAmount)} potansiyel tasarruf`,
      priority: "high",
    });
  } else {
    const shopCat = s.topCategories.find((c) => c.category === "Alışveriş");
    const shopAmount = shopCat?.amount || 0;
    results.push({
      category: "alışveriş",
      title:
        shopAmount > 0
          ? `Alışveriş Harcamanı (${formatTRY(shopAmount)}) Optimize Et`
          : "Bilinçli Alışveriş Stratejisi",
      description: `${user.name}, ${shopAmount > 0 ? `bu ay alışverişe ${formatTRY(shopAmount)} harcadın.` : "Alışveriş harcamalarını optimize edebilirsin."} Fiyat karşılaştırma ve zamanlama ile %15-25 tasarruf mümkün.`,
      actionItems: [
        `${formatTRY(Math.round(user.monthlyIncome * 0.02))} üstü alışverişlerde fiyat karşılaştır`,
        "İndirim dönemlerini takip et (Kasım, yaz sonu)",
        "Taksit maliyetini toplam fiyata ekleyerek değerlendir",
        "İstek listesi oluştur, dürtüsel alımlardan kaçın",
      ],
      impact: `Aylık ${formatTRY(Math.round(shopAmount * 0.2 || user.monthlyIncome * 0.02))} tasarruf`,
      priority: "low",
    });
  }

  // 5. Tasarruf hedefi takibi
  if (savingsLow && user.savingsGoal > 0) {
    const gap = Math.max(0, user.savingsGoal - Math.max(0, monthlyNet));
    results.push({
      category: "tasarruf",
      title: `Tasarruf Hedefine ${formatTRY(gap)} Uzaktasın`,
      description: `${user.name}, aylık tasarruf hedefin ${formatTRY(user.savingsGoal)} ama bu ay net birikiminiz ${formatTRY(monthlyNet)}. Hedefin %${Math.round((Math.max(0, monthlyNet) / Math.max(1, user.savingsGoal)) * 100)}'ine ulaştın.`,
      actionItems: [
        `En yüksek 2 kategoride toplam ${formatTRY(Math.round(gap / 2))} kısıntı yap`,
        `Gelirini artırmak için ek iş/freelance fırsatlarını değerlendir`,
        `Otomatik tasarruf: maaş günü ${formatTRY(Math.round(user.savingsGoal * 0.5))} ayrı hesaba aktar`,
      ],
      impact: `Hedefe ulaşma: aylık +${formatTRY(gap)}`,
      priority: "high",
    });
  }

  return results.slice(0, 5);
}

function mockQuiz(topic: string) {
  return {
    question: `${topic} ile ilgili aşağıdakilerden hangisi doğrudur?`,
    options: [
      "Enflasyon paranın alım gücünü artırır",
      "Enflasyon paranın alım gücünü azaltır",
      "Enflasyon sadece gıda fiyatlarını etkiler",
      "Enflasyon faiz oranlarını düşürür",
    ],
    correctIndex: 1,
    explanation:
      "Enflasyon, genel fiyat düzeyinin sürekli artması demektir. Bu durum paranın alım gücünü azaltır — yani aynı parayla daha az mal ve hizmet satın alabilirsiniz.",
    difficulty: "kolay",
    topic,
  };
}

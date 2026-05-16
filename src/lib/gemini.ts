/**
 * Gemini AI entegrasyonu — Agentic yapı desteğiyle.
 *
 * Gemini API varsa: Function calling destekli agentic chat
 * Gemini API yoksa: Mock fallback yanıtlar (UI tamamen çalışır)
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

function getApiKey() {
  return process.env.GEMINI_API_KEY || "";
}
function getModelName() {
  return process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

export const isGeminiEnabled = !!getApiKey();

function getClient(): GoogleGenerativeAI | null {
  const key = getApiKey();
  return key ? new GoogleGenerativeAI(key) : null;
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

/** Rate-limit aware retry wrapper + per-attempt timeout (toplam üst sınır ~14s). */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 1,
  perAttemptTimeoutMs = 12000,
): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await withTimeout(fn(), perAttemptTimeoutMs, "gemini");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 =
        msg.includes("429") ||
        msg.includes("quota") ||
        msg.includes("Too Many Requests");
      const isTimeout = msg.includes("timeout");
      if ((is429 || isTimeout) && i < retries) {
        const waitMs = is429 ? 1500 : 200;
        console.warn(
          `[gemini] ${isTimeout ? "Timeout" : "Rate limit"} — kısa bekleme sonrası tekrar (deneme ${i + 2}/${retries + 1})`,
        );
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Retry exhausted");
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
  const client = getClient();
  const modelName = getModelName();
  if (!client) {
    const reply = mockReply(user, txs, userMessage);
    return { reply, steps: [{ type: "response", content: reply }] };
  }

  try {
    const systemPrompt = buildSystemPrompt(user, txs);
    const historyForAgent = history.slice(-10).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const result = await withRetry(() =>
      runFinanceAgent(
        client,
        modelName,
        systemPrompt,
        historyForAgent,
        userMessage,
        txs,
        user,
      ),
    );

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
  const prompt = `Kullanıcı için bu ayki harcamalarını analiz et ve aşağıdaki JSON formatında 4 öneri üret.
Her öneriyi ayrıntılı, somut TL miktarları veya yüzdelerle destekle.

JSON formatı (sadece JSON döndür, başka bir şey ekleme):
[
  {
    "category": "tasarruf" | "bütçe" | "yatırım" | "alışveriş",
    "title": "Kısa başlık",
    "description": "Detaylı açıklama",
    "actionItems": ["Eylem 1", "Eylem 2"],
    "impact": "Tahmini etki (TL veya yüzde)",
    "priority": "high" | "medium" | "low"
  }
]`;

  const client = getClient();
  const modelName = getModelName();
  if (!client) {
    return {
      text: mockReply(user, txs, prompt),
      structured: mockStructuredRecommendations(user, txs),
    };
  }

  try {
    const model = client.getGenerativeModel({
      model: modelName,
      systemInstruction: buildSystemPrompt(user, txs),
    });
    console.log(
      "[gemini] Recommendations: gerçek Gemini API kullanılıyor, model:",
      modelName,
    );

    const res = await withRetry(() => model.generateContent(prompt));
    const responseText = res.response.text();

    // JSON parse etmeyi dene
    let structured: StructuredRecommendation[] = [];
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        structured = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // JSON parse başarısız olursa boş array
      structured = mockStructuredRecommendations(user, txs);
    }

    // Düz metin versiyonu da üret
    const textVersion = structured
      .map(
        (r, i) =>
          `**${i + 1}. ${r.title}** (${r.category})\n${r.description}\n${r.actionItems.map((a) => `- ${a}`).join("\n")}\n*Etki: ${r.impact}*`,
      )
      .join("\n\n");

    return { text: textVersion || responseText, structured };
  } catch (err: unknown) {
    const errMsg = friendlyError(err);
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
  const client = getClient();
  const modelName = getModelName();
  if (!client) {
    return JSON.stringify(mockQuiz(topic));
  }

  try {
    const model = client.getGenerativeModel({ model: modelName });
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

    const res = await withRetry(() => model.generateContent(prompt));
    return res.response.text();
  } catch (err: unknown) {
    console.error("[gemini] Quiz HATA:", err);
    return JSON.stringify(mockQuiz(topic));
  }
}

export async function generateScenarioAnalysis(
  scenario: string,
): Promise<string> {
  const client = getClient();
  const modelName = getModelName();
  if (!client) {
    return JSON.stringify({
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
  }

  try {
    const model = client.getGenerativeModel({ model: modelName });
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

    const res = await withRetry(() => model.generateContent(prompt));
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
  const client = getClient();
  const modelName = getModelName();
  if (!client) {
    return `**${concept}** kavramı hakkında bilgi:\n\nBu kavram finansal okuryazarlığın temel taşlarından biridir. (Mock yanıt — GEMINI_API_KEY eklenince gerçek açıklama üretilir.)`;
  }

  try {
    const model = client.getGenerativeModel({ model: modelName });
    const prompt = `"${concept}" kavramını "${level}" seviyesinde, Türkçe olarak açıkla.
Türkiye ekonomisinden somut örnekler ver.
Markdown formatında, kısa ve öz, anlaşılır bir şekilde yaz.
Güncel veriler ve gerçekçi senaryolar kullan.`;

    const res = await withRetry(() => model.generateContent(prompt));
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
  const client = getClient();
  const modelName = getModelName();

  // Mali durum özeti — Gemini olsa da olmasa da kullanılır
  const s = summarizeFinance(txs, user.monthlyBudget);
  const monthlyNet = s.thisMonth.net;
  const remainingBudget = Math.max(0, user.monthlyBudget - s.thisMonth.expense);

  if (!client) {
    return mockProductAnalysis(product, user, monthlyNet, remainingBudget);
  }

  try {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
    });

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

    const res = await withRetry(() => model.generateContent(prompt));
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
}

/**
 * Kişiye özel, aylık kapsamlı finansal raporu Markdown formatında üretir.
 * Gemini varsa: AI ile zenginleştirilmiş yorum + öneri.
 * Yoksa: deterministik istatistik tabanlı rapor (her durumda yararlı).
 */
export async function generateFinancialReport(
  input: FinancialReportInput,
): Promise<string> {
  const { user, txs } = input;
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

  const client = getClient();
  if (!client) return baseMarkdown;

  try {
    const model = client.getGenerativeModel({
      model: getModelName(),
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

Raporu doğrudan Markdown ile başlat (\`# ${user.name} • ${monthLabel} Finansal Raporu\` başlığıyla). Emoji kullanabilirsin ama abartma. ${user.name}'e ikinci tekil "sen" ile hitap et.`;

    const res = await withRetry(() => model.generateContent(prompt), 1, 14000);
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
  const top = s.topCategories[0];

  return [
    {
      category: "tasarruf",
      title: "Gıda Harcamalarını Optimize Et",
      description: `${top?.category || "Gıda"} kategorisinde bu ay ${formatTRY(top?.amount || 0)} harcadın. Haftalık market listesi ile %15-20 tasarruf edebilirsin.`,
      actionItems: [
        "Haftalık menü planı yap ve listeyle markete git",
        "Mevsim meyve-sebzelerini tercih et",
        "Dışarıda yemek sayısını azalt",
      ],
      impact: `Aylık ~${formatTRY(Math.round((top?.amount || 3000) * 0.15))} tasarruf`,
      priority: "high",
    },
    {
      category: "bütçe",
      title: "Bütçe Limitlerini Gözden Geçir",
      description: `Bütçe kullanımın %${s.thisMonth.budgetUsedPct}. Kategori bazlı alt limitler belirleyerek harcamalarını kontrol et.`,
      actionItems: [
        "Her kategori için aylık limit belirle",
        "Sabit giderleri otomatik ödemeye al",
        "Değişken giderleri haftalık takip et",
      ],
      impact: `Bütçe kullanımını %80'in altında tutma`,
      priority: "medium",
    },
    {
      category: "yatırım",
      title: "Düşük Riskli Yatırım Başlat",
      description: `Risk toleransın "${user.riskTolerance}" seviyesinde. Aylık sabit tutarda yatırım fonu alabilirsin.`,
      actionItems: [
        "Acil durum fonu oluştur (3 aylık gider)",
        "Aylık otomatik fon alım talimatı ver",
        "Vadeli mevduat faiz oranlarını karşılaştır",
      ],
      impact: `Aylık ${formatTRY(Math.round(user.monthlyIncome * 0.1))} yatırım`,
      priority: "medium",
    },
    {
      category: "alışveriş",
      title: "Bilinçli Alışveriş Stratejisi",
      description: `Büyük alışverişlerde taksit + nakit karşılaştırması yap. İndirim dönemlerini takip et.`,
      actionItems: [
        "500₺ üstü alışverişlerde 48 saat bekle",
        "Fiyat karşılaştırma araçları kullan",
        "Taksit maliyetini toplam fiyata ekleyerek değerlendir",
      ],
      impact: `Alışveriş harcamalarında %20 tasarruf`,
      priority: "low",
    },
  ];
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

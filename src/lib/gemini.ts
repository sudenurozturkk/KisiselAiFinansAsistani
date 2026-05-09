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

/** Rate-limit aware retry wrapper */
export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests");
      if (is429 && i < retries) {
        const waitSec = Math.pow(2, i + 1) * 5; // 10s, 20s
        console.warn(`[gemini] Rate limit — ${waitSec}s beklenip tekrar denenecek (deneme ${i + 2}/${retries + 1})`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
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

    const result = await withRetry(() => runFinanceAgent(
      client,
      modelName,
      systemPrompt,
      historyForAgent,
      userMessage,
      txs,
      user,
    ));

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
    console.log("[gemini] Recommendations: gerçek Gemini API kullanılıyor, model:", modelName);

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

/* ─── Mock Fallbacks ────────────────────────────────────────── */

function mockReply(
  user: UserProfile,
  txs: Transaction[],
  userMessage: string,
) {
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

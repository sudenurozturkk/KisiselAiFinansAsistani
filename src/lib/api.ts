"use client";
import { getUserId } from "./userId";
import type {
  TransactionsResponse,
  WishlistResponse,
  WishlistItem,
  WishlistAnalysis,
  ChatResponse,
  RecommendationsResponse,
  SubscriptionsResponse,
  CSVImportResult,
  ReceiptScanResult,
  UserProfile,
  Transaction,
  ChatMessage,
  QuizQuestion,
  ScenarioAnalysis,
  AssetsResponse,
  Asset,
  IncomesResponse,
  IncomeSource,
} from "./types";

/* ─── Generic Fetch Helper ──────────────────────────────────── */

async function call<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const userId = getUserId();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("x-user-id", userId);
  const res = await fetch(path, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j.error || JSON.stringify(j);
    } catch {
      /* ignore */
    }
    throw new Error(`API ${path} failed (${res.status}): ${detail}`);
  }
  return res.json();
}

/* ─── API Client ────────────────────────────────────────────── */

export const api = {
  // Kullanıcı
  getUser: () => call<{ user: UserProfile }>("/api/user"),
  updateUser: (patch: Partial<UserProfile>) =>
    call<{ user: UserProfile }>("/api/user", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  // İşlemler
  getTransactions: () => call<TransactionsResponse>("/api/transactions"),
  addTransaction: (
    tx: Omit<Transaction, "_id" | "userId" | "date"> & { date?: string },
  ) =>
    call<{ transaction: Transaction }>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(tx),
    }),
  updateTransaction: (
    id: string,
    patch: Partial<Omit<Transaction, "_id" | "userId">>,
  ) =>
    call<{ transaction: Transaction }>(`/api/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteTransaction: (id: string) =>
    call<{ ok: boolean }>(`/api/transactions/${id}`, { method: "DELETE" }),

  // İstek Listesi (Wishlist)
  getWishlist: () => call<WishlistResponse>("/api/wishlist"),
  addWishlistItem: (item: Partial<WishlistItem>) =>
    call<{ item: WishlistItem }>("/api/wishlist", {
      method: "POST",
      body: JSON.stringify(item),
    }),
  updateWishlistItem: (id: string, patch: Partial<WishlistItem>) =>
    call<{ item: WishlistItem }>(`/api/wishlist/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteWishlistItem: (id: string) =>
    call<{ ok: boolean }>(`/api/wishlist/${id}`, { method: "DELETE" }),
  analyzeWishlist: () =>
    call<{ analysis: WishlistAnalysis }>("/api/wishlist/analyze", {
      method: "POST",
    }),
  scrapeProductUrl: (url: string) =>
    call<{
      data?: import("./types").ProductScrapeData;
      error?: string;
      partial?: { url: string };
    }>("/api/wishlist/scrape", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  refreshWishlistPrice: (id: string) =>
    call<{
      item: WishlistItem;
      priceFound: boolean;
      oldPrice?: number;
      newPrice?: number;
      dropped?: boolean;
      priceDropPct?: number;
      message: string;
    }>(`/api/wishlist/${id}/refresh-price`, { method: "POST" }),
  aiAnalyzeWishlistItem: (id: string) =>
    call<{
      item: WishlistItem;
      analysis: import("./gemini").ProductAnalysisResult;
    }>(`/api/wishlist/${id}/ai-analyze`, { method: "POST" }),

  // Sohbet (Agentic AI) — Çoklu oturum (session) destekli
  getMessages: (sessionId?: string) =>
    call<{ messages: ChatMessage[] }>(
      sessionId ? `/api/chat?sessionId=${sessionId}` : "/api/chat",
    ),
  sendMessage: (content: string, sessionId?: string) =>
    call<ChatResponse & { sessionId: string }>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ content, sessionId }),
    }),
  clearMessages: (sessionId?: string) =>
    call<{ ok: boolean }>(
      sessionId ? `/api/chat?sessionId=${sessionId}` : "/api/chat",
      { method: "DELETE" },
    ),
  // Sohbet oturumları (Yeni sohbet / liste)
  listChatSessions: () =>
    call<{ sessions: import("./types").ChatSession[] }>("/api/chat/sessions"),
  createChatSession: (title?: string) =>
    call<{ session: import("./types").ChatSession }>("/api/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),
  getChatSession: (id: string) =>
    call<{
      session: import("./types").ChatSession;
      messages: ChatMessage[];
    }>(`/api/chat/sessions/${id}`),
  updateChatSession: (id: string, title: string) =>
    call<{ session: import("./types").ChatSession }>(
      `/api/chat/sessions/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ title }),
      },
    ),
  deleteChatSession: (id: string) =>
    call<{ ok: boolean }>(`/api/chat/sessions/${id}`, { method: "DELETE" }),

  // Öneriler
  getRecommendations: (forceRefresh = false) =>
    call<RecommendationsResponse>(
      `/api/recommendations${forceRefresh ? "?refresh=1" : ""}`,
    ),

  // Finansal Okuryazarlık
  getQuiz: (topic: string, difficulty = "kolay") =>
    call<{ quiz: QuizQuestion }>("/api/literacy", {
      method: "POST",
      body: JSON.stringify({ action: "quiz", topic, difficulty }),
    }),
  getScenarioAnalysis: (scenario: string) =>
    call<{ analysis: ScenarioAnalysis }>("/api/literacy", {
      method: "POST",
      body: JSON.stringify({ action: "scenario", scenario }),
    }),
  explainConcept: (concept: string, level = "başlangıç") =>
    call<{ explanation: string }>("/api/literacy", {
      method: "POST",
      body: JSON.stringify({ action: "explain", concept, level }),
    }),

  // Fiş Tarama (Vision AI)
  scanReceipt: (imageBase64: string, mimeType = "image/jpeg") =>
    call<{ receipt: ReceiptScanResult }>("/api/vision/receipt", {
      method: "POST",
      body: JSON.stringify({ image: imageBase64, mimeType }),
    }),

  // Abonelik Yönetimi (Manuel Giriş)
  getSubscriptions: () => call<SubscriptionsResponse>("/api/subscriptions"),
  addSubscription: (sub: {
    name: string;
    amount: number;
    frequency?: string;
    category?: string;
    nextPaymentDate?: string;
    note?: string;
  }) =>
    call<{ subscription: import("./types").Subscription }>(
      "/api/subscriptions",
      {
        method: "POST",
        body: JSON.stringify(sub),
      },
    ),
  updateSubscription: (id: string, patch: Record<string, unknown>) =>
    call<{ subscription: import("./types").Subscription }>(
      `/api/subscriptions/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(patch),
      },
    ),
  deleteSubscription: (id: string) =>
    call<{ ok: boolean }>(`/api/subscriptions/${id}`, { method: "DELETE" }),

  // Banka Ekstresi İçe Aktarma (CSV)
  importCSV: (csvText: string) =>
    call<CSVImportResult>("/api/import", {
      method: "POST",
      body: JSON.stringify({ csvText }),
    }),

  // Yönetim
  resetDemo: (reseed = true) =>
    call<{ ok: boolean; reseed: boolean }>("/api/admin/reset", {
      method: "POST",
      body: JSON.stringify({ reseed }),
    }),

  // Varlıklar (Assets)
  getAssets: () => call<AssetsResponse>("/api/assets"),
  addAsset: (data: Partial<Asset>) =>
    call<{ asset: Asset }>("/api/assets", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateAsset: (id: string, patch: Partial<Asset>) =>
    call<{ asset: Asset }>(`/api/assets/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteAsset: (id: string) =>
    call<{ ok: boolean }>(`/api/assets/${id}`, { method: "DELETE" }),

  // Ek Gelirler (Incomes)
  getIncomes: () => call<IncomesResponse>("/api/incomes"),
  addIncome: (data: Partial<IncomeSource>) =>
    call<{ income: IncomeSource }>("/api/incomes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateIncome: (id: string, patch: Partial<IncomeSource>) =>
    call<{ income: IncomeSource }>(`/api/incomes/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteIncome: (id: string) =>
    call<{ ok: boolean }>(`/api/incomes/${id}`, { method: "DELETE" }),

  // Finansal Ayna — Duygusal Harcama Analizi
  getEmotionalAnalysis: () =>
    call<
      import("./emotional").FinancialMirrorResult & {
        userName: string;
        monthlyBudget: number;
      }
    >("/api/emotional"),

  // Akıllı Bildirimler
  getAlerts: () =>
    call<{ alerts: import("./smart-alerts").SmartAlert[] }>("/api/alerts"),

  // AI Abonelik Optimizasyonu
  getSubOptimization: () =>
    call<import("./sub-optimizer").SubOptimizationReport>(
      "/api/subscriptions/optimize",
    ),

  // AI Günlük Tavsiyeler
  getDailyTips: () =>
    call<{ tips: import("./daily-tips").DailyTip[] }>("/api/tips"),

  // Piyasa Fiyatları (TwelveData)
  getMarketPrices: (symbols?: string) =>
    call<{
      prices: Record<string, import("./market").MarketPrice>;
      count: number;
      updatedAt: string;
    }>(`/api/market-prices${symbols ? `?symbols=${symbols}` : ""}`),
  getMarketTimeSeries: (symbol: string, days = 30) =>
    call<{ series: import("./market").MarketTimeSeries }>(
      `/api/market-prices?timeseries=${symbol}&days=${days}`,
    ),
  resolveSymbol: (query: string) =>
    call<{
      input: string;
      resolved: { symbol: string; name: string; exchange: string } | null;
      found: boolean;
    }>(`/api/market-prices?resolve=${encodeURIComponent(query)}`),
  getMarketSummary: () =>
    call<{ summary: string }>("/api/market-prices?summary=1"),

  // Senaryo Simülatörü AI Analizi
  analyzeScenario: (data: {
    adjustments: Record<string, number>;
    incomeBoost?: number;
    oneTimeExpense?: number;
    horizon?: number;
  }) =>
    call<{
      baseline: {
        monthlyExpense: number;
        monthlyNet: number;
        yearlySavings: number;
      };
      scenario: {
        monthlyExpense: number;
        monthlyNet: number;
        yearlySavings: number;
      };
      delta: {
        expenseDiff: number;
        netDiff: number;
        yearlyDiff: number;
        expensePct: number;
      };
      goalMonths?: number;
      insights: string[];
      aiAnalysis: string;
      source: string;
    }>("/api/simulator/analyze", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Kredi Kartı Ekstresi Analizi
  scanCreditCardStatement: (data: {
    image?: string;
    mimeType?: string;
    textContent?: string;
  }) =>
    call<{
      statement: {
        cardInfo: {
          bankName: string;
          cardLast4: string;
          statementPeriod: string;
          totalAmount: number;
          minimumPayment: number;
        };
        transactions: {
          date: string;
          description: string;
          amount: number;
          category: string;
          type: string;
          isInstallment: boolean;
          installmentInfo: string;
        }[];
        summary: {
          totalExpense: number;
          transactionCount: number;
          topCategory: string;
        };
        confidence: number;
      };
    }>("/api/vision/credit-card-statement", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Finansal Rapor (çoklu format)
  getFinancialReport: (format: "web" | "pdf" | "json" = "web") =>
    call<{
      format: string;
      markdown?: string;
      generatedAt: string;
      user: UserProfile;
      htmlTemplate?: string;
      // json format fields
      summary?: Record<string, unknown>;
      portfolio?: Record<string, unknown>;
    }>(`/api/reports/financial?format=${format}`),
};

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

  // Sohbet (Agentic AI)
  getMessages: () => call<{ messages: ChatMessage[] }>("/api/chat"),
  sendMessage: (content: string) =>
    call<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
  clearMessages: () => call<{ ok: boolean }>("/api/chat", { method: "DELETE" }),

  // Öneriler
  getRecommendations: () =>
    call<RecommendationsResponse>("/api/recommendations"),

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

  // Finansal Rapor (AI)
  getFinancialReport: () =>
    call<{ markdown: string; generatedAt: string; user: UserProfile }>(
      "/api/reports/financial",
    ),

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
    call<import("./emotional").FinancialMirrorResult & { userName: string; monthlyBudget: number }>(
      "/api/emotional",
    ),

  // Akıllı Bildirimler
  getAlerts: () =>
    call<{ alerts: import("./smart-alerts").SmartAlert[] }>("/api/alerts"),
};

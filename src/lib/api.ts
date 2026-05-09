"use client";
import { getUserId } from "./userId";
import type {
  TransactionsResponse,
  ProductsResponse,
  ChatResponse,
  RecommendationsResponse,
  UserProfile,
  Transaction,
  ChatMessage,
  QuizQuestion,
  ScenarioAnalysis,
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

  // Ürünler
  getProducts: () => call<ProductsResponse>("/api/products"),
  buyProduct: (productId: string, installments = 1) =>
    call("/api/products/buy", {
      method: "POST",
      body: JSON.stringify({ productId, installments }),
    }),

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

  // Yönetim
  resetDemo: (reseed = true) =>
    call<{ ok: boolean; reseed: boolean }>("/api/admin/reset", {
      method: "POST",
      body: JSON.stringify({ reseed }),
    }),
};

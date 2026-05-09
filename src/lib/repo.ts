/**
 * Veri Katmanı — In-Memory Store
 * 
 * Tüm CRUD işlemleri burada merkezileştirilmiştir.
 * MongoDB tamamen kaldırılmıştır; uygulama in-memory çalışır.
 */
import { genId, memdb, nowIso } from "./store";
import type { ChatMessage, Transaction, UserProfile, WishlistItem, Subscription } from "./types";

/* ─── Helpers ──────────────────────────────────────────────── */

function defaultUser(userId: string): UserProfile {
  return {
    userId,
    name: "Misafir",
    monthlyIncome: 25000,
    monthlyBudget: 18000,
    savingsGoal: 5000,
    riskTolerance: "orta",
    goals: ["Acil durum fonu oluşturmak", "3 ay içinde 15.000₺ tasarruf"],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function monthAgo(base: Date, monthsBack: number, day: number): Date {
  return new Date(base.getFullYear(), base.getMonth() - monthsBack, day);
}

/* ─── Users ────────────────────────────────────────────────── */

export async function getOrCreateUser(userId: string): Promise<UserProfile> {
  let u = memdb.users.get(userId);
  if (!u) {
    u = defaultUser(userId);
    memdb.users.set(userId, u);
  }
  return u;
}

export async function updateUser(userId: string, patch: Partial<UserProfile>): Promise<UserProfile> {
  const cur = await getOrCreateUser(userId);
  const next: UserProfile = { ...cur, ...patch, updatedAt: nowIso() };
  memdb.users.set(userId, next);
  return next;
}

/* ─── Transactions ─────────────────────────────────────────── */

export async function listTransactions(userId: string): Promise<Transaction[]> {
  return memdb.transactions
    .filter((t) => t.userId === userId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export async function addTransaction(tx: Omit<Transaction, "_id">): Promise<Transaction> {
  const row: Transaction = { ...tx, _id: genId() };
  memdb.transactions.push(row);
  return row;
}

export async function updateTransaction(
  userId: string,
  id: string,
  patch: Partial<Omit<Transaction, "_id" | "userId">>,
): Promise<Transaction | null> {
  const idx = memdb.transactions.findIndex((t) => t._id === id && t.userId === userId);
  if (idx === -1) return null;
  memdb.transactions[idx] = { ...memdb.transactions[idx], ...patch };
  return memdb.transactions[idx];
}

export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  const before = memdb.transactions.length;
  memdb.transactions = memdb.transactions.filter((t) => !(t._id === id && t.userId === userId));
  return memdb.transactions.length < before;
}

export async function resetUserData(userId: string): Promise<void> {
  memdb.transactions = memdb.transactions.filter((t) => t.userId !== userId);
  memdb.messages = memdb.messages.filter((m) => m.userId !== userId);
  memdb.wishlist = memdb.wishlist.filter((w) => w.userId !== userId);
  memdb.subscriptions = memdb.subscriptions.filter((s) => s.userId !== userId);
}

/* ─── Seed Demo Data ───────────────────────────────────────── */

export async function seedTransactionsIfEmpty(userId: string) {
  const existing = await listTransactions(userId);
  if (existing.length > 0) return;

  const today = new Date();
  const variation = (n: number) => Math.round(n * (0.85 + Math.random() * 0.3));
  const samples: Omit<Transaction, "_id">[] = [];

  for (let m = 5; m >= 0; m--) {
    samples.push(
      { userId, type: "gelir", category: "Diğer", amount: 25000, note: "Maaş", date: monthAgo(today, m, 1).toISOString() },
      { userId, type: "gider", category: "Kira/Fatura", amount: 7500, note: "Kira", date: monthAgo(today, m, 2).toISOString() },
      { userId, type: "gider", category: "Kira/Fatura", amount: variation(950), note: "Elektrik + su", date: monthAgo(today, m, 4).toISOString() },
      { userId, type: "gider", category: "Kira/Fatura", amount: variation(380), note: "İnternet", date: monthAgo(today, m, 5).toISOString() },
      { userId, type: "gider", category: "Gıda", amount: variation(1400), note: "Market - hafta 1", date: monthAgo(today, m, 6).toISOString() },
      { userId, type: "gider", category: "Gıda", amount: variation(1200), note: "Market - hafta 3", date: monthAgo(today, m, 19).toISOString() },
      { userId, type: "gider", category: "Gıda", amount: variation(620), note: "Dışarıda yemek", date: monthAgo(today, m, 11).toISOString() },
      { userId, type: "gider", category: "Ulaşım", amount: variation(720), note: "Yakıt + Akbil", date: monthAgo(today, m, 7).toISOString() },
      { userId, type: "gider", category: "Eğlence", amount: variation(820), note: "Sinema/konser", date: monthAgo(today, m, 13).toISOString() },
      { userId, type: "gider", category: "Alışveriş", amount: variation(1100), note: "Kıyafet", date: monthAgo(today, m, 16).toISOString() },
      { userId, type: "gider", category: "Sağlık", amount: variation(420), note: "Eczane", date: monthAgo(today, m, 21).toISOString() },
      { userId, type: "gider", category: "Eğlence", amount: 99, note: "Netflix", date: monthAgo(today, m, 3).toISOString() },
      { userId, type: "gider", category: "Eğlence", amount: 60, note: "Spotify Premium", date: monthAgo(today, m, 5).toISOString() },
      { userId, type: "gider", category: "Eğlence", amount: 80, note: "YouTube Premium", date: monthAgo(today, m, 8).toISOString() },
      { userId, type: "gider", category: "Kira/Fatura", amount: 190, note: "Vodafone fatura", date: monthAgo(today, m, 10).toISOString() },
      { userId, type: "gider", category: "Sağlık", amount: 450, note: "MacFit spor salonu", date: monthAgo(today, m, 12).toISOString() },
    );
    if (m % 3 === 0) {
      samples.push({ userId, type: "gelir", category: "Diğer", amount: 2500, note: "Freelance proje", date: monthAgo(today, m, 18).toISOString() });
    }
    if (m % 2 === 0) {
      samples.push({ userId, type: "gider", category: "Eğitim", amount: variation(550), note: "Online kurs", date: monthAgo(today, m, 22).toISOString() });
    }
    if (m === 0) {
      samples.push({ userId, type: "gider", category: "Yatırım", amount: 1500, note: "Mevduat transferi", date: monthAgo(today, 0, 8).toISOString() });
    }
  }
  for (const s of samples) await addTransaction(s);
}

/* ─── Chat Messages ────────────────────────────────────────── */

export async function listMessages(userId: string, limit = 100): Promise<ChatMessage[]> {
  return memdb.messages.filter((m) => m.userId === userId).slice(-limit);
}

export async function addMessage(msg: Omit<ChatMessage, "_id" | "createdAt">): Promise<ChatMessage> {
  const row: ChatMessage = { ...msg, _id: genId(), createdAt: nowIso() };
  memdb.messages.push(row);
  return row;
}

export async function clearMessages(userId: string): Promise<void> {
  memdb.messages = memdb.messages.filter((m) => m.userId !== userId);
}

/* ─── Wishlist ─────────────────────────────────────────────── */

export async function listWishlistItems(userId: string): Promise<WishlistItem[]> {
  return memdb.wishlist
    .filter((w) => w.userId === userId)
    .sort((a, b) => b.priority - a.priority || +new Date(b.createdAt) - +new Date(a.createdAt));
}

export async function addWishlistItem(
  item: Omit<WishlistItem, "_id" | "createdAt">,
): Promise<WishlistItem> {
  const row: WishlistItem = { ...item, _id: genId(), createdAt: nowIso() };
  memdb.wishlist.push(row);
  return row;
}

export async function updateWishlistItem(
  userId: string,
  id: string,
  patch: Partial<WishlistItem>,
): Promise<WishlistItem | null> {
  const idx = memdb.wishlist.findIndex((w) => w._id === id && w.userId === userId);
  if (idx === -1) return null;
  memdb.wishlist[idx] = { ...memdb.wishlist[idx], ...patch };
  return memdb.wishlist[idx];
}

export async function deleteWishlistItem(userId: string, id: string): Promise<boolean> {
  const before = memdb.wishlist.length;
  memdb.wishlist = memdb.wishlist.filter((w) => !(w._id === id && w.userId === userId));
  return memdb.wishlist.length < before;
}

/* ─── Subscriptions ────────────────────────────────────────── */

export async function listSubscriptions(userId: string): Promise<Subscription[]> {
  return memdb.subscriptions.filter((s) => s.userId === userId);
}

export async function addSubscription(
  data: Omit<Subscription, "_id" | "createdAt">,
): Promise<Subscription> {
  const sub: Subscription = { ...data, _id: genId(), createdAt: nowIso() };
  memdb.subscriptions.push(sub);
  return sub;
}

export async function updateSubscription(
  userId: string,
  id: string,
  patch: Partial<Subscription>,
): Promise<Subscription | null> {
  const idx = memdb.subscriptions.findIndex((s) => s._id === id && s.userId === userId);
  if (idx === -1) return null;
  memdb.subscriptions[idx] = { ...memdb.subscriptions[idx], ...patch };
  return memdb.subscriptions[idx];
}

export async function deleteSubscription(userId: string, id: string): Promise<boolean> {
  const before = memdb.subscriptions.length;
  memdb.subscriptions = memdb.subscriptions.filter((s) => !(s._id === id && s.userId === userId));
  return memdb.subscriptions.length < before;
}

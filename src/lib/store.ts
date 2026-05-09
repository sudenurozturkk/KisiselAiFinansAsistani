// In-memory fallback store. Used when MONGODB_URI is not set.
import type { ChatMessage, Transaction, UserProfile, WishlistItem, Subscription } from "./types";

interface MemoryDB {
  users: Map<string, UserProfile>;
  transactions: Transaction[];
  messages: ChatMessage[];
  wishlist: WishlistItem[];
  subscriptions: Subscription[];
}

const g = globalThis as unknown as { __memdb?: MemoryDB };

function defaultDB(): MemoryDB {
  return { users: new Map(), transactions: [], messages: [], wishlist: [], subscriptions: [] };
}

export const memdb: MemoryDB = g.__memdb || (g.__memdb = defaultDB());

export function nowIso() {
  return new Date().toISOString();
}

export function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * In-Memory Veri Deposu
 *
 * Uygulama sunucu belleğinde çalışır; MongoDB gerekmez.
 * Sunucu yeniden başlatıldığında veriler sıfırlanır.
 */
import type {
  ChatMessage,
  Transaction,
  UserProfile,
  WishlistItem,
  Subscription,
  Asset,
  IncomeSource,
} from "./types";

interface MemoryDB {
  users: Map<string, UserProfile>;
  transactions: Transaction[];
  messages: ChatMessage[];
  wishlist: WishlistItem[];
  subscriptions: Subscription[];
  assets: Asset[];
  incomes: IncomeSource[];
}

const g = globalThis as unknown as { __memdb?: MemoryDB };

function defaultDB(): MemoryDB {
  return {
    users: new Map(),
    transactions: [],
    messages: [],
    wishlist: [],
    subscriptions: [],
    assets: [],
    incomes: [],
  };
}

export const memdb: MemoryDB = g.__memdb || (g.__memdb = defaultDB());

// Hot-reload güvenliği: Mevcut globalThis.__memdb yeni alanları içermeyebilir.
if (!memdb.assets) memdb.assets = [];
if (!memdb.incomes) memdb.incomes = [];

export function nowIso() {
  return new Date().toISOString();
}

export function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

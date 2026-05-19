/**
 * In-Memory + Disk Persistent Veri Deposu
 *
 * Veriler RAM'de tutulur (hızlı erişim) ve aynı zamanda disk'e (data/db.json)
 * yazılır. Sunucu yeniden başlatıldığında veriler diskten yüklenir.
 *
 * - Yazma işlemleri debounce edilir (200ms) — yoğun yazma sırasında performans
 * - Hot-reload güvenliği: globalThis.__memdb üzerinden paylaşılır
 * - Atomic write: önce .tmp dosyasına yazılır, sonra rename edilir
 */
import fs from "fs";
import path from "path";
import type {
  ChatMessage,
  ChatSession,
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
  sessions: ChatSession[];
  wishlist: WishlistItem[];
  subscriptions: Subscription[];
  assets: Asset[];
  incomes: IncomeSource[];
  /** Demo seed yapılmış kullanıcı ID'leri (kullanıcı verileri silerse tekrar seed olmasın) */
  seededUsers: Set<string>;
}

interface SerializedDB {
  users: Array<[string, UserProfile]>;
  transactions: Transaction[];
  messages: ChatMessage[];
  sessions: ChatSession[];
  wishlist: WishlistItem[];
  subscriptions: Subscription[];
  assets: Asset[];
  incomes: IncomeSource[];
  seededUsers: string[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const TMP_FILE = path.join(DATA_DIR, "db.json.tmp");

function defaultDB(): MemoryDB {
  return {
    users: new Map(),
    transactions: [],
    messages: [],
    sessions: [],
    wishlist: [],
    subscriptions: [],
    assets: [],
    incomes: [],
    seededUsers: new Set(),
  };
}

function loadFromDisk(): MemoryDB | null {
  try {
    if (!fs.existsSync(DB_FILE)) return null;
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    if (!raw.trim()) return null;
    const data = JSON.parse(raw) as Partial<SerializedDB>;
    return {
      users: new Map(data.users ?? []),
      transactions: data.transactions ?? [],
      messages: data.messages ?? [],
      sessions: data.sessions ?? [],
      wishlist: data.wishlist ?? [],
      subscriptions: data.subscriptions ?? [],
      assets: data.assets ?? [],
      incomes: data.incomes ?? [],
      seededUsers: new Set(data.seededUsers ?? []),
    };
  } catch (e) {
    console.warn("[store] Disk okuma hatası, yeni DB oluşturulacak:", e);
    return null;
  }
}

/* ─── Singleton (cold-start + hot-reload güvenli) ─────────── */

const g = globalThis as unknown as { __memdb?: MemoryDB };

if (!g.__memdb) {
  const fromDisk = loadFromDisk();
  g.__memdb = fromDisk ?? defaultDB();
  if (fromDisk) {
    console.log(
      `[store] Disk'ten yüklendi: ${fromDisk.transactions.length} işlem, ` +
        `${fromDisk.wishlist.length} istek, ${fromDisk.subscriptions.length} abonelik, ` +
        `${fromDisk.assets.length} varlık, ${fromDisk.incomes.length} gelir, ` +
        `${fromDisk.messages.length} mesaj, ${fromDisk.sessions.length} oturum`,
    );
  }
}

export const memdb: MemoryDB = g.__memdb;

// Hot-reload güvenliği: eski memdb yeni alanları içermeyebilir (geri uyumluluk)
if (!memdb.assets) memdb.assets = [];
if (!memdb.incomes) memdb.incomes = [];
if (!memdb.sessions) memdb.sessions = [];
if (!memdb.seededUsers) memdb.seededUsers = new Set();

/* ─── Persistence (debounced) ─────────────────────────────── */

let saveTimer: NodeJS.Timeout | null = null;
let pendingWrites = 0;

/**
 * Veri değişikliğinden sonra çağrılır. 200ms debounce ile disk'e yazılır.
 * Sık değişikliklerde yalnızca son durum yazılır.
 */
export function persist(): void {
  pendingWrites++;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(writeNow, 200);
}

function writeNow(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data: SerializedDB = {
      users: Array.from(memdb.users.entries()),
      transactions: memdb.transactions,
      messages: memdb.messages,
      sessions: memdb.sessions,
      wishlist: memdb.wishlist,
      subscriptions: memdb.subscriptions,
      assets: memdb.assets,
      incomes: memdb.incomes,
      seededUsers: Array.from(memdb.seededUsers),
    };
    // Atomic write: önce tmp'ye yaz, sonra rename
    fs.writeFileSync(TMP_FILE, JSON.stringify(data), "utf-8");
    fs.renameSync(TMP_FILE, DB_FILE);
    pendingWrites = 0;
  } catch (e) {
    console.warn("[store] Disk yazma hatası:", e);
  }
}

/** Senkron disk flush — sunucu kapanış öncesi tüm değişiklikleri yaz */
export function flushSync(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingWrites > 0) writeNow();
}

/* ─── Process Hooks — kapanış öncesi diske yaz ────────────── */

// Hot-reload sırasında listener birikmemesi için sadece bir kez ekle
const EXIT_SIGNALS = ["SIGINT", "SIGTERM", "beforeExit"] as const;
for (const sig of EXIT_SIGNALS) {
  if (process.listenerCount(sig) === 0) {
    process.once(sig, () => {
      flushSync();
      if (sig === "SIGINT" || sig === "SIGTERM") process.exit(0);
    });
  }
}

/* ─── Utilities ───────────────────────────────────────────── */

export function nowIso(): string {
  return new Date().toISOString();
}

export function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

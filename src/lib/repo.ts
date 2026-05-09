import { connectMongo, isMongoEnabled } from "./db";
import { ChatMessageModel, TransactionModel, UserModel } from "./models";
import { genId, memdb, nowIso } from "./store";
import type { ChatMessage, Transaction, UserProfile } from "./types";

async function useMongo() {
  if (!isMongoEnabled) return false;
  const conn = await connectMongo();
  return !!conn;
}

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

function serializeUser(doc: Record<string, unknown>): UserProfile {
  return {
    userId: doc.userId as string,
    name: (doc.name as string) ?? "Misafir",
    monthlyIncome: (doc.monthlyIncome as number) ?? 0,
    monthlyBudget: (doc.monthlyBudget as number) ?? 0,
    savingsGoal: (doc.savingsGoal as number) ?? 0,
    riskTolerance: (doc.riskTolerance as UserProfile["riskTolerance"]) ?? "orta",
    goals: (doc.goals as string[]) ?? [],
    createdAt: (doc.createdAt instanceof Date ? doc.createdAt.toISOString() : (doc.createdAt as string)) ?? nowIso(),
    updatedAt: (doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : (doc.updatedAt as string)) ?? nowIso(),
  };
}

function serializeTx(r: Record<string, unknown>): Transaction {
  return {
    _id: String(r._id),
    userId: r.userId as string,
    type: r.type as "gelir" | "gider",
    category: r.category as Transaction["category"],
    amount: r.amount as number,
    note: r.note as string | undefined,
    date: r.date instanceof Date ? r.date.toISOString() : r.date as string,
  };
}

// USERS
export async function getOrCreateUser(userId: string): Promise<UserProfile> {
  if (await useMongo()) {
    const found = await UserModel.findOne({ userId }).lean();
    if (found) return serializeUser(found as Record<string, unknown>);
    const created = await UserModel.create(defaultUser(userId));
    return serializeUser(created.toObject() as Record<string, unknown>);
  }
  let u = memdb.users.get(userId);
  if (!u) {
    u = defaultUser(userId);
    memdb.users.set(userId, u);
  }
  return u;
}

export async function updateUser(userId: string, patch: Partial<UserProfile>): Promise<UserProfile> {
  if (await useMongo()) {
    const updated = await UserModel.findOneAndUpdate(
      { userId },
      { $set: patch },
      { new: true, upsert: true }
    ).lean();
    return serializeUser(updated);
  }
  const cur = await getOrCreateUser(userId);
  const next: UserProfile = { ...cur, ...patch, updatedAt: nowIso() };
  memdb.users.set(userId, next);
  return next;
}

// TRANSACTIONS
export async function listTransactions(userId: string): Promise<Transaction[]> {
  if (await useMongo()) {
    const rows = await TransactionModel.find({ userId }).sort({ date: -1 }).lean();
    return rows.map((r) => serializeTx(r as Record<string, unknown>));
  }
  return memdb.transactions
    .filter((t) => t.userId === userId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export async function addTransaction(tx: Omit<Transaction, "_id">): Promise<Transaction> {
  if (await useMongo()) {
    const created = await TransactionModel.create(tx);
    return serializeTx(created.toObject() as Record<string, unknown>);
  }
  const row: Transaction = { ...tx, _id: genId() };
  memdb.transactions.push(row);
  return row;
}

export async function updateTransaction(
  userId: string,
  id: string,
  patch: Partial<Omit<Transaction, "_id" | "userId">>
): Promise<Transaction | null> {
  if (await useMongo()) {
    const updated = await TransactionModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: patch },
      { new: true }
    ).lean();
    return updated ? serializeTx(updated) : null;
  }
  const idx = memdb.transactions.findIndex((t) => t._id === id && t.userId === userId);
  if (idx === -1) return null;
  memdb.transactions[idx] = { ...memdb.transactions[idx], ...patch };
  return memdb.transactions[idx];
}

export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  if (await useMongo()) {
    const res = await TransactionModel.deleteOne({ _id: id, userId });
    return (res.deletedCount ?? 0) > 0;
  }
  const before = memdb.transactions.length;
  memdb.transactions = memdb.transactions.filter((t) => !(t._id === id && t.userId === userId));
  return memdb.transactions.length < before;
}

export async function resetUserData(userId: string): Promise<void> {
  if (await useMongo()) {
    await TransactionModel.deleteMany({ userId });
    await ChatMessageModel.deleteMany({ userId });
  } else {
    memdb.transactions = memdb.transactions.filter((t) => t.userId !== userId);
    memdb.messages = memdb.messages.filter((m) => m.userId !== userId);
  }
}

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
      { userId, type: "gider", category: "Sağlık", amount: variation(420), note: "Eczane", date: monthAgo(today, m, 21).toISOString() }
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

function monthAgo(base: Date, monthsBack: number, day: number): Date {
  return new Date(base.getFullYear(), base.getMonth() - monthsBack, day);
}

// CHAT
export async function listMessages(userId: string, limit = 100): Promise<ChatMessage[]> {
  if (await useMongo()) {
    const rows = await ChatMessageModel.find({ userId }).sort({ createdAt: 1 }).limit(limit).lean();
    return rows.map((r: Record<string, unknown>) => ({
      _id: String(r._id),
      userId: r.userId as string,
      role: r.role as "user" | "assistant",
      content: r.content as string,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt as string),
    }));
  }
  return memdb.messages.filter((m) => m.userId === userId).slice(-limit);
}

export async function addMessage(msg: Omit<ChatMessage, "_id" | "createdAt">): Promise<ChatMessage> {
  if (await useMongo()) {
    const created = await ChatMessageModel.create(msg);
    const o = created.toObject() as Record<string, unknown>;
    return {
      _id: String(o._id),
      userId: o.userId as string,
      role: o.role as "user" | "assistant",
      content: o.content as string,
      createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : (o.createdAt as string),
    };
  }
  const row: ChatMessage = { ...msg, _id: genId(), createdAt: nowIso() };
  memdb.messages.push(row);
  return row;
}

export async function clearMessages(userId: string): Promise<void> {
  if (await useMongo()) {
    await ChatMessageModel.deleteMany({ userId });
  } else {
    memdb.messages = memdb.messages.filter((m) => m.userId !== userId);
  }
}

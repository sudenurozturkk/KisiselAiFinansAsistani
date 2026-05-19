/**
 * Veri Katmanı — In-Memory Store
 *
 * Tüm CRUD işlemleri burada merkezileştirilmiştir.
 * MongoDB tamamen kaldırılmıştır; uygulama in-memory çalışır.
 */
import { genId, memdb, nowIso, persist } from "./store";
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

/* ─── Helpers ──────────────────────────────────────────────── */

const DEMO_USER_ID = "demo_user_finans";

function defaultUser(userId: string): UserProfile {
  const isDemo = userId === DEMO_USER_ID;
  return {
    userId,
    name: isDemo ? "Demo Kullanıcı" : "Misafir",
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
    persist();
  }
  return u;
}

export async function updateUser(
  userId: string,
  patch: Partial<UserProfile>,
): Promise<UserProfile> {
  const cur = await getOrCreateUser(userId);
  const next: UserProfile = { ...cur, ...patch, updatedAt: nowIso() };
  memdb.users.set(userId, next);
  persist();
  return next;
}

/* ─── Transactions ─────────────────────────────────────────── */

export async function listTransactions(userId: string): Promise<Transaction[]> {
  return memdb.transactions
    .filter((t) => t.userId === userId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export async function addTransaction(
  tx: Omit<Transaction, "_id">,
): Promise<Transaction> {
  const row: Transaction = { ...tx, _id: genId() };
  memdb.transactions.push(row);
  persist();
  return row;
}

export async function updateTransaction(
  userId: string,
  id: string,
  patch: Partial<Omit<Transaction, "_id" | "userId">>,
): Promise<Transaction | null> {
  const idx = memdb.transactions.findIndex(
    (t) => t._id === id && t.userId === userId,
  );
  if (idx === -1) return null;
  memdb.transactions[idx] = { ...memdb.transactions[idx], ...patch };
  persist();
  return memdb.transactions[idx];
}

export async function deleteTransaction(
  userId: string,
  id: string,
): Promise<boolean> {
  const before = memdb.transactions.length;
  memdb.transactions = memdb.transactions.filter(
    (t) => !(t._id === id && t.userId === userId),
  );
  const changed = memdb.transactions.length < before;
  if (changed) persist();
  return changed;
}

export async function resetUserData(userId: string): Promise<void> {
  memdb.transactions = memdb.transactions.filter((t) => t.userId !== userId);
  memdb.messages = memdb.messages.filter((m) => m.userId !== userId);
  memdb.sessions = memdb.sessions.filter((s) => s.userId !== userId);
  memdb.wishlist = memdb.wishlist.filter((w) => w.userId !== userId);
  memdb.subscriptions = memdb.subscriptions.filter((s) => s.userId !== userId);
  memdb.assets = memdb.assets.filter((a) => a.userId !== userId);
  memdb.incomes = memdb.incomes.filter((i) => i.userId !== userId);
  // Reset sonrası kullanıcı tekrar seed edilebilsin
  memdb.seededUsers.delete(userId);
  persist();
}

/* ─── Seed Demo Data ───────────────────────────────────────── */

export async function seedTransactionsIfEmpty(userId: string) {
  const existing = await listTransactions(userId);
  if (existing.length > 0) return;

  const today = new Date();
  const v = (n: number) => Math.round(n * (0.85 + Math.random() * 0.3));
  const samples: Omit<Transaction, "_id">[] = [];

  /** Her ay için temel tekrar eden harcamalar */
  for (let m = 11; m >= 0; m--) {
    // ── Gelirler ──
    samples.push({
      userId, type: "gelir", category: "Diğer", amount: 25000,
      note: "Maaş", date: monthAgo(today, m, 1).toISOString(),
    });
    
    // Freelance ve ek gelirler
    if (m % 3 === 0) {
      samples.push({
        userId, type: "gelir", category: "Diğer", amount: v(2500),
        note: "Freelance proje ödemesi", date: monthAgo(today, m, 18).toISOString(),
      });
    }
    if (m % 4 === 2) {
      samples.push({
        userId, type: "gelir", category: "Diğer", amount: v(1800),
        note: "Danışmanlık ücreti", date: monthAgo(today, m, 22).toISOString(),
      });
    }
    
    // Yatırım gelirleri (temettü, faiz)
    if (m === 2) {
      samples.push({
        userId, type: "gelir", category: "Yatırım", amount: 3200,
        note: "THYAO temettü geliri", date: monthAgo(today, m, 15).toISOString(),
      });
    }
    if (m === 8) {
      samples.push({
        userId, type: "gelir", category: "Yatırım", amount: 2850,
        note: "GARAN temettü geliri", date: monthAgo(today, m, 20).toISOString(),
      });
    }
    if (m % 6 === 1) {
      samples.push({
        userId, type: "gelir", category: "Yatırım", amount: v(450),
        note: "Mevduat faiz geliri", date: monthAgo(today, m, 25).toISOString(),
      });
    }
    
    // Diğer ek gelirler
    if (m % 5 === 1) {
      samples.push({
        userId, type: "gelir", category: "Diğer", amount: v(650),
        note: "İkinci el eşya satışı", date: monthAgo(today, m, 12).toISOString(),
      });
    }
    if (m === 0 || m === 5) { // Yılın belirli ayları
      samples.push({
        userId, type: "gelir", category: "Diğer", amount: v(1200),
        note: "Hediye + harçlık geliri", date: monthAgo(today, m, 8).toISOString(),
      });
    }

    // ── Sabit Giderler ──
    samples.push(
      { userId, type: "gider", category: "Kira/Fatura", amount: 7500,
        note: "Kira", date: monthAgo(today, m, 2).toISOString() },
      { userId, type: "gider", category: "Kira/Fatura", amount: v(950),
        note: "Elektrik + doğalgaz", date: monthAgo(today, m, 4).toISOString() },
      { userId, type: "gider", category: "Kira/Fatura", amount: v(380),
        note: "Türk Telekom internet", date: monthAgo(today, m, 5).toISOString() },
      { userId, type: "gider", category: "Kira/Fatura", amount: 190,
        note: "Vodafone cep faturası", date: monthAgo(today, m, 10).toISOString() },
      { userId, type: "gider", category: "Kira/Fatura", amount: v(280),
        note: "Su faturası", date: monthAgo(today, m, 12).toISOString() },
    );

    // ── Market & Gıda (haftalık + ekstra) ──
    samples.push(
      { userId, type: "gider", category: "Gıda", amount: v(1400),
        note: "Migros - haftalık market", date: monthAgo(today, m, 3).toISOString() },
      { userId, type: "gider", category: "Gıda", amount: v(1100),
        note: "BİM + A101 market", date: monthAgo(today, m, 10).toISOString() },
      { userId, type: "gider", category: "Gıda", amount: v(900),
        note: "CarrefourSA haftalık alışveriş", date: monthAgo(today, m, 17).toISOString() },
      { userId, type: "gider", category: "Gıda", amount: v(1200),
        note: "Migros - ay sonu market", date: monthAgo(today, m, 24).toISOString() },
      // Ek gıda harcamaları
      { userId, type: "gider", category: "Gıda", amount: v(180),
        note: "Bakkal - acil alışveriş", date: monthAgo(today, m, 6).toISOString() },
      { userId, type: "gider", category: "Gıda", amount: v(320),
        note: "Kasap - et ve tavuk", date: monthAgo(today, m, 14).toISOString() },
      { userId, type: "gider", category: "Gıda", amount: v(95),
        note: "Manav - meyve sebze", date: monthAgo(today, m, 21).toISOString() },
      { userId, type: "gider", category: "Gıda", amount: v(140),
        note: "Kuruyemiş + çerez", date: monthAgo(today, m, 28).toISOString() },
    );

    // ── Dışarıda Yemek & Sosyal Etkinlikler ──
    samples.push(
      { userId, type: "gider", category: "Gıda", amount: v(320),
        note: "Getir yemek siparişi", date: monthAgo(today, m, 7).toISOString() },
      { userId, type: "gider", category: "Gıda", amount: v(450),
        note: "Restoran - arkadaş buluşması", date: monthAgo(today, m, 14).toISOString() },
      { userId, type: "gider", category: "Eğlence", amount: v(180),
        note: "Kahve + tatlı (Starbucks)", date: monthAgo(today, m, 8).toISOString() },
      { userId, type: "gider", category: "Eğlence", amount: v(250),
        note: "Sinema bileti + patlamış mısır", date: monthAgo(today, m, 16).toISOString() },
      { userId, type: "gider", category: "Eğlence", amount: v(380),
        note: "Bowling + arkadaşlarla eğlence", date: monthAgo(today, m, 22).toISOString() },
    );

    // ── Ulaşım & Araç Masrafları ──
    samples.push(
      { userId, type: "gider", category: "Ulaşım", amount: v(380),
        note: "İstanbulkart dolum", date: monthAgo(today, m, 2).toISOString() },
      { userId, type: "gider", category: "Ulaşım", amount: v(350),
        note: "Akaryakıt (BP)", date: monthAgo(today, m, 9).toISOString() },
      { userId, type: "gider", category: "Ulaşım", amount: v(120),
        note: "Uber / BiTaksi", date: monthAgo(today, m, 20).toISOString() },
      { userId, type: "gider", category: "Ulaşım", amount: v(85),
        note: "Otopark ücret (AVM)", date: monthAgo(today, m, 15).toISOString() },
      { userId, type: "gider", category: "Ulaşım", amount: v(45),
        note: "Köprü geçiş ücreti", date: monthAgo(today, m, 25).toISOString() },
    );
    // Araç bakım masrafları (birkaç ayda bir)
    if (m % 4 === 0) {
      samples.push({
        userId, type: "gider", category: "Ulaşım", amount: 1200,
        note: "Araç bakım + yağ değişimi", date: monthAgo(today, m, 18).toISOString(),
      });
    }

    // ── Abonelikler (dijital) ──
    samples.push(
      { userId, type: "gider", category: "Eğlence", amount: 99,
        note: "Netflix", date: monthAgo(today, m, 3).toISOString() },
      { userId, type: "gider", category: "Eğlence", amount: 60,
        note: "Spotify Premium", date: monthAgo(today, m, 5).toISOString() },
      { userId, type: "gider", category: "Eğlence", amount: 80,
        note: "YouTube Premium", date: monthAgo(today, m, 8).toISOString() },
      { userId, type: "gider", category: "Sağlık", amount: 450,
        note: "MacFit spor salonu", date: monthAgo(today, m, 1).toISOString() },
    );

    // ── Eğlence (değişken) ──
    samples.push(
      { userId, type: "gider", category: "Eğlence", amount: v(350),
        note: m % 2 === 0 ? "Sinema + patlamış mısır" : "Konser bileti",
        date: monthAgo(today, m, 13).toISOString() },
    );

    // ── Alışveriş & Kişisel Harcamalar ──
    samples.push(
      { userId, type: "gider", category: "Alışveriş", amount: v(850),
        note: m % 2 === 0 ? "Trendyol kıyafet" : "Zara mağaza",
        date: monthAgo(today, m, 16).toISOString() },
      { userId, type: "gider", category: "Alışveriş", amount: v(320),
        note: "Ayakkabı + çorap (Flo)", date: monthAgo(today, m, 11).toISOString() },
      { userId, type: "gider", category: "Alışveriş", amount: v(180),
        note: "Kozmetik + kişisel bakım", date: monthAgo(today, m, 19).toISOString() },
      { userId, type: "gider", category: "Alışveriş", amount: v(95),
        note: "Telefon aksesuarı + kılıf", date: monthAgo(today, m, 26).toISOString() },
      { userId, type: "gider", category: "Alışveriş", amount: v(140),
        note: "Ev temizlik malzemesi", date: monthAgo(today, m, 13).toISOString() },
      { userId, type: "gider", category: "Alışveriş", amount: v(65),
        note: "Kırtasiye + kitap", date: monthAgo(today, m, 27).toISOString() },
    );

    // ── Sağlık ──
    samples.push(
      { userId, type: "gider", category: "Sağlık", amount: v(280),
        note: "Eczane - vitamin/ilaç", date: monthAgo(today, m, 21).toISOString() },
    );

    // ── Kişisel Bakım & Sağlık ──
    samples.push(
      { userId, type: "gider", category: "Sağlık", amount: v(420),
        note: "Kuaför / berber + bakım",
        date: monthAgo(today, m, 19).toISOString() },
      { userId, type: "gider", category: "Sağlık", amount: v(150),
        note: "Diş fırçası + ağız bakım", date: monthAgo(today, m, 4).toISOString() },
    );
    // Doktor ziyaretleri (birkaç ayda bir)
    if (m % 3 === 1) {
      samples.push({
        userId, type: "gider", category: "Sağlık", amount: 800,
        note: "Doktor muayene + tahlil", date: monthAgo(today, m, 12).toISOString(),
      });
    }
    if (m % 6 === 0) {
      samples.push({
        userId, type: "gider", category: "Sağlık", amount: 1500,
        note: "Diş kontrolü + tedavi", date: monthAgo(today, m, 20).toISOString(),
      });
    }

    // ── Evcil Hayvan (aylık - 2 ayda 1 veteriner) ──
    samples.push(
      { userId, type: "gider", category: "Diğer", amount: v(380),
        note: "Mama + tasma + ödül (köpek)",
        date: monthAgo(today, m, 11).toISOString() },
    );
    if (m % 2 === 0) {
      samples.push({
        userId, type: "gider", category: "Sağlık", amount: v(620),
        note: "Veteriner muayene + aşı",
        date: monthAgo(today, m, 23).toISOString(),
      });
    }

    // ── Bağış / Sosyal Sorumluluk (aylık küçük) ──
    samples.push(
      { userId, type: "gider", category: "Diğer", amount: 200,
        note: "Kızılay aylık bağış",
        date: monthAgo(today, m, 1).toISOString() },
    );

    // ── Dürtüsel Gece Harcamaları (Finansal Ayna için) ──
    // Perşembe & Cumartesi geceleri dürtüsel alışveriş
    if (m <= 3) {
      const nightDate = monthAgo(today, m, 11); // Perşembe civarı
      nightDate.setHours(23, 30, 0);
      samples.push({
        userId, type: "gider", category: "Alışveriş", amount: v(680),
        note: "Trendyol gece siparişi", date: nightDate.toISOString(),
      });
    }
    if (m <= 2) {
      const weekendNight = monthAgo(today, m, 6); // Cumartesi
      weekendNight.setHours(1, 15, 0);
      samples.push({
        userId, type: "gider", category: "Gıda", amount: v(250),
        note: "Yemeksepeti gece siparişi", date: weekendNight.toISOString(),
      });
    }

    // ── Eğitim (2 ayda 1) ──
    if (m % 2 === 0) {
      samples.push({
        userId, type: "gider", category: "Eğitim", amount: v(450),
        note: "Udemy online kurs", date: monthAgo(today, m, 22).toISOString(),
      });
    }

    // ── Yatırım (bu ay) ──
    if (m === 0) {
      samples.push(
        { userId, type: "gider", category: "Yatırım", amount: 2000,
          note: "Vadeli mevduat transferi", date: monthAgo(today, 0, 8).toISOString() },
        { userId, type: "gider", category: "Yatırım", amount: 500,
          note: "BES katkı payı", date: monthAgo(today, 0, 1).toISOString() },
      );
    }

    // ── Hafta sonu sosyal harcamalar ──
    samples.push(
      { userId, type: "gider", category: "Eğlence", amount: v(280),
        note: m % 2 === 0 ? "Cafe buluşması" : "Kahve + tatlı",
        date: monthAgo(today, m, 20).toISOString() },
    );

    // ── Ekstra değişken harcamalar (ay bazlı / mevsimsel) ──
    if (m === 4) { // Bayram ayı
      samples.push(
        { userId, type: "gider", category: "Alışveriş", amount: 3200,
          note: "Bayram hediye alışverişi", date: monthAgo(today, 4, 25).toISOString() },
        { userId, type: "gider", category: "Ulaşım", amount: 1800,
          note: "Bayram tatili otobüs bileti", date: monthAgo(today, 4, 26).toISOString() },
      );
    }
    if (m === 1) { // Teknoloji alımı
      samples.push({
        userId, type: "gider", category: "Alışveriş", amount: 4500,
        note: "iPad taksit ödemesi (2/6)", date: monthAgo(today, 1, 15).toISOString(),
      });
    }
    if (m === 3) { // Sağlık
      samples.push({
        userId, type: "gider", category: "Sağlık", amount: 1200,
        note: "Diş tedavisi", date: monthAgo(today, 3, 18).toISOString(),
      });
    }
    // ── Mevsimsel harcamalar (12 aylık genişletme) ──
    if (m === 7) { // Yaz tatili
      samples.push(
        { userId, type: "gider", category: "Eğlence", amount: 8500,
          note: "Antalya tatil otel rezervasyonu", date: monthAgo(today, 7, 10).toISOString() },
        { userId, type: "gider", category: "Ulaşım", amount: 2200,
          note: "Uçak bileti (gidiş-dönüş)", date: monthAgo(today, 7, 8).toISOString() },
      );
    }
    if (m === 9) { // Okul/kurs dönemi
      samples.push(
        { userId, type: "gider", category: "Eğitim", amount: 3500,
          note: "Udemy + Coursera kurs paketi", date: monthAgo(today, 9, 5).toISOString() },
      );
    }
    if (m === 11) { // Kış - artan faturalar
      samples.push(
        { userId, type: "gider", category: "Kira/Fatura", amount: v(650),
          note: "Ekstra doğalgaz (kış)", date: monthAgo(today, 11, 20).toISOString() },
      );
    }
    if (m === 10) { // Yılbaşı alışverişi
      samples.push(
        { userId, type: "gider", category: "Alışveriş", amount: 2800,
          note: "Yılbaşı hediye alışverişi", date: monthAgo(today, 10, 28).toISOString() },
      );
    }

    // ── Yıllık Sigorta & Vergiler ────────────────────────────
    if (m === 5) {
      samples.push(
        { userId, type: "gider", category: "Diğer", amount: 7800,
          note: "Kasko sigortası yenilemesi",
          date: monthAgo(today, 5, 14).toISOString() },
        { userId, type: "gider", category: "Diğer", amount: 1450,
          note: "Trafik sigortası",
          date: monthAgo(today, 5, 14).toISOString() },
        { userId, type: "gider", category: "Diğer", amount: 480,
          note: "DASK zorunlu deprem sigortası",
          date: monthAgo(today, 5, 15).toISOString() },
      );
    }
    if (m === 6) {
      samples.push({
        userId, type: "gider", category: "Diğer", amount: 2350,
        note: "Motorlu taşıtlar vergisi (1. taksit)",
        date: monthAgo(today, 6, 25).toISOString(),
      });
    }
    if (m === 0) {
      samples.push({
        userId, type: "gider", category: "Diğer", amount: 2350,
        note: "Motorlu taşıtlar vergisi (2. taksit)",
        date: monthAgo(today, 0, 25).toISOString(),
      });
    }
    if (m === 8) {
      samples.push({
        userId, type: "gider", category: "Sağlık", amount: 1850,
        note: "Tamamlayıcı sağlık sigortası yenileme",
        date: monthAgo(today, 8, 12).toISOString(),
      });
    }
  }

  for (const s of samples) await addTransaction(s);
}

/* ─── Demo Wishlist Seed ───────────────────────────────────── */

export async function seedWishlistIfEmpty(userId: string) {
  const existing = await listWishlistItems(userId);
  if (existing.length > 0) return;

  const now = new Date();
  const daysAgo = (n: number) =>
    new Date(now.getTime() - n * 86_400_000).toISOString();

  const samples: Omit<WishlistItem, "_id" | "createdAt">[] = [
    // ═══ GERÇEK TRENDYOL ÜRÜNLERİ ════════════════════════════
    {
      userId,
      name: "Madame Coco Klimalı Yastık Beyaz / Açık Gri 50x70 cm",
      brand: "Madame Coco",
      siteName: "Trendyol",
      url: "https://www.trendyol.com/madame-coco/klimali-yastik-beyaz-acik-gri-50x70-cm-p-51738600",
      description: "Klima etkili, nefes alabilir yastık. Serin uyku deneyimi sunan özel kumaş teknolojisi. 50x70 cm.",
      price: 299,
      originalPrice: 449,
      priceHistory: [
        { date: daysAgo(30), price: 449 },
        { date: daysAgo(15), price: 349 },
        { date: daysAgo(3), price: 299 },
      ],
      lastCheckedAt: daysAgo(1),
      priceAlerts: true,
      category: "Alışveriş",
      priority: 3,
      urgency: "ihtiyaç",
      status: "wishlist",
      note: "Yaz sıcağında rahat uyumak için, klimalı yastık çok iyi olabilir.",
      aiAnalysis: "Fiyat son 1 ayda %33 düştü. Yaz ayları için ideal zamanlama. Bütçe dostu bir ürün.",
      aiVerdict: "buy_now",
    },
    {
      userId,
      name: "Reflex Plus Twix Tavuklu ve Dana Etli Çiğneme Çubukları 80gr",
      brand: "Reflex",
      siteName: "Trendyol",
      url: "https://www.trendyol.com/reflex/plus-twix-tavuklu-ve-dana-etli-cigneme-cubuklari-yetiskin-kopek-odulu-80-gr-p-1054077442",
      description: "Yetişkin köpek ödülü. Tavuklu ve dana etli çiğneme çubukları, 80 gram paket.",
      price: 44,
      originalPrice: 55,
      priceHistory: [
        { date: daysAgo(14), price: 55 },
        { date: daysAgo(5), price: 44 },
      ],
      lastCheckedAt: daysAgo(1),
      priceAlerts: false,
      category: "Diğer",
      priority: 4,
      urgency: "ihtiyaç",
      status: "wishlist",
      note: "Köpek için düzenli alınan ödül çubuğu. Stoklarda bitebilir.",
    },
    {
      userId,
      name: "iCollagen Kolajen ve Prebiyotik Tablet",
      brand: "iCollagen",
      siteName: "Trendyol",
      url: "https://www.trendyol.com/icollagen/kolajen-ve-prebiyotik-tablet-p-752356123",
      description: "Kolajen peptitleri ve prebiyotik içeren takviye edici gıda tablet formu. Cilt, eklem ve bağırsak sağlığı.",
      price: 349,
      originalPrice: 449,
      priceHistory: [
        { date: daysAgo(20), price: 449 },
        { date: daysAgo(10), price: 399 },
        { date: daysAgo(2), price: 349 },
      ],
      lastCheckedAt: daysAgo(1),
      priceAlerts: true,
      category: "Sağlık",
      priority: 3,
      urgency: "istek",
      status: "wishlist",
      note: "Sağlık için düzenli kullanmayı düşünüyorum, aylık maliyet hesapla.",
      aiAnalysis: "Aylık ~₺349 maliyet, bütçenin %1.4'ü. Sağlık yatırımı olarak makul. Fiyat trend düşüşte.",
      aiVerdict: "buy_now",
    },
    {
      userId,
      name: "Anadolu Saray Üçgen Mop 360° Döner Cam ve Zemin Temizleme Seti + 2 Bez",
      brand: "Anadolu Saray",
      siteName: "Trendyol",
      url: "https://www.trendyol.com/anadolu-saray/kendinden-sikmali-ucgen-mop-360-doner-cam-ve-zemin-temizleme-seti-2-bez-p-1134581980",
      description: "Kendinden sıkmalı üçgen mop, 360 derece dönebilen başlık, cam ve zemin temizleme seti. 2 adet yedek bez dahil.",
      price: 189,
      originalPrice: 259,
      priceHistory: [
        { date: daysAgo(25), price: 259 },
        { date: daysAgo(8), price: 199 },
        { date: daysAgo(1), price: 189 },
      ],
      lastCheckedAt: daysAgo(1),
      priceAlerts: false,
      category: "Alışveriş",
      priority: 4,
      urgency: "ihtiyaç",
      status: "wishlist",
      note: "Mevcut mop çok eski, bu model sıkma sistemi ile çok pratik görünüyor.",
    },
    {
      userId,
      name: "Clewax 14 Parça Premium Araç Motorsiklet Yıkama ve Bakım Seti",
      brand: "Clewax",
      siteName: "Trendyol",
      url: "https://www.trendyol.com/clewax/14-parca-premium-arac-motorsiklet-yikama-ve-bakim-seti-p-967708759?boutiqueId=61&merchantId=1126238",
      description: "14 parçalık profesyonel araç bakım seti: şampuan, cila, jant temizleyici, mikrofiber bez seti, detaylı temizlik araçları.",
      price: 549,
      originalPrice: 749,
      priceHistory: [
        { date: daysAgo(30), price: 749 },
        { date: daysAgo(14), price: 649 },
        { date: daysAgo(3), price: 549 },
      ],
      lastCheckedAt: daysAgo(1),
      priceAlerts: true,
      category: "Alışveriş",
      priority: 2,
      urgency: "istek",
      status: "wishlist",
      note: "Araç bakımını kendin yapmak için tam set. İndirimdeyken almak mantıklı.",
      aiAnalysis: "₺549'a 14 parça → parça başı ₺39. Tek tek almaktan %40 daha ekonomik. Fiyat %27 düştü, iyi fırsat.",
      aiVerdict: "buy_now",
    },

    // ═══ EK ZENGİN ÜRÜNLER ════════════════════════════════════
    {
      userId,
      name: "iPhone 15 Pro 256GB Titanyum",
      brand: "Apple",
      siteName: "Apple Türkiye",
      url: "https://www.apple.com/tr/shop/buy-iphone/iphone-15-pro",
      description: "A17 Pro çip, 6.1 inç Super Retina XDR ekran, ProMotion 120Hz, USB-C, gelişmiş kamera sistemi.",
      price: 84999,
      originalPrice: 89999,
      priceHistory: [
        { date: daysAgo(20), price: 89999 },
        { date: daysAgo(10), price: 87499 },
        { date: daysAgo(2), price: 84999 },
      ],
      lastCheckedAt: daysAgo(2),
      priceAlerts: true,
      category: "Alışveriş",
      priority: 4,
      urgency: "istek",
      status: "wishlist",
      note: "Mevcut iPhone 12 yavaşladı, kamera için almayı düşünüyorum.",
    },
    {
      userId,
      name: "Sony WH-1000XM5 Kablosuz Kulaklık",
      brand: "Sony",
      siteName: "Hepsiburada",
      url: "https://www.hepsiburada.com",
      description: "Endüstri lideri gürültü engelleme, 30 saat pil, multipoint bağlantı, hızlı şarj.",
      price: 12499,
      originalPrice: 13999,
      priceHistory: [
        { date: daysAgo(15), price: 13999 },
        { date: daysAgo(7), price: 13299 },
        { date: daysAgo(1), price: 12499 },
      ],
      lastCheckedAt: daysAgo(1),
      priceAlerts: true,
      category: "Alışveriş",
      priority: 3,
      urgency: "hobi",
      status: "wishlist",
      note: "Uzaktan çalışma için ihtiyacım var.",
      aiAnalysis: "Fiyat son 2 haftada %11 düştü — şu an alım için iyi bir zaman olabilir. Ancak bütçenin %5'ini buluyor.",
      aiVerdict: "wait",
    },
    {
      userId,
      name: "Dyson Airwrap Multi-Styler",
      brand: "Dyson",
      siteName: "Trendyol",
      url: "https://www.trendyol.com",
      description: "Coanda efekti ile saç şekillendirici. Kurutma, şekil verme ve düzleştirme tek bir cihazda.",
      price: 18990,
      originalPrice: 21990,
      priceHistory: [
        { date: daysAgo(40), price: 21990 },
        { date: daysAgo(20), price: 19990 },
        { date: daysAgo(5), price: 18990 },
      ],
      lastCheckedAt: daysAgo(3),
      priceAlerts: true,
      category: "Alışveriş",
      priority: 1,
      urgency: "istek",
      status: "wishlist",
      note: "Hediye olarak düşünüyorum. Çok pahalı ama kaliteli.",
      aiVerdict: "wait",
    },
    {
      userId,
      name: "Nike Pegasus 41 Koşu Ayakkabısı",
      brand: "Nike",
      siteName: "Nike Türkiye",
      url: "https://www.nike.com/tr",
      description: "ReactX köpük teknolojisi, Air Zoom, geliştirilmiş yastıklama. Günlük koşu için ideal.",
      price: 4799,
      originalPrice: 4799,
      priceHistory: [{ date: daysAgo(3), price: 4799 }],
      lastCheckedAt: daysAgo(3),
      priceAlerts: true,
      category: "Sağlık",
      priority: 3,
      urgency: "istek",
      status: "wishlist",
      note: "Sabah koşuları için. Mevcut ayakkabı 2 yaşında.",
    },
    {
      userId,
      name: "Samsung Galaxy Buds FE",
      brand: "Samsung",
      siteName: "Hepsiburada",
      url: "https://www.hepsiburada.com",
      description: "ANC gürültü engelleme, IPX2 su dayanıklılığı, 30 saat pil ömrü, Galaxy ekosistemi entegrasyonu.",
      price: 2199,
      originalPrice: 2799,
      priceHistory: [
        { date: daysAgo(20), price: 2799 },
        { date: daysAgo(7), price: 2199 },
      ],
      lastCheckedAt: daysAgo(2),
      priceAlerts: true,
      category: "Alışveriş",
      priority: 3,
      urgency: "hobi",
      status: "wishlist",
      note: "Spor yaparken müzik dinlemek için kablosuz kulaklık.",
    },
    {
      userId,
      name: "Udemy: Tam Yığın Web Geliştirme Kursu",
      siteName: "Udemy",
      url: "https://www.udemy.com",
      description: "React, Node.js, PostgreSQL, Docker. 60 saat video, sertifika dahil.",
      price: 459,
      originalPrice: 1299,
      priceHistory: [
        { date: daysAgo(30), price: 1299 },
        { date: daysAgo(7), price: 459 },
      ],
      lastCheckedAt: daysAgo(7),
      priceAlerts: true,
      category: "Eğitim",
      priority: 4,
      urgency: "ihtiyaç",
      status: "wishlist",
      note: "Kariyer geçişi için. İndirim %65, kaçırma!",
    },
    {
      userId,
      name: "IKEA Markus Ofis Sandalyesi",
      brand: "IKEA",
      siteName: "IKEA Türkiye",
      url: "https://www.ikea.com.tr",
      description: "Ergonomik bel desteği, ayarlanabilir kol, 10 yıl garanti. Uzun çalışma seansları için tasarlandı.",
      price: 13990,
      originalPrice: 13990,
      priceHistory: [{ date: daysAgo(10), price: 13990 }],
      lastCheckedAt: daysAgo(10),
      priceAlerts: true,
      category: "Alışveriş",
      priority: 2,
      urgency: "istek",
      status: "wishlist",
      note: "Bel ağrısı için ergonomik sandalye lazım.",
    },

    // ═══ GEÇMİŞTE SATIN ALINANLAR ════════════════════════════
    {
      userId,
      name: "Kindle Paperwhite (11. Nesil)",
      brand: "Amazon",
      siteName: "Amazon TR",
      price: 4299,
      purchasedPrice: 3899,
      purchasedAt: daysAgo(45),
      category: "Eğitim",
      priority: 4,
      urgency: "istek",
      status: "purchased",
      note: "Bekledim ve indirimli aldım! 💪",
    },
    {
      userId,
      name: "MacBook için USB-C Hub 7in1",
      brand: "Baseus",
      siteName: "Trendyol",
      price: 899,
      purchasedPrice: 749,
      purchasedAt: daysAgo(20),
      category: "Alışveriş",
      priority: 5,
      urgency: "ihtiyaç",
      status: "purchased",
    },
    {
      userId,
      name: "PS5 DualSense Kablosuz Oyun Kolu — Midnight Black",
      brand: "Sony",
      siteName: "MediaMarkt",
      price: 2499,
      purchasedPrice: 2199,
      purchasedAt: daysAgo(60),
      category: "Eğlence",
      priority: 2,
      urgency: "hobi",
      status: "purchased",
      note: "İndirim döneminde aldım, çok memnunum.",
    },

    // ═══ YENİ GERÇEK ÜRÜNLER — Hepsiburada, Udemy, D&R, Amazon ═══
    {
      userId,
      name: "Madame Coco Diamanta 5 Parça Kapaklı Karaf Seti — Şeffaf",
      brand: "Madame Coco",
      siteName: "Hepsiburada",
      url: "https://www.hepsiburada.com/madame-coco-diamanta-5-parca-kapakli-karaf-seti-seffaf-p-HBCV0000D9RFQH",
      description: "Cam karaf ve 4 bardak seti. Misafir ağırlama için şık ve pratik. Kapaklı tasarım.",
      price: 899,
      originalPrice: 1299,
      priceHistory: [{ date: daysAgo(20), price: 1299 }, { date: daysAgo(8), price: 999 }, { date: daysAgo(1), price: 899 }],
      lastCheckedAt: daysAgo(1),
      priceAlerts: true,
      category: "Alışveriş",
      priority: 3,
      urgency: "istek",
      status: "wishlist",
      note: "Mutfak için güzel bir set, misafirler için ideal.",
    },
    {
      userId,
      name: "English Home Daylora 4'lü Kahve Fincan Takımı",
      brand: "English Home",
      siteName: "Hepsiburada",
      url: "https://www.hepsiburada.com/english-home-daylora-4-lu-porselen-kahve-fincani-takimi",
      description: "Porselen, 4 fincan + tabak seti. Zarif tasarım, günlük ve misafir kullanımına uygun.",
      price: 349,
      priceHistory: [{ date: daysAgo(14), price: 399 }, { date: daysAgo(5), price: 349 }],
      lastCheckedAt: daysAgo(2),
      priceAlerts: true,
      category: "Alışveriş",
      priority: 2,
      urgency: "istek",
      status: "wishlist",
    },
    {
      userId,
      name: "Derin Öğrenme — A'dan Z'ye Python ile Deep Learning Bootcamp",
      brand: "Udemy",
      siteName: "Udemy",
      url: "https://www.udemy.com/course/derin-ogrenme-bootcamp/",
      description: "Python, TensorFlow, Keras ile sinir ağları, CNN, RNN, GAN. 40+ saat kapsamlı bootcamp.",
      price: 449,
      originalPrice: 799,
      priceHistory: [{ date: daysAgo(30), price: 799 }, { date: daysAgo(10), price: 449 }],
      lastCheckedAt: daysAgo(3),
      priceAlerts: true,
      category: "Eğitim",
      priority: 5,
      urgency: "ihtiyaç",
      status: "wishlist",
      note: "Kariyer geliştirme — AI/ML alanında kendimi geliştirmek istiyorum.",
    },
    {
      userId,
      name: "LangChain & LangGraph ile AI Agent Geliştirme Kursu",
      brand: "Udemy",
      siteName: "Udemy",
      url: "https://www.udemy.com/course/langchain-langgraph-ile-ai-agent/",
      description: "LLM tabanlı agent sistemleri kurma. RAG, tool calling, multi-agent workflow.",
      price: 399,
      originalPrice: 699,
      priceHistory: [{ date: daysAgo(20), price: 699 }, { date: daysAgo(5), price: 399 }],
      lastCheckedAt: daysAgo(2),
      priceAlerts: false,
      category: "Eğitim",
      priority: 5,
      urgency: "ihtiyaç",
      status: "wishlist",
      note: "Hackathon projesi için çok faydalı olacak, agent mimarisi öğrenmek istiyorum.",
    },
    {
      userId,
      name: "Aşk ve Gurur — Jane Austen",
      brand: "D&R",
      siteName: "D&R",
      url: "https://www.dr.com.tr/kitap/ask-ve-gurur/jane-austen/edebiyat/roman/dunya-klasik/urunno=0001803694001",
      description: "Dünya klasiklerinden Jane Austen'ın ölümsüz aşk romanı. Türkçe çeviri.",
      price: 89,
      priceHistory: [{ date: daysAgo(30), price: 89 }],
      lastCheckedAt: daysAgo(5),
      priceAlerts: false,
      category: "Eğitim",
      priority: 2,
      urgency: "hobi",
      status: "wishlist",
    },
    {
      userId,
      name: "Suç ve Ceza — Fyodor Dostoyevski",
      brand: "D&R",
      siteName: "D&R",
      url: "https://www.dr.com.tr/kitap/suc-ve-ceza/fyodor-m-dostoyevski/edebiyat/roman/dunya-klasik/urunno=0000000064038",
      description: "Rus edebiyatının başyapıtı. Raskolnikov'un iç hesaplaşması.",
      price: 79,
      priceHistory: [{ date: daysAgo(30), price: 79 }],
      lastCheckedAt: daysAgo(5),
      priceAlerts: false,
      category: "Eğitim",
      priority: 2,
      urgency: "hobi",
      status: "wishlist",
    },
    {
      userId,
      name: "MSI GeForce RTX 5060 Ventus 2X Black OC 8GB",
      brand: "MSI",
      siteName: "Amazon",
      url: "https://www.amazon.pl/dp/B0F1Y5YDCP",
      description: "NVIDIA RTX 5060 ekran kartı, 8GB GDDR7. Yeni nesil ray tracing ve DLSS 4 desteği.",
      price: 18500,
      originalPrice: 21000,
      priceHistory: [{ date: daysAgo(14), price: 21000 }, { date: daysAgo(5), price: 18500 }],
      lastCheckedAt: daysAgo(3),
      priceAlerts: true,
      category: "Alışveriş",
      priority: 4,
      urgency: "istek",
      status: "wishlist",
      note: "PC upgrade — mevcut kartım 3 yaşında. PLN→TRY tahmini fiyat.",
    },
    {
      userId,
      name: "Jean Pierre Sand Gattina Pour Femme Parfüm 100ml",
      brand: "Jean Pierre Sand",
      siteName: "Amazon",
      url: "https://www.amazon.pl/dp/B00FRSXNMA",
      description: "Kadın parfümü, 100ml EDP. Zarif ve kalıcı koku.",
      price: 1800,
      priceHistory: [{ date: daysAgo(10), price: 1800 }],
      lastCheckedAt: daysAgo(4),
      priceAlerts: false,
      category: "Alışveriş",
      priority: 2,
      urgency: "istek",
      status: "wishlist",
      note: "Hediye alternatifi. PLN→TRY tahmini fiyat.",
    },
  ];

  for (const item of samples) {
    await addWishlistItem(item);
  }
}

/* ─── Demo Subscriptions Seed ──────────────────────────────── */

export async function seedSubscriptionsIfEmpty(userId: string) {
  const existing = await listSubscriptions(userId);
  if (existing.length > 0) return;

  const now = new Date();
  const inDays = (n: number) =>
    new Date(now.getTime() + n * 86_400_000).toISOString();

  const samples: Omit<Subscription, "_id" | "createdAt">[] = [
    {
      userId,
      name: "Netflix Premium",
      amount: 229,
      frequency: "aylık",
      category: "Eğlence",
      nextPaymentDate: inDays(12),
      active: true,
      note: "4K plan, aile ile paylaşım",
    },
    {
      userId,
      name: "Spotify Premium Family",
      amount: 119,
      frequency: "aylık",
      category: "Eğlence",
      nextPaymentDate: inDays(7),
      active: true,
      note: "6 hesap",
    },
    {
      userId,
      name: "YouTube Premium",
      amount: 79,
      frequency: "aylık",
      category: "Eğlence",
      nextPaymentDate: inDays(20),
      active: true,
    },
    {
      userId,
      name: "MacFit Spor Salonu",
      amount: 1299,
      frequency: "aylık",
      category: "Sağlık",
      nextPaymentDate: inDays(3),
      active: true,
      note: "Yıllık üyelik aylık taksit",
    },
    {
      userId,
      name: "iCloud+ 200GB",
      amount: 39,
      frequency: "aylık",
      category: "Diğer",
      nextPaymentDate: inDays(15),
      active: true,
    },
    {
      userId,
      name: "Domain & Hosting",
      amount: 1499,
      frequency: "yıllık",
      category: "Diğer",
      nextPaymentDate: inDays(120),
      active: true,
      note: "Kişisel web sitesi",
    },
    {
      userId,
      name: "Adobe Creative Suite",
      amount: 899,
      frequency: "aylık",
      category: "Eğitim",
      nextPaymentDate: inDays(25),
      active: true,
      note: "Photoshop, Illustrator, Premiere",
    },
    {
      userId,
      name: "GitHub Pro",
      amount: 49,
      frequency: "aylık",
      category: "Eğitim",
      nextPaymentDate: inDays(8),
      active: true,
      note: "Private repositories",
    },
    {
      userId,
      name: "ChatGPT Plus",
      amount: 299,
      frequency: "aylık",
      category: "Eğitim",
      nextPaymentDate: inDays(18),
      active: true,
      note: "GPT-4 erişimi",
    },
    {
      userId,
      name: "Microsoft 365 Family",
      amount: 129,
      frequency: "aylık",
      category: "Diğer",
      nextPaymentDate: inDays(22),
      active: true,
      note: "Office paketi + OneDrive",
    },
    {
      userId,
      name: "Amazon Prime",
      amount: 79,
      frequency: "aylık",
      category: "Alışveriş",
      nextPaymentDate: inDays(5),
      active: true,
      note: "Ücretsiz kargo + Prime Video",
    },
    {
      userId,
      name: "Coursera Plus",
      amount: 599,
      frequency: "yıllık",
      category: "Eğitim",
      nextPaymentDate: inDays(180),
      active: false,
      note: "Online kurs platformu - geçici durduruldu",
    },
    {
      userId,
      name: "Adobe Creative Cloud",
      amount: 1599,
      frequency: "aylık",
      category: "Eğitim",
      active: false,
      note: "Geçici olarak iptal ettim",
    },
    // ═══ YENİ ABONELİKLER ═════════════════════════════════════
    {
      userId,
      name: "Disney+",
      amount: 134,
      frequency: "aylık",
      category: "Eğlence",
      nextPaymentDate: inDays(18),
      active: true,
      note: "Marvel + Star Wars içerikleri",
    },
    {
      userId,
      name: "ChatGPT Plus",
      amount: 699,
      frequency: "aylık",
      category: "Eğitim",
      nextPaymentDate: inDays(5),
      active: true,
      note: "GPT-4o + DALL-E erişimi, iş için kullanıyorum",
    },
    {
      userId,
      name: "Amazon Prime Türkiye",
      amount: 39,
      frequency: "aylık",
      category: "Alışveriş",
      nextPaymentDate: inDays(9),
      active: true,
      note: "Hızlı kargo + Prime Video",
    },
    {
      userId,
      name: "Duolingo Plus",
      amount: 279,
      frequency: "aylık",
      category: "Eğitim",
      nextPaymentDate: inDays(22),
      active: true,
      note: "İngilizce + Almanca öğreniyorum",
    },
    {
      userId,
      name: "Xbox Game Pass Ultimate",
      amount: 339,
      frequency: "aylık",
      category: "Eğlence",
      nextPaymentDate: inDays(14),
      active: false,
      note: "Yazın oyun oynamıyorum, Eylül'de tekrar açacağım",
    },
    {
      userId,
      name: "Turkcell Superonline Fiber 100",
      amount: 599,
      frequency: "aylık",
      category: "Kira/Fatura",
      nextPaymentDate: inDays(2),
      active: true,
      note: "100 Mbps fiber internet, 24 ay taahhüt",
    },
    // ═══ EKSTRA ABONELİKLER (genişletilmiş demo) ══════════════
    {
      userId,
      name: "BluTV",
      amount: 89,
      frequency: "aylık",
      category: "Eğlence",
      nextPaymentDate: inDays(11),
      active: true,
      note: "Yerli dizi ve film içerikleri.",
    },
    {
      userId,
      name: "Audible Türkiye",
      amount: 64,
      frequency: "aylık",
      category: "Eğitim",
      nextPaymentDate: inDays(16),
      active: true,
      note: "Aylık 1 sesli kitap kredisi.",
    },
    {
      userId,
      name: "Notion Plus",
      amount: 290,
      frequency: "aylık",
      category: "Eğitim",
      nextPaymentDate: inDays(8),
      active: true,
      note: "Sınırsız blok, takım çalışması ve AI özellikleri.",
    },
    {
      userId,
      name: "Figma Professional",
      amount: 380,
      frequency: "aylık",
      category: "Eğitim",
      nextPaymentDate: inDays(19),
      active: true,
      note: "Tasarım çalışmaları için, yıllık ödemede %25 indirim mevcut.",
    },
    {
      userId,
      name: "GitHub Copilot",
      amount: 330,
      frequency: "aylık",
      category: "Eğitim",
      nextPaymentDate: inDays(6),
      active: true,
      note: "Yazılım geliştirme için AI asistanı.",
    },
    {
      userId,
      name: "Storytel",
      amount: 119,
      frequency: "aylık",
      category: "Eğitim",
      nextPaymentDate: inDays(24),
      active: false,
      note: "Çok dinlemediğim için iptal ettim, ihtiyaç olursa açabilirim.",
    },
    {
      userId,
      name: "iyzico Sanal POS",
      amount: 199,
      frequency: "aylık",
      category: "Diğer",
      nextPaymentDate: inDays(13),
      active: true,
      note: "Freelance ödemeler için sanal POS hizmeti.",
    },
    {
      userId,
      name: "Kasko Sigortası (Otomobil)",
      amount: 7800,
      frequency: "yıllık",
      category: "Diğer",
      nextPaymentDate: inDays(85),
      active: true,
      note: "Otomobil kaskosu, yenileme dönemi yaklaşıyor.",
    },
    {
      userId,
      name: "Tamamlayıcı Sağlık Sigortası",
      amount: 1850,
      frequency: "yıllık",
      category: "Sağlık",
      nextPaymentDate: inDays(150),
      active: true,
      note: "SGK ile birlikte özel hastane erişimi.",
    },
  ];

  for (const sub of samples) {
    await addSubscription(sub);
  }
}

/* ─── Demo Assets Seed ─────────────────────────────────────── */

export async function seedAssetsIfEmpty(userId: string) {
  const existing = await listAssets(userId);
  if (existing.length > 0) return;

  const now = nowIso();
  const samples: Omit<Asset, "_id">[] = [
    {
      userId,
      type: "altın",
      name: "Gram Altın",
      ticker: "XAU/TRY",
      quantity: 50,
      buyPrice: 2850,
      currentPrice: 3220,
      currentValue: 50 * 3220,
      currency: "TRY",
      note: "Uzun vadeli birikim, her ay 5-10 gram ekliyorum.",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "hisse",
      name: "Türk Hava Yolları",
      ticker: "THYAO",
      quantity: 200,
      buyPrice: 285,
      currentPrice: 312,
      currentValue: 200 * 312,
      currency: "TRY",
      note: "Temettü getirisi güçlü.",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "hisse",
      name: "Garanti Bankası",
      ticker: "GARAN",
      quantity: 500,
      buyPrice: 105,
      currentPrice: 118,
      currentValue: 500 * 118,
      currency: "TRY",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "döviz",
      name: "Amerikan Doları",
      ticker: "USD/TRY",
      quantity: 1500,
      buyPrice: 32.5,
      currentPrice: 38.2,
      currentValue: 1500 * 38.2,
      currency: "TRY",
      note: "Döviz biriktirme.",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "kripto",
      name: "Bitcoin",
      ticker: "BTC",
      quantity: 0.05,
      buyPrice: 2_800_000,
      currentPrice: 3_420_000,
      currentValue: 0.05 * 3_420_000,
      currency: "TRY",
      note: "Küçük bir pozisyon.",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "fon",
      name: "İş Bankası Karma Fon",
      ticker: "TMF",
      quantity: 1000,
      buyPrice: 2.45,
      currentPrice: 2.72,
      currentValue: 1000 * 2.72,
      currency: "TRY",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "hisse",
      name: "Koç Holding",
      ticker: "KCHOL",
      quantity: 150,
      buyPrice: 180,
      currentPrice: 195,
      currentValue: 150 * 195,
      currency: "TRY",
      note: "Sektör lideri, temettü kazancı yüksek",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "hisse",
      name: "Aselsan",
      ticker: "ASELS",
      quantity: 80,
      buyPrice: 95,
      currentPrice: 108,
      currentValue: 80 * 108,
      currency: "TRY",
      note: "Savunma sektörü yatırımı",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "döviz",
      name: "Euro",
      ticker: "EUR/TRY",
      quantity: 800,
      buyPrice: 35.8,
      currentPrice: 40.1,
      currentValue: 800 * 40.1,
      currency: "TRY",
      note: "Avrupa seyahati için biriktirme",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "mevduat",
      name: "Vadeli Mevduat (6 ay)",
      ticker: "TRY",
      quantity: 50000,
      buyPrice: 1,
      currentPrice: 1,
      currentValue: 50000,
      currency: "TRY",
      note: "%45 faizli vadeli hesap, 3 ay kaldı",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "altın",
      name: "Çeyrek Altın",
      ticker: "XAU/TRY",
      quantity: 12,
      buyPrice: 11500,
      currentPrice: 12850,
      currentValue: 12 * 12850,
      currency: "TRY",
      note: "Fiziki altın koleksiyonu",
      createdAt: now,
      updatedAt: now,
    },
    // ═══ YENİ VARLIKLAR ═══════════════════════════════════════
    {
      userId,
      type: "kripto",
      name: "Ethereum",
      ticker: "ETH",
      quantity: 1.2,
      buyPrice: 130_000,
      currentPrice: 148_500,
      currentValue: 1.2 * 148_500,
      currency: "TRY",
      note: "DeFi ekosistemi potansiyeli.",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "döviz",
      name: "Euro",
      ticker: "EUR/TRY",
      quantity: 800,
      buyPrice: 35.2,
      currentPrice: 41.5,
      currentValue: 800 * 41.5,
      currency: "TRY",
      note: "Avrupa tatili için biriktiriyorum.",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "altın",
      name: "Çeyrek Altın",
      ticker: "XAU/TRY",
      quantity: 8,
      buyPrice: 4800,
      currentPrice: 5350,
      currentValue: 8 * 5350,
      currency: "TRY",
      note: "Fiziki altın, kasada saklıyorum.",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "hisse",
      name: "Emlak Konut GYO",
      ticker: "EKGYO",
      quantity: 3000,
      buyPrice: 12.8,
      currentPrice: 14.5,
      currentValue: 3000 * 14.5,
      currency: "TRY",
      note: "Gayrimenkul sektörüne dolaylı yatırım.",
      createdAt: now,
      updatedAt: now,
    },
    // ═══ EKSTRA VARLIKLAR (genişletilmiş portföy) ═════════════
    {
      userId,
      type: "hisse",
      name: "ASELSAN",
      ticker: "ASELS",
      quantity: 250,
      buyPrice: 78,
      currentPrice: 92.4,
      currentValue: 250 * 92.4,
      currency: "TRY",
      note: "Savunma sanayi büyüme hikâyesi.",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "hisse",
      name: "Tüpraş",
      ticker: "TUPRS",
      quantity: 35,
      buyPrice: 142,
      currentPrice: 168.5,
      currentValue: 35 * 168.5,
      currency: "TRY",
      note: "Enerji sektörü, temettü potansiyeli yüksek.",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "hisse",
      name: "Apple Inc.",
      ticker: "AAPL",
      quantity: 5,
      buyPrice: 5800,
      currentPrice: 7250,
      currentValue: 5 * 7250,
      currency: "TRY",
      note: "Yurt dışı hisse — global çeşitlendirme.",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "altın",
      name: "Gümüş (Gram)",
      ticker: "XAG/TRY",
      quantity: 100,
      buyPrice: 38,
      currentPrice: 46.2,
      currentValue: 100 * 46.2,
      currency: "TRY",
      note: "Altın çeşitlendirmesi olarak gümüş.",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "kripto",
      name: "Tether",
      ticker: "USDT",
      quantity: 500,
      buyPrice: 33,
      currentPrice: 38.5,
      currentValue: 500 * 38.5,
      currency: "TRY",
      note: "Dolar paritesi takipli stablecoin.",
      createdAt: now,
      updatedAt: now,
    },
    {
      userId,
      type: "fon",
      name: "BES Devlet Katkılı Hisse Fonu",
      ticker: "BES-HSE",
      quantity: 2500,
      buyPrice: 1.85,
      currentPrice: 2.34,
      currentValue: 2500 * 2.34,
      currency: "TRY",
      note: "Bireysel emeklilik, %30 devlet katkısı dahil.",
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const a of samples) await addAsset(a);
}

/* ─── Demo Incomes Seed ────────────────────────────────────── */

export async function seedIncomesIfEmpty(userId: string) {
  const existing = await listIncomes(userId);
  if (existing.length > 0) return;

  const samples: Omit<IncomeSource, "_id" | "createdAt">[] = [
    {
      userId,
      name: "Kadıköy Daire Kirası",
      amount: 14500,
      frequency: "aylık",
      category: "kira",
      active: true,
      note: "2+1, kiracı Mehmet Bey, sözleşme 2027'ye kadar.",
    },
    {
      userId,
      name: "THYAO Temettü",
      amount: 3200,
      frequency: "yıllık",
      category: "temettü",
      active: true,
      note: "Yıllık temettü ödemesi, genellikle Mayıs ayında.",
    },
    {
      userId,
      name: "Freelance Web Geliştirme",
      amount: 5000,
      frequency: "aylık",
      category: "serbest",
      active: true,
      note: "Yarı zamanlı projeler, düzenli müşteri.",
    },
    {
      userId,
      name: "Eski Otopark Yeri Kirası",
      amount: 2500,
      frequency: "aylık",
      category: "kira",
      active: false,
      note: "Satıldı, artık aktif değil.",
    },
    // ═══ YENİ GELİR KAYNAKLARI ════════════════════════════════
    {
      userId,
      name: "YouTube Kanal Geliri",
      amount: 1800,
      frequency: "aylık",
      category: "serbest",
      active: true,
      note: "Teknoloji kanalı, AdSense + sponsorluk gelirleri.",
    },
    {
      userId,
      name: "Bireysel Emeklilik (BES) Getirisi",
      amount: 4500,
      frequency: "yıllık",
      category: "temettü",
      active: true,
      note: "Devlet katkısı dahil yıllık beklenen getiri.",
    },
    {
      userId,
      name: "Danışmanlık Hizmetleri",
      amount: 3500,
      frequency: "aylık",
      category: "serbest",
      active: true,
      note: "Yazılım mimarisi danışmanlığı, 2-3 proje/ay",
    },
    {
      userId,
      name: "GARAN Temettü",
      amount: 2850,
      frequency: "yıllık",
      category: "temettü",
      active: true,
      note: "Garanti Bankası hisse temettü geliri",
    },
    {
      userId,
      name: "Vadeli Mevduat Faizi",
      amount: 1875,
      frequency: "aylık",
      category: "faiz",
      active: true,
      note: "50.000 TL vadeli hesap %45 yıllık faiz",
    },
    {
      userId,
      name: "Online Kurs Satışları",
      amount: 2200,
      frequency: "aylık",
      category: "serbest",
      active: true,
      note: "Udemy + kişisel platform kurs gelirleri",
    },
    {
      userId,
      name: "Kitap Telif Hakları",
      amount: 800,
      frequency: "aylık",
      category: "serbest",
      active: true,
      note: "Programlama kitabı telif gelirleri",
    },
    {
      userId,
      name: "Airbnb Ev Kirası (Hafta Sonu)",
      amount: 6500,
      frequency: "aylık",
      category: "kira",
      active: false,
      note: "Pandemi sonrası kapatıldı, 2025'te yeniden açılabilir",
    },
    {
      userId,
      name: "Udemy Kurs Satış Geliri",
      amount: 2200,
      frequency: "aylık",
      category: "serbest",
      active: true,
      note: "React ve Next.js kursu, organik satışlar.",
    },
    // ═══ EKSTRA GELİR KAYNAKLARI (genişletilmiş demo) ═════════
    {
      userId,
      name: "Patreon Destekleri",
      amount: 950,
      frequency: "aylık",
      category: "serbest",
      active: true,
      note: "Açık kaynak projelerim için aylık destekçi gelirleri.",
    },
    {
      userId,
      name: "ASELSAN Temettü",
      amount: 1800,
      frequency: "yıllık",
      category: "temettü",
      active: true,
      note: "ASELS hisseleri için yıllık temettü.",
    },
    {
      userId,
      name: "Stock Photo Satışları",
      amount: 750,
      frequency: "aylık",
      category: "serbest",
      active: true,
      note: "Shutterstock + Adobe Stock pasif gelir.",
    },
    {
      userId,
      name: "Üsküdar Daire Kirası",
      amount: 11200,
      frequency: "aylık",
      category: "kira",
      active: true,
      note: "1+1 stüdyo, kira sözleşmesi 2026 sonuna kadar.",
    },
    {
      userId,
      name: "Vadeli Mevduat Faiz Getirisi",
      amount: 2350,
      frequency: "aylık",
      category: "temettü",
      active: true,
      note: "32 günlük vade, %48 yıllık net faiz.",
    },
  ];

  for (const inc of samples) await addIncome(inc);
}

/** Concurrent seed guard — StrictMode/double-render koruması */
const seedingLock = new Set<string>();

/**
 * Tüm demo verileri tek seferde seedle.
 * Bu fonksiyon yalnızca yeni kullanıcılar için çalışır — bir kez seed edilen kullanıcı
 * tüm verisini silse bile tekrar seed edilmez. Bu sayede kullanıcı kendi temiz
 * datasını oluşturabilir.
 */
export async function seedAllIfEmpty(userId: string) {
  if (seedingLock.has(userId)) return;
  // Bu kullanıcı zaten seed edilmiş — kullanıcının silme niyetine saygı duy
  if (memdb.seededUsers.has(userId)) return;
  seedingLock.add(userId);
  try {
    await Promise.all([
      seedTransactionsIfEmpty(userId),
      seedWishlistIfEmpty(userId),
      seedSubscriptionsIfEmpty(userId),
      seedAssetsIfEmpty(userId),
      seedIncomesIfEmpty(userId),
    ]);
    memdb.seededUsers.add(userId);
    persist();
  } finally {
    seedingLock.delete(userId);
  }
}

/* ─── Chat Sessions ───────────────────────────────────────── */

export async function listChatSessions(userId: string): Promise<ChatSession[]> {
  return memdb.sessions
    .filter((s) => s.userId === userId)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function getChatSession(
  userId: string,
  id: string,
): Promise<ChatSession | null> {
  return (
    memdb.sessions.find((s) => s._id === id && s.userId === userId) ?? null
  );
}

export async function createChatSession(
  userId: string,
  title = "Yeni Sohbet",
): Promise<ChatSession> {
  const now = nowIso();
  const session: ChatSession = {
    _id: genId(),
    userId,
    title,
    createdAt: now,
    updatedAt: now,
  };
  memdb.sessions.push(session);
  persist();
  return session;
}

export async function updateChatSession(
  userId: string,
  id: string,
  patch: Partial<ChatSession>,
): Promise<ChatSession | null> {
  const idx = memdb.sessions.findIndex(
    (s) => s._id === id && s.userId === userId,
  );
  if (idx === -1) return null;
  memdb.sessions[idx] = {
    ...memdb.sessions[idx],
    ...patch,
    updatedAt: nowIso(),
  };
  persist();
  return memdb.sessions[idx];
}

export async function deleteChatSession(
  userId: string,
  id: string,
): Promise<boolean> {
  const before = memdb.sessions.length;
  memdb.sessions = memdb.sessions.filter(
    (s) => !(s._id === id && s.userId === userId),
  );
  // İlgili mesajları da sil
  memdb.messages = memdb.messages.filter(
    (m) => !(m.sessionId === id && m.userId === userId),
  );
  const changed = memdb.sessions.length < before;
  if (changed) persist();
  return changed;
}

/* ─── Chat Messages ────────────────────────────────────────── */

export async function listMessages(
  userId: string,
  limit = 200,
  sessionId?: string,
): Promise<ChatMessage[]> {
  let msgs = memdb.messages.filter((m) => m.userId === userId);
  if (sessionId) {
    msgs = msgs.filter((m) => m.sessionId === sessionId);
  }
  return msgs.slice(-limit);
}

export async function addMessage(
  msg: Omit<ChatMessage, "_id" | "createdAt">,
): Promise<ChatMessage> {
  const row: ChatMessage = { ...msg, _id: genId(), createdAt: nowIso() };
  memdb.messages.push(row);
  // Session updatedAt'i güncelle
  if (msg.sessionId) {
    const idx = memdb.sessions.findIndex((s) => s._id === msg.sessionId);
    if (idx !== -1) memdb.sessions[idx].updatedAt = nowIso();
  }
  persist();
  return row;
}

export async function clearMessages(
  userId: string,
  sessionId?: string,
): Promise<void> {
  if (sessionId) {
    memdb.messages = memdb.messages.filter(
      (m) => !(m.userId === userId && m.sessionId === sessionId),
    );
  } else {
    memdb.messages = memdb.messages.filter((m) => m.userId !== userId);
  }
  persist();
}

/* ─── Wishlist ─────────────────────────────────────────────── */

export async function listWishlistItems(
  userId: string,
): Promise<WishlistItem[]> {
  return memdb.wishlist
    .filter((w) => w.userId === userId)
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        +new Date(b.createdAt) - +new Date(a.createdAt),
    );
}

export async function addWishlistItem(
  item: Omit<WishlistItem, "_id" | "createdAt">,
): Promise<WishlistItem> {
  const row: WishlistItem = { ...item, _id: genId(), createdAt: nowIso() };
  memdb.wishlist.push(row);
  persist();
  return row;
}

export async function updateWishlistItem(
  userId: string,
  id: string,
  patch: Partial<WishlistItem>,
): Promise<WishlistItem | null> {
  const idx = memdb.wishlist.findIndex(
    (w) => w._id === id && w.userId === userId,
  );
  if (idx === -1) return null;
  memdb.wishlist[idx] = { ...memdb.wishlist[idx], ...patch };
  persist();
  return memdb.wishlist[idx];
}

export async function deleteWishlistItem(
  userId: string,
  id: string,
): Promise<boolean> {
  const before = memdb.wishlist.length;
  memdb.wishlist = memdb.wishlist.filter(
    (w) => !(w._id === id && w.userId === userId),
  );
  const changed = memdb.wishlist.length < before;
  if (changed) persist();
  return changed;
}

/* ─── Subscriptions ────────────────────────────────────────── */

export async function listSubscriptions(
  userId: string,
): Promise<Subscription[]> {
  return memdb.subscriptions.filter((s) => s.userId === userId);
}

export async function addSubscription(
  data: Omit<Subscription, "_id" | "createdAt">,
): Promise<Subscription> {
  const sub: Subscription = { ...data, _id: genId(), createdAt: nowIso() };
  memdb.subscriptions.push(sub);
  persist();
  return sub;
}

export async function updateSubscription(
  userId: string,
  id: string,
  patch: Partial<Subscription>,
): Promise<Subscription | null> {
  const idx = memdb.subscriptions.findIndex(
    (s) => s._id === id && s.userId === userId,
  );
  if (idx === -1) return null;
  memdb.subscriptions[idx] = { ...memdb.subscriptions[idx], ...patch };
  persist();
  return memdb.subscriptions[idx];
}

export async function deleteSubscription(
  userId: string,
  id: string,
): Promise<boolean> {
  const before = memdb.subscriptions.length;
  memdb.subscriptions = memdb.subscriptions.filter(
    (s) => !(s._id === id && s.userId === userId),
  );
  const changed = memdb.subscriptions.length < before;
  if (changed) persist();
  return changed;
}

/* ─── Assets (Varlıklar) ───────────────────────────────────── */

export async function listAssets(userId: string): Promise<Asset[]> {
  return memdb.assets
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.currentValue - a.currentValue);
}

export async function addAsset(
  data: Omit<Asset, "_id">,
): Promise<Asset> {
  const row: Asset = { ...data, _id: genId() };
  memdb.assets.push(row);
  persist();
  return row;
}

export async function updateAsset(
  userId: string,
  id: string,
  patch: Partial<Asset>,
): Promise<Asset | null> {
  const idx = memdb.assets.findIndex(
    (a) => a._id === id && a.userId === userId,
  );
  if (idx === -1) return null;
  const updated = { ...memdb.assets[idx], ...patch, updatedAt: nowIso() };
  if (updated.quantity != null && updated.currentPrice != null) {
    updated.currentValue = updated.quantity * updated.currentPrice;
  }
  memdb.assets[idx] = updated;
  persist();
  return updated;
}

export async function deleteAsset(
  userId: string,
  id: string,
): Promise<boolean> {
  const before = memdb.assets.length;
  memdb.assets = memdb.assets.filter(
    (a) => !(a._id === id && a.userId === userId),
  );
  const changed = memdb.assets.length < before;
  if (changed) persist();
  return changed;
}

/* ─── Income Sources (Ek Gelirler) ─────────────────────────── */

export async function listIncomes(userId: string): Promise<IncomeSource[]> {
  return memdb.incomes.filter((i) => i.userId === userId);
}

export async function addIncome(
  data: Omit<IncomeSource, "_id" | "createdAt">,
): Promise<IncomeSource> {
  const row: IncomeSource = { ...data, _id: genId(), createdAt: nowIso() };
  memdb.incomes.push(row);
  persist();
  return row;
}

export async function updateIncome(
  userId: string,
  id: string,
  patch: Partial<IncomeSource>,
): Promise<IncomeSource | null> {
  const idx = memdb.incomes.findIndex(
    (i) => i._id === id && i.userId === userId,
  );
  if (idx === -1) return null;
  memdb.incomes[idx] = { ...memdb.incomes[idx], ...patch };
  persist();
  return memdb.incomes[idx];
}

export async function deleteIncome(
  userId: string,
  id: string,
): Promise<boolean> {
  const before = memdb.incomes.length;
  memdb.incomes = memdb.incomes.filter(
    (i) => !(i._id === id && i.userId === userId),
  );
  const changed = memdb.incomes.length < before;
  if (changed) persist();
  return changed;
}

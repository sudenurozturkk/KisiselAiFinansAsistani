/**
 * Veri Katmanı — In-Memory Store
 *
 * Tüm CRUD işlemleri burada merkezileştirilmiştir.
 * MongoDB tamamen kaldırılmıştır; uygulama in-memory çalışır.
 */
import { genId, memdb, nowIso } from "./store";
import type {
  ChatMessage,
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
  return memdb.transactions.length < before;
}

export async function resetUserData(userId: string): Promise<void> {
  memdb.transactions = memdb.transactions.filter((t) => t.userId !== userId);
  memdb.messages = memdb.messages.filter((m) => m.userId !== userId);
  memdb.wishlist = memdb.wishlist.filter((w) => w.userId !== userId);
  memdb.subscriptions = memdb.subscriptions.filter((s) => s.userId !== userId);
  memdb.assets = memdb.assets.filter((a) => a.userId !== userId);
  memdb.incomes = memdb.incomes.filter((i) => i.userId !== userId);
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
      {
        userId,
        type: "gelir",
        category: "Diğer",
        amount: 25000,
        note: "Maaş",
        date: monthAgo(today, m, 1).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Kira/Fatura",
        amount: 7500,
        note: "Kira",
        date: monthAgo(today, m, 2).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Kira/Fatura",
        amount: variation(950),
        note: "Elektrik + su",
        date: monthAgo(today, m, 4).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Kira/Fatura",
        amount: variation(380),
        note: "İnternet",
        date: monthAgo(today, m, 5).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Gıda",
        amount: variation(1400),
        note: "Market - hafta 1",
        date: monthAgo(today, m, 6).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Gıda",
        amount: variation(1200),
        note: "Market - hafta 3",
        date: monthAgo(today, m, 19).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Gıda",
        amount: variation(620),
        note: "Dışarıda yemek",
        date: monthAgo(today, m, 11).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Ulaşım",
        amount: variation(720),
        note: "Yakıt + Akbil",
        date: monthAgo(today, m, 7).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Eğlence",
        amount: variation(820),
        note: "Sinema/konser",
        date: monthAgo(today, m, 13).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Alışveriş",
        amount: variation(1100),
        note: "Kıyafet",
        date: monthAgo(today, m, 16).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Sağlık",
        amount: variation(420),
        note: "Eczane",
        date: monthAgo(today, m, 21).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Eğlence",
        amount: 99,
        note: "Netflix",
        date: monthAgo(today, m, 3).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Eğlence",
        amount: 60,
        note: "Spotify Premium",
        date: monthAgo(today, m, 5).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Eğlence",
        amount: 80,
        note: "YouTube Premium",
        date: monthAgo(today, m, 8).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Kira/Fatura",
        amount: 190,
        note: "Vodafone fatura",
        date: monthAgo(today, m, 10).toISOString(),
      },
      {
        userId,
        type: "gider",
        category: "Sağlık",
        amount: 450,
        note: "MacFit spor salonu",
        date: monthAgo(today, m, 12).toISOString(),
      },
    );
    if (m % 3 === 0) {
      samples.push({
        userId,
        type: "gelir",
        category: "Diğer",
        amount: 2500,
        note: "Freelance proje",
        date: monthAgo(today, m, 18).toISOString(),
      });
    }
    if (m % 2 === 0) {
      samples.push({
        userId,
        type: "gider",
        category: "Eğitim",
        amount: variation(550),
        note: "Online kurs",
        date: monthAgo(today, m, 22).toISOString(),
      });
    }
    if (m === 0) {
      samples.push({
        userId,
        type: "gider",
        category: "Yatırım",
        amount: 1500,
        note: "Mevduat transferi",
        date: monthAgo(today, 0, 8).toISOString(),
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
    {
      userId,
      name: "iPhone 15 Pro 256GB Titanyum",
      brand: "Apple",
      siteName: "Apple Türkiye",
      url: "https://www.apple.com/tr/shop/buy-iphone/iphone-15-pro",
      imageUrl:
        "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium?wid=2560&hei=1440&fmt=p-jpg",
      description:
        "A17 Pro çip, 6.1 inç Super Retina XDR ekran, ProMotion 120Hz, USB-C, gelişmiş kamera sistemi.",
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
      imageUrl:
        "https://m.media-amazon.com/images/I/61+btxzpfDL._AC_SL1500_.jpg",
      description:
        "Endüstri lideri gürültü engelleme, 30 saat pil, multipoint bağlantı, hızlı şarj.",
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
      aiAnalysis:
        "Mehmet, uzaktan çalışıyorsan bu kulaklık verimliliğini artırır ve fiyat son 2 haftada %11 düştü — şu an alım için iyi bir zaman olabilir. Ancak bütçenin %5'ini buluyor, isteğe bağlı bir alım.",
      aiVerdict: "wait",
    },
    {
      userId,
      name: "Logitech MX Master 3S Mouse",
      brand: "Logitech",
      siteName: "Trendyol",
      url: "https://www.trendyol.com",
      imageUrl:
        "https://resource.logitech.com/content/dam/logitech/en/products/mice/mx-master-3s/gallery/mx-master-3s-mouse-top-view-graphite.png",
      description:
        "8000 DPI sensör, sessiz tıklama, MagSpeed kaydırma, 70 günlük pil ömrü.",
      price: 3899,
      originalPrice: 3899,
      priceHistory: [{ date: daysAgo(5), price: 3899 }],
      lastCheckedAt: daysAgo(5),
      priceAlerts: true,
      category: "Alışveriş",
      priority: 5,
      urgency: "ihtiyaç",
      status: "wishlist",
      note: "Eski mouse'un düğmesi kırıldı, iş için acilen lazım.",
    },
    {
      userId,
      name: "Udemy: Tam Yığın Web Geliştirme Kursu",
      siteName: "Udemy",
      url: "https://www.udemy.com",
      description:
        "React, Node.js, PostgreSQL, Docker. 60 saat video, sertifika dahil.",
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
      name: "Nike Pegasus 41 Koşu Ayakkabısı",
      brand: "Nike",
      siteName: "Nike Türkiye",
      url: "https://www.nike.com/tr",
      imageUrl:
        "https://static.nike.com/a/images/c_limit,w_592,f_auto/t_product_v1/4qmqnhne7mnvxeqekhus/pegasus-41-yol-kosu-ayakkabisi-mfNX5p.png",
      description:
        "ReactX köpük teknolojisi, Air Zoom, geliştirilmiş yastıklama. Günlük koşu için ideal.",
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
      name: "IKEA Markus Ofis Sandalyesi",
      brand: "IKEA",
      siteName: "IKEA Türkiye",
      url: "https://www.ikea.com.tr",
      imageUrl:
        "https://www.ikea.com.tr/UlysesAssetLoader/jpeg?assetCode=00261150&assetType=ProductImage&filter=PE_EI&isPdf=false&width=400",
      description:
        "Ergonomik bel desteği, ayarlanabilir kol, 10 yıl garanti. Uzun çalışma seansları için tasarlandı.",
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
    // Geçmişte satın alınmış örnekler
    {
      userId,
      name: "Kindle Paperwhite",
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
      name: "MacBook için USB-C Hub",
      siteName: "Trendyol",
      price: 899,
      purchasedPrice: 749,
      purchasedAt: daysAgo(20),
      category: "Alışveriş",
      priority: 5,
      urgency: "ihtiyaç",
      status: "purchased",
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
      name: "Adobe Creative Cloud",
      amount: 1599,
      frequency: "aylık",
      category: "Eğitim",
      active: false,
      note: "Geçici olarak iptal ettim",
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
  ];

  for (const inc of samples) await addIncome(inc);
}

/** Tüm demo verileri tek seferde seedle (çağrı yerlerinde rahatlık için) */
export async function seedAllIfEmpty(userId: string) {
  await Promise.all([
    seedTransactionsIfEmpty(userId),
    seedWishlistIfEmpty(userId),
    seedSubscriptionsIfEmpty(userId),
    seedAssetsIfEmpty(userId),
    seedIncomesIfEmpty(userId),
  ]);
}

/* ─── Chat Messages ────────────────────────────────────────── */

export async function listMessages(
  userId: string,
  limit = 100,
): Promise<ChatMessage[]> {
  return memdb.messages.filter((m) => m.userId === userId).slice(-limit);
}

export async function addMessage(
  msg: Omit<ChatMessage, "_id" | "createdAt">,
): Promise<ChatMessage> {
  const row: ChatMessage = { ...msg, _id: genId(), createdAt: nowIso() };
  memdb.messages.push(row);
  return row;
}

export async function clearMessages(userId: string): Promise<void> {
  memdb.messages = memdb.messages.filter((m) => m.userId !== userId);
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
  return memdb.wishlist.length < before;
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
  return memdb.subscriptions.length < before;
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
  // Otomatik olarak currentValue hesapla
  if (updated.quantity != null && updated.currentPrice != null) {
    updated.currentValue = updated.quantity * updated.currentPrice;
  }
  memdb.assets[idx] = updated;
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
  return memdb.assets.length < before;
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
  return memdb.incomes.length < before;
}

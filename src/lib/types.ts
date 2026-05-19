/* ─── Kategori ──────────────────────────────────────────────── */
export type Category =
  | "Gıda"
  | "Ulaşım"
  | "Kira/Fatura"
  | "Eğlence"
  | "Alışveriş"
  | "Sağlık"
  | "Eğitim"
  | "Yatırım"
  | "Diğer";

export const CATEGORIES: Category[] = [
  "Gıda",
  "Ulaşım",
  "Kira/Fatura",
  "Eğlence",
  "Alışveriş",
  "Sağlık",
  "Eğitim",
  "Yatırım",
  "Diğer",
];

/* ─── Kullanıcı ─────────────────────────────────────────────── */
export interface UserProfile {
  userId: string;
  name: string;
  monthlyIncome: number;
  monthlyBudget: number;
  savingsGoal: number;
  riskTolerance: "düşük" | "orta" | "yüksek";
  goals: string[];
  createdAt: string;
  updatedAt: string;
}

/* ─── İşlem ─────────────────────────────────────────────────── */
export interface Transaction {
  _id?: string;
  userId: string;
  type: "gelir" | "gider";
  category: Category;
  amount: number;
  note?: string;
  date: string; // ISO
}

/* ─── Sohbet ────────────────────────────────────────────────── */
export interface ChatSession {
  _id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  _id?: string;
  userId: string;
  sessionId?: string; // Hangi sohbet oturumuna ait (eski mesajlar için opsiyonel)
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

/* ─── İstek Listesi (Wishlist) ──────────────────────────────── */
export interface PricePoint {
  date: string; // ISO
  price: number;
}

export interface ProductScrapeData {
  name?: string;
  description?: string;
  brand?: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  availability?: string;
  siteName?: string;
  url: string;
}

export interface WishlistItem {
  _id: string;
  userId: string;
  name: string;
  url?: string;
  imageUrl?: string;
  description?: string; // ürün açıklaması (scrape veya AI)
  brand?: string; // marka
  siteName?: string; // satıcı (Trendyol, Hepsiburada, Amazon...)
  price?: number; // güncel fiyat (kullanıcı veya scrape)
  estimatedPrice?: number; // AI tahmini
  originalPrice?: number; // ekleme anındaki fiyat (referans)
  priceHistory?: PricePoint[]; // zaman içindeki fiyat değişimleri
  lastCheckedAt?: string; // son fiyat kontrolü
  priceAlerts?: boolean; // fiyat düşünce bildirim
  category: Category;
  priority: 1 | 2 | 3 | 4 | 5;
  urgency: "ihtiyaç" | "istek" | "hobi" | "acil";
  status: "wishlist" | "purchased" | "cancelled";
  note?: string;
  purchasedAt?: string;
  purchasedPrice?: number;
  aiAnalysis?: string; // AI'nın kişiselleştirilmiş yorumu
  aiVerdict?: "buy_now" | "wait" | "skip" | "find_alternative";
  createdAt: string;
}

export interface WishlistAnalysis {
  prioritizedItems: {
    itemId: string;
    name: string;
    recommendedAction: "buy_now" | "wait" | "skip" | "find_alternative";
    reason: string;
    alternativeSuggestion?: string;
    estimatedSavings?: number;
  }[];
  budgetPlan: string;
  totalEstimatedCost: number;
  affordableThisMonth: number;
  summary: string;
}

export interface WishlistResponse {
  items: WishlistItem[];
  totalEstimated: number;
  purchasedTotal: number;
  wishlistCount: number;
  purchasedCount: number;
}

/* ─── Insight ───────────────────────────────────────────────── */
export interface Insight {
  id: string;
  title: string;
  value: string;
  delta?: number;
  hint?: string;
  tone: "good" | "warn" | "bad" | "info";
}

/* ─── Anomali ───────────────────────────────────────────────── */
export interface SpendingAnomaly {
  category: Category;
  currentAmount: number;
  avgAmount: number;
  zScore: number;
  severity: "mild" | "moderate" | "severe";
  message: string;
}

/* ─── API Response ──────────────────────────────────────────── */
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: "ok" | "error";
}

/* ─── Agent Tool Types (Agentic AI) ─────────────────────────── */
export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, AgentToolParam>;
  required?: string[];
}

export interface AgentToolParam {
  type: "string" | "number" | "boolean" | "array";
  description: string;
  enum?: string[];
}

export interface AgentToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AgentToolResult {
  toolName: string;
  result: unknown;
}

export interface AgentStep {
  type: "thinking" | "tool_call" | "tool_result" | "response";
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
}

/* ─── Structured Recommendation ─────────────────────────────── */
export interface StructuredRecommendation {
  category: "tasarruf" | "bütçe" | "yatırım" | "alışveriş";
  title: string;
  description: string;
  actionItems: string[];
  impact: string;
  priority: "high" | "medium" | "low";
}

/* ─── Finansal Okuryazarlık ─────────────────────────────────── */
export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: "kolay" | "orta" | "zor";
  topic: string;
}

export interface LiteracyTopic {
  id: string;
  title: string;
  icon: string;
  description: string;
  level: "başlangıç" | "orta" | "ileri";
}

export interface ScenarioAnalysis {
  scenario: string;
  analysis: string;
  risks: string[];
  recommendations: string[];
  financialImpact: string;
}

/* ─── Transactions API Response ─────────────────────────────── */
export interface TransactionsResponse {
  transactions: Transaction[];
  summary: import("@/lib/finance").FinanceSummary;
  insights: Insight[];
  anomalies?: SpendingAnomaly[];
}

/* ─── Chat API Response ─────────────────────────────────────── */
export interface ChatResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  agentSteps?: AgentStep[];
  sessionId?: string;
}

/* ─── Recommendations API Response ──────────────────────────── */
export interface RecommendationsResponse {
  advice: string;
  structured: StructuredRecommendation[];
  summary: import("@/lib/finance").FinanceSummary;
  insights: Insight[];
  anomalies: SpendingAnomaly[];
  user: UserProfile;
}

/* ─── Fiş Tarama (Vision AI) ────────────────────────────────── */
export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ReceiptScanResult {
  storeName: string;
  date: string;
  totalAmount: number;
  category: Category;
  items: ReceiptItem[];
  currency: string;
  confidence: number;
}

/* ─── Abonelik Yönetimi ─────────────────────────────────────── */
export interface Subscription {
  _id: string;
  userId: string;
  name: string;
  amount: number;
  frequency: "haftalık" | "aylık" | "yıllık";
  category: Category;
  nextPaymentDate?: string;
  note?: string;
  active: boolean;
  createdAt: string;
}

export interface SubscriptionsResponse {
  subscriptions: Subscription[];
  totalMonthly: number;
  totalYearly: number;
  activeCount: number;
}

/* ─── CSV İçe Aktarma ───────────────────────────────────────── */
export interface CSVImportRow {
  date: string;
  description: string;
  amount: number;
  type: "gelir" | "gider";
  category: Category;
  confidence: number;
  originalLine: string;
}

export interface CSVImportResult {
  rows: CSVImportRow[];
  totalIncome: number;
  totalExpense: number;
  categorySummary: { category: Category; count: number; total: number }[];
}

/* ─── Finansal Sağlık Skoru ─────────────────────────────────── */
export interface HealthScore {
  overall: number; // 0-100
  components: {
    budgetAdherence: number;
    savingsRate: number;
    spendingStability: number;
    debtRisk: number;
    diversification: number;
  };
  grade: "A+" | "A" | "B+" | "B" | "C" | "D" | "F";
  trend: "improving" | "stable" | "declining";
  aiSummary: string;
}

/* ─── Varlık Türleri ────────────────────────────────────────── */
export type AssetType =
  | "altın"
  | "döviz"
  | "hisse"
  | "kripto"
  | "gayrimenkul"
  | "fon"
  | "mevduat"
  | "diğer";

export const ASSET_TYPES: { value: AssetType; label: string; icon: string }[] =
  [
    { value: "altın", label: "Altın", icon: "🥇" },
    { value: "döviz", label: "Döviz", icon: "💱" },
    { value: "hisse", label: "Hisse Senedi", icon: "📈" },
    { value: "kripto", label: "Kripto Para", icon: "₿" },
    { value: "gayrimenkul", label: "Gayrimenkul", icon: "🏠" },
    { value: "fon", label: "Yatırım Fonu", icon: "🏦" },
    { value: "mevduat", label: "Mevduat / Vadeli", icon: "💰" },
    { value: "diğer", label: "Diğer", icon: "📦" },
  ];

/* ─── Varlık (Asset) ────────────────────────────────────────── */
export interface Asset {
  _id: string;
  userId: string;
  type: AssetType;
  name: string; // Örn: "Gram Altın", "THYAO", "Bitcoin"
  ticker?: string; // Borsa sembolü: "THYAO.IS", "BTC", "USD"
  quantity: number; // Miktar (gram, adet, lot, birim)
  buyPrice: number; // Birim alış fiyatı (₺)
  currentPrice: number; // Birim güncel fiyat (₺)
  currentValue: number; // Toplam güncel değer = quantity × currentPrice
  currency: string; // Para birimi (varsayılan TRY)
  dailyChange?: number; // Günlük fiyat değişimi (₺)
  dailyChangePct?: number; // Günlük değişim yüzdesi
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetsResponse {
  assets: Asset[];
  totalValue: number; // Tüm varlıkların toplam değeri
  totalProfit: number; // Toplam kâr/zarar
  profitPercent: number; // Yüzdesel getiri
  byType: { type: AssetType; label: string; total: number; count: number }[];
}

/* ─── Ek Gelir Kaynağı ──────────────────────────────────────── */
export type IncomeFrequency = "haftalık" | "aylık" | "yıllık";

export interface IncomeSource {
  _id: string;
  userId: string;
  name: string; // Örn: "Ev 1 Kirası", "Temettü — THYAO"
  amount: number; // Gelir miktarı (₺)
  frequency: IncomeFrequency;
  category: "kira" | "temettü" | "serbest" | "ek_iş" | "faiz" | "diğer";
  active: boolean;
  note?: string;
  createdAt: string;
}

export const INCOME_CATEGORIES: {
  value: IncomeSource["category"];
  label: string;
}[] = [
  { value: "kira", label: "Kira Geliri" },
  { value: "temettü", label: "Temettü / Kâr Payı" },
  { value: "faiz", label: "Faiz Geliri" },
  { value: "serbest", label: "Serbest Meslek" },
  { value: "ek_iş", label: "Ek İş / Freelance" },
  { value: "diğer", label: "Diğer" },
];

export interface IncomesResponse {
  incomes: IncomeSource[];
  totalMonthly: number; // Aylığa normalize edilmiş toplam
  activeCount: number;
}

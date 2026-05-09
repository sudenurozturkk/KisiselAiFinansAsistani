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
export interface ChatMessage {
  _id?: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

/* ─── Ürün ──────────────────────────────────────────────────── */
export type ProductBadge = "yeni" | "firsat" | "populer" | "eko" | "sinirli";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  price: number;
  oldPrice?: number;
  image: string;
  description: string;
  installments: number[];
  rating: number;
  reviewCount: number;
  badges?: ProductBadge[];
  tags?: string[];
}

export interface EnrichedProduct extends Product {
  affordableNow: boolean;
  recommendedInstallment: number;
  monthly: number;
  advice: string;
  riskLevel: "low" | "medium" | "high";
  budgetImpactPct: number;
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

/* ─── Products API Response ─────────────────────────────────── */
export interface ProductsResponse {
  products: EnrichedProduct[];
  context: {
    remainingBudget: number;
    summary?: import("@/lib/finance").FinanceSummary;
    user?: UserProfile;
  };
}

/* ─── Chat API Response ─────────────────────────────────────── */
export interface ChatResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  agentSteps?: AgentStep[];
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

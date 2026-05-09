"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import {
  BookOpen,
  Brain,
  TrendingUp,
  CreditCard,
  PiggyBank,
  BarChart3,
  Landmark,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Lightbulb,
  PlayCircle,
} from "lucide-react";
import Markdown from "@/components/Markdown";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/ui";
import type { LucideIcon } from "lucide-react";
import type { QuizQuestion, ScenarioAnalysis } from "@/lib/types";

/* ─── Konu Listesi ──────────────────────────────────────────── */

interface Topic {
  id: string;
  title: string;
  Icon: typeof BookOpen;
  description: string;
  color: string;
  quizTopic: string;
}

const TOPICS: Topic[] = [
  {
    id: "borsa",
    title: "Borsa & Hisse Senetleri",
    Icon: TrendingUp,
    description: "Borsa nasıl çalışır? Hisse senedi, endeks, volatilite",
    color: "text-emerald-600 bg-emerald-50",
    quizTopic: "borsa ve hisse senetleri",
  },
  {
    id: "faiz",
    title: "Faiz & Enflasyon",
    Icon: BarChart3,
    description: "Faiz oranları, enflasyon, reel getiri hesaplama",
    color: "text-blue-600 bg-blue-50",
    quizTopic: "faiz ve enflasyon",
  },
  {
    id: "kredi",
    title: "Kredi & Borç Yönetimi",
    Icon: CreditCard,
    description: "Kredi kartı, tüketici kredisi, borç kapatma stratejileri",
    color: "text-purple-600 bg-purple-50",
    quizTopic: "kredi kartı ve borç yönetimi",
  },
  {
    id: "yatirim",
    title: "Yatırım Fonları",
    Icon: Landmark,
    description: "Yatırım fonu türleri, risk-getiri dengesi",
    color: "text-orange-600 bg-orange-50",
    quizTopic: "yatırım fonları",
  },
  {
    id: "butce",
    title: "Bütçe Yönetimi",
    Icon: PiggyBank,
    description: "50/30/20 kuralı, acil durum fonu, tasarruf stratejileri",
    color: "text-rose-600 bg-rose-50",
    quizTopic: "bütçe yönetimi ve tasarruf",
  },
  {
    id: "vergi",
    title: "Vergiler & Mevzuat",
    Icon: BookOpen,
    description: "Gelir vergisi, stopaj, vergi avantajlı yatırımlar",
    color: "text-sky-600 bg-sky-50",
    quizTopic: "vergiler ve finansal mevzuat",
  },
];

const SCENARIOS = [
  "Kredi kartı asgari ödeme yaparsam ne olur?",
  "3 ay boyunca gelir azalırsa ne yapmalıyım?",
  "10.000₺'yi mevduata mı, fona mı yatırmalıyım?",
  "Tüketici kredisi çekip yatırım yapsan kâr eder miyim?",
  "Döviz alarak tasarruf yapmak mantıklı mı?",
  "Ev kiraya mı versem, satıp değerlendirmeye mi yatırsam?",
];

type TabType = "learn" | "quiz" | "scenario";

export default function LiteracyPage() {
  const [tab, setTab] = useState<TabType>("learn");
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [explanation, setExplanation] = useState("");
  const [loadingExplain, setLoadingExplain] = useState(false);
  const [quiz, setQuiz] = useState<{
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    difficulty: string;
    topic: string;
  } | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizDifficulty, setQuizDifficulty] = useState("kolay");
  const [scenario, setScenario] = useState("");
  const [scenarioResult, setScenarioResult] = useState<{
    scenario: string;
    analysis: string;
    risks: string[];
    recommendations: string[];
    financialImpact: string;
  } | null>(null);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const toast = useToast();

  async function loadExplanation(topic: Topic) {
    setSelectedTopic(topic);
    setExplanation("");
    setLoadingExplain(true);
    try {
      const res = await api.explainConcept(topic.title, "orta");
      setExplanation(res.explanation);
    } catch {
      toast.error("Hata", "Açıklama yüklenemedi.");
    } finally {
      setLoadingExplain(false);
    }
  }

  async function loadQuiz(topic: string) {
    setQuiz(null);
    setSelectedAnswer(null);
    setLoadingQuiz(true);
    try {
      const res = await api.getQuiz(topic, quizDifficulty);
      setQuiz(res.quiz);
    } catch {
      toast.error("Hata", "Quiz yüklenemedi.");
    } finally {
      setLoadingQuiz(false);
    }
  }

  async function analyzeScenario(text: string) {
    setScenarioResult(null);
    setLoadingScenario(true);
    try {
      const res = await api.getScenarioAnalysis(text);
      setScenarioResult(res.analysis);
    } catch {
      toast.error("Hata", "Senaryo analizi yapılamadı.");
    } finally {
      setLoadingScenario(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Brain className="text-brand-600" size={22} />
          Finansal Okuryazarlık Koçu
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          AI destekli kişisel öğrenme — kavramlar, quizler ve senaryo analizleri
        </p>
      </header>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[
          { id: "learn" as const, label: "📖 Kavramlar", icon: BookOpen },
          { id: "quiz" as const, label: "🧠 Quiz", icon: Brain },
          {
            id: "scenario" as const,
            label: "🎯 Senaryolar",
            icon: PlayCircle,
          },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id
                ? "bg-white text-brand-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Learn Tab ──────────────────────────────────────── */}
      {tab === "learn" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-2">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                onClick={() => loadExplanation(t)}
                className={`w-full card !p-4 text-left flex items-start gap-3 transition hover:shadow-md ${
                  selectedTopic?.id === t.id
                    ? "ring-2 ring-brand-500 border-brand-200"
                    : ""
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${t.color}`}
                >
                  <t.Icon size={20} />
                </div>
                <div>
                  <div className="font-medium text-sm">{t.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {t.description}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2">
            {loadingExplain ? (
              <div className="card space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : explanation ? (
              <div className="card">
                <div className="flex items-center gap-2 mb-4">
                  {selectedTopic && (
                    <div
                      className={`w-8 h-8 rounded-lg grid place-items-center ${selectedTopic.color}`}
                    >
                      <selectedTopic.Icon size={16} />
                    </div>
                  )}
                  <h3 className="font-semibold">{selectedTopic?.title}</h3>
                </div>
                <div className="prose-sm">
                  <Markdown text={explanation} />
                </div>
              </div>
            ) : (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <Lightbulb size={48} className="text-slate-300 mb-4" />
                <div className="font-medium text-slate-600">
                  Bir konu seçerek başla
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  AI, seçtiğin konuyu senin seviyene uygun şekilde açıklayacak
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Quiz Tab ───────────────────────────────────────── */}
      {tab === "quiz" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
              {["kolay", "orta", "zor"].map((d) => (
                <button
                  key={d}
                  onClick={() => setQuizDifficulty(d)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    quizDifficulty === d
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => loadQuiz(t.quizTopic)}
                  disabled={loadingQuiz}
                  className="btn-ghost text-xs"
                >
                  {t.title.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {loadingQuiz ? (
            <div className="card space-y-4">
              <Skeleton className="h-6 w-full" />
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          ) : quiz ? (
            <div className="card space-y-4">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    quiz.difficulty === "kolay"
                      ? "bg-emerald-50 text-emerald-700"
                      : quiz.difficulty === "orta"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {quiz.difficulty}
                </span>
                <span className="text-xs text-slate-500">{quiz.topic}</span>
              </div>

              <h3 className="font-semibold">{quiz.question}</h3>

              <div className="space-y-2">
                {quiz.options.map((opt, idx) => {
                  const isSelected = selectedAnswer === idx;
                  const isCorrect = idx === quiz.correctIndex;
                  const showResult = selectedAnswer !== null;

                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedAnswer(idx)}
                      disabled={selectedAnswer !== null}
                      className={`w-full text-left p-3 rounded-xl border text-sm transition flex items-center gap-3 ${
                        showResult && isCorrect
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : showResult && isSelected && !isCorrect
                            ? "border-rose-300 bg-rose-50 text-rose-800"
                            : isSelected
                              ? "border-brand-300 bg-brand-50"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="w-7 h-7 rounded-full border-2 grid place-items-center text-xs font-semibold shrink-0">
                        {showResult && isCorrect ? (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        ) : showResult && isSelected ? (
                          <XCircle size={16} className="text-rose-600" />
                        ) : (
                          String.fromCharCode(65 + idx)
                        )}
                      </span>
                      {opt}
                    </button>
                  );
                })}
              </div>

              {selectedAnswer !== null && (
                <div
                  className={`p-4 rounded-xl text-sm ${
                    selectedAnswer === quiz.correctIndex
                      ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                      : "bg-amber-50 border border-amber-200 text-amber-800"
                  }`}
                >
                  <div className="font-semibold mb-1">
                    {selectedAnswer === quiz.correctIndex
                      ? "✅ Doğru!"
                      : "❌ Yanlış"}
                  </div>
                  <Markdown text={quiz.explanation} />
                </div>
              )}

              {selectedAnswer !== null && (
                <button
                  onClick={() => loadQuiz(quiz.topic)}
                  className="btn-primary"
                >
                  <RefreshCw size={16} /> Yeni Soru
                </button>
              )}
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <Brain size={48} className="text-slate-300 mb-4" />
              <div className="font-medium text-slate-600">
                Bir konu seçerek quiz başlat
              </div>
              <div className="text-sm text-slate-500 mt-1">
                AI, seviyene uygun sorular üretecek
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Scenario Tab ───────────────────────────────────── */}
      {tab === "scenario" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm mb-2">
              Hazır Senaryolar
            </h3>
            {SCENARIOS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setScenario(s);
                  analyzeScenario(s);
                }}
                disabled={loadingScenario}
                className="w-full card !p-3 text-left text-sm hover:shadow-md transition"
              >
                {s}
              </button>
            ))}

            <div className="mt-4">
              <label className="label">Kendi senaryonu yaz</label>
              <textarea
                className="input mt-1 h-20 resize-none"
                placeholder="Örn: 50.000₺ birikimim var, nasıl değerlendirmeliyim?"
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
              />
              <button
                onClick={() => analyzeScenario(scenario)}
                disabled={!scenario.trim() || loadingScenario}
                className="btn-primary mt-2 w-full"
              >
                {loadingScenario ? "Analiz ediliyor..." : "Analiz Et"}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            {loadingScenario ? (
              <div className="card space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : scenarioResult ? (
              <div className="card space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <PlayCircle size={18} className="text-brand-600" />
                  Senaryo Analizi
                </h3>
                <div className="bg-slate-50 rounded-xl p-3 text-sm border border-slate-100">
                  <span className="font-medium">Senaryo:</span>{" "}
                  {scenarioResult.scenario}
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">📊 Analiz</h4>
                  <div className="text-sm text-slate-700 leading-relaxed">
                    <Markdown text={scenarioResult.analysis} />
                  </div>
                </div>

                {scenarioResult.risks.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-rose-700">
                      ⚠️ Riskler
                    </h4>
                    <ul className="space-y-1">
                      {scenarioResult.risks.map((r, i) => (
                        <li
                          key={i}
                          className="text-sm text-slate-700 flex items-start gap-2"
                        >
                          <span className="text-rose-500 mt-1">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {scenarioResult.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 text-emerald-700">
                      💡 Öneriler
                    </h4>
                    <ul className="space-y-1">
                      {scenarioResult.recommendations.map((r, i) => (
                        <li
                          key={i}
                          className="text-sm text-slate-700 flex items-start gap-2"
                        >
                          <span className="text-emerald-500 mt-1">•</span>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {scenarioResult.financialImpact && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
                    <strong>💰 Finansal Etki:</strong>{" "}
                    {scenarioResult.financialImpact}
                  </div>
                )}
              </div>
            ) : (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <PlayCircle size={48} className="text-slate-300 mb-4" />
                <div className="font-medium text-slate-600">
                  Bir senaryo seç veya yaz
                </div>
                <div className="text-sm text-slate-500 mt-1">
                  AI, senaryonun finansal etkisini, risklerini ve önerilerini
                  analiz edecek
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

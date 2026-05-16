"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Wallet,
  Sparkles,
  BarChart3,
  ShoppingBag,
  Brain,
  Shield,
  Eye,
  EyeOff,
  Zap,
  ArrowRight,
  Loader2,
  MessageSquare,
  Target,
} from "lucide-react";
import Link from "next/link";
import { createSession, createDemoSession, isLoggedIn } from "@/lib/userId";
import { api } from "@/lib/api";

/* ─── Feature Highlights ────────────────────────────────────── */

const HIGHLIGHTS = [
  { icon: BarChart3, text: "Gelir-Gider Takibi & Grafikleri" },
  { icon: MessageSquare, text: "AI Sohbet ile Finansal Danışmanlık" },
  { icon: ShoppingBag, text: "İstek Listesi & Fiyat Takibi" },
  { icon: Target, text: "Senaryo Simülatörü" },
  { icon: Brain, text: "Finansal Okuryazarlık Koçu" },
  { icon: Shield, text: "Güvenli & Gizli — Kayıt Bilgisi Yok" },
];

/* ─── Auth Form Content ─────────────────────────────────────── */

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");

  const [mode, setMode] = useState<"login" | "register">(
    modeParam === "register" ? "register" : "login",
  );
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  /* Register fields */
  const [name, setName] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("25000");
  const [monthlyBudget, setMonthlyBudget] = useState("18000");
  const [savingsGoal, setSavingsGoal] = useState("5000");
  const [riskTolerance, setRiskTolerance] = useState<"düşük" | "orta" | "yüksek">("orta");

  /* Login field */
  const [loginName, setLoginName] = useState("");

  // Handle demo mode from URL
  useEffect(() => {
    if (modeParam === "demo") {
      handleDemoLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeParam]);

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn()) {
      router.replace("/dashboard");
    }
  }, [router]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      createSession(name.trim());

      // Sunucuda kullanıcı profilini güncelle
      await api.updateUser({
        name: name.trim(),
        monthlyIncome: Number(monthlyIncome) || 25000,
        monthlyBudget: Number(monthlyBudget) || 18000,
        savingsGoal: Number(savingsGoal) || 5000,
        riskTolerance,
        goals: ["Bütçe takibi yapmak", "Tasarruf hedefine ulaşmak"],
      });

      router.push("/dashboard");
    } catch {
      // Session zaten oluşturuldu, yine de yönlendir
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginName.trim()) return;

    setLoading(true);
    try {
      createSession(loginName.trim());
      await api.updateUser({ name: loginName.trim() });
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setDemoLoading(true);
    try {
      createDemoSession();

      // Demo verilerini yükle
      await api.resetDemo(true);

      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Sol Panel — Brand */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-slate-950 via-brand-950 to-slate-900 flex-col justify-between p-10 text-white">
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-brand-500/15 rounded-full blur-[80px]" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10">
          <Link href="/landing" className="flex items-center gap-3 mb-16">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center shadow-lg shadow-brand-500/30">
              <Wallet size={22} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-xl">Akıllı Finans</span>
              <span className="text-brand-400 text-xs block -mt-0.5">
                AI Asistan Platformu
              </span>
            </div>
          </Link>

          <h2 className="text-3xl font-bold leading-tight mb-4">
            Finanslarınızı{" "}
            <span className="bg-gradient-to-r from-brand-400 to-cyan-400 bg-clip-text text-transparent">
              AI ile
            </span>{" "}
            Yönetin
          </h2>
          <p className="text-slate-400 mb-10 leading-relaxed">
            Gemini AI destekli kişisel finans asistanınız ile harcamalarınızı
            analiz edin, bütçe planı oluşturun ve finansal hedeflerinize
            ulaşın.
          </p>

          <div className="space-y-4">
            {HIGHLIGHTS.map((h) => (
              <div
                key={h.text}
                className="flex items-center gap-3 text-sm text-slate-300"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 grid place-items-center shrink-0">
                  <h.icon size={16} className="text-brand-400" />
                </div>
                {h.text}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-brand-500" />
            Gemini AI • Hackathon 2026
          </div>
        </div>
      </div>

      {/* Sağ Panel — Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-10 bg-gradient-to-br from-slate-50 to-blue-50/40">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <Link href="/landing" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 grid place-items-center shadow-lg shadow-brand-500/20">
              <Wallet size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg text-slate-900">Akıllı Finans</span>
          </Link>
        </div>

        <div className="max-w-md mx-auto w-full">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {mode === "login" ? "Hoş Geldiniz 👋" : "Hesap Oluşturun 🚀"}
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            {mode === "login"
              ? "Giriş yaparak finanslarınızı yönetmeye devam edin."
              : "Bilgilerinizi girerek kişiselleştirilmiş finans deneyiminizi başlatın."}
          </p>

          {/* Demo Button */}
          <button
            onClick={handleDemoLogin}
            disabled={demoLoading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30 hover:scale-[1.01] mb-6 disabled:opacity-70"
          >
            {demoLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Zap size={18} />
            )}
            {demoLoading ? "Demo Hazırlanıyor..." : "Demo Hesapla Hızlı Giriş"}
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400 uppercase tracking-wider">veya</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              onClick={() => setMode("login")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                mode === "login"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Giriş Yap
            </button>
            <button
              onClick={() => setMode("register")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                mode === "register"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Kayıt Ol
            </button>
          </div>

          {/* Login Form */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">
                  İsminiz
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                  placeholder="Adınızı girin"
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || !loginName.trim()}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-500/30 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Giriş Yap
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Register Form */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">
                  İsminiz *
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                  placeholder="Adınızı girin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Aylık Gelir (₺)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Aylık Bütçe (₺)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Tasarruf Hedefi (₺)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                    value={savingsGoal}
                    onChange={(e) => setSavingsGoal(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Risk Toleransı
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition"
                    value={riskTolerance}
                    onChange={(e) =>
                      setRiskTolerance(e.target.value as "düşük" | "orta" | "yüksek")
                    }
                  >
                    <option value="düşük">Düşük</option>
                    <option value="orta">Orta</option>
                    <option value="yüksek">Yüksek</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-brand-600/20 hover:shadow-brand-500/30 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    Hesap Oluştur
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="text-xs text-center text-slate-400 mt-6">
            Giriş yaparak, verilerinizin yalnızca tarayıcınızda saklandığını
            kabul etmiş olursunuz.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Page Wrapper (Suspense for useSearchParams) ───────────── */

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen grid place-items-center">
          <Loader2 className="animate-spin text-brand-500" size={32} />
        </div>
      }
    >
      <AuthContent />
    </Suspense>
  );
}

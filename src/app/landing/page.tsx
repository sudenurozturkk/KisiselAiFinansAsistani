"use client";

import Link from "next/link";
import {
  Sparkles,
  BarChart3,
  ShoppingBag,
  MessageSquare,
  Brain,
  Target,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Zap,
  Shield,
  TrendingUp,
  Wallet,
} from "lucide-react";

/* ─── Feature Data ──────────────────────────────────────────── */

const FEATURES = [
  {
    icon: BarChart3,
    title: "Akıllı Dashboard",
    description:
      "Gelir-gider analizi, bütçe takibi, finansal sağlık skoru ve trend grafikleri ile tüm mali durumunuz tek bakışta.",
    color: "from-blue-500 to-cyan-400",
  },
  {
    icon: MessageSquare,
    title: "AI Finans Asistanı",
    description:
      "Gemini AI destekli agentic sohbet botu. Harcamalarınızı analiz eder, kişisel tasarruf planı oluşturur.",
    color: "from-violet-500 to-purple-400",
  },
  {
    icon: ShoppingBag,
    title: "Akıllı İstek Listesi",
    description:
      "Ürün URL'si yapıştırın, AI fiyat takibi yapsın, bütçenize uygunluğunu analiz etsin.",
    color: "from-orange-500 to-amber-400",
  },
  {
    icon: Target,
    title: "Senaryo Simülatörü",
    description:
      '"Eğer şunu yapsam?" sorusuna anlık cevap. Kategori harcamalarını ayarlayıp etkisini görün.',
    color: "from-emerald-500 to-green-400",
  },
  {
    icon: Brain,
    title: "Finansal Okuryazarlık",
    description:
      "AI destekli interaktif dersler, quizler ve senaryo analizleri ile finansal bilginizi artırın.",
    color: "from-rose-500 to-pink-400",
  },
  {
    icon: CreditCard,
    title: "Abonelik Yönetimi",
    description:
      "Netflix, Spotify, spor salonu — tüm düzenli ödemelerinizi takip edin, aylık/yıllık maliyeti görün.",
    color: "from-sky-500 to-blue-400",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Hesap Oluştur",
    description: "30 saniyede bütçe bilgilerinizi girin veya demo hesapla deneyin.",
    icon: Zap,
  },
  {
    num: "02",
    title: "AI Analiz Etsin",
    description: "Gemini AI harcamalarınızı analiz eder, anomalileri tespit eder.",
    icon: Sparkles,
  },
  {
    num: "03",
    title: "Tasarruf Edin",
    description: "Kişiselleştirilmiş önerilerle bütçenizi optimize edin.",
    icon: TrendingUp,
  },
];

const STATS = [
  { value: "6+", label: "AI Destekli Modül" },
  { value: "∞", label: "Kişisel Analiz" },
  { value: "%100", label: "Ücretsiz" },
  { value: "7/24", label: "AI Asistan" },
];

/* ─── Page Component ────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/20 rounded-full blur-[120px] animate-blob" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-violet-500/15 rounded-full blur-[100px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-20 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-[100px] animate-blob animation-delay-4000" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center shadow-lg shadow-brand-500/30">
            <Wallet size={20} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-lg">Akıllı Finans</span>
            <span className="text-brand-400 text-xs block -mt-0.5">AI Asistan</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth?mode=login"
            className="text-sm text-slate-300 hover:text-white transition px-4 py-2"
          >
            Giriş Yap
          </Link>
          <Link
            href="/auth?mode=register"
            className="text-sm bg-brand-600 hover:bg-brand-500 px-5 py-2.5 rounded-xl font-medium transition shadow-lg shadow-brand-600/30 hover:shadow-brand-500/40"
          >
            Başla
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-300 text-sm mb-8 animate-fade-in-up">
          <Sparkles size={14} />
          <span>Gemini AI Destekli Agentic Finans Platformu</span>
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6 animate-fade-in-up">
          Paranızı{" "}
          <span className="bg-gradient-to-r from-brand-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            Akıllıca
          </span>{" "}
          Yönetin
        </h1>

        <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 animate-fade-in-up leading-relaxed">
          Yapay zeka destekli kişisel finans asistanınız. Harcamalarınızı analiz
          eder, tasarruf planı oluşturur, ürün fiyatlarını takip eder ve
          finansal okuryazarlığınızı artırır.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-in-up">
          <Link
            href="/auth?mode=demo"
            className="group flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 px-8 py-3.5 rounded-2xl font-semibold text-lg transition-all shadow-xl shadow-brand-600/30 hover:shadow-brand-500/40 hover:scale-[1.02]"
          >
            <Zap size={20} />
            Demo Hesapla Dene
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/auth?mode=register"
            className="flex items-center gap-2 border border-slate-600 hover:border-slate-400 px-7 py-3.5 rounded-2xl font-medium transition hover:bg-white/5"
          >
            Hesap Oluştur
          </Link>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-brand-300 to-cyan-300 bg-clip-text text-transparent">
                {s.value}
              </div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Her İhtiyaca{" "}
            <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
              AI Çözümü
            </span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Gemini AI'ın gücüyle kişisel finansınızı uçtan uca yönetin.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm p-6 hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/5"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} grid place-items-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}
              >
                <f.icon size={22} className="text-white" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Nasıl{" "}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Çalışır?
            </span>
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            3 basit adımda finansal kontrolü elinize alın.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <div key={step.num} className="relative text-center group">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-slate-700 to-transparent" />
              )}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600/20 to-brand-500/10 border border-brand-500/20 grid place-items-center mx-auto mb-4 group-hover:border-brand-500/40 transition">
                <step.icon size={28} className="text-brand-400" />
              </div>
              <div className="text-xs font-bold text-brand-500 tracking-widest mb-2">
                ADIM {step.num}
              </div>
              <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust Section */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/80 to-brand-950/30 p-10 text-center">
          <div className="flex items-center justify-center gap-2 text-brand-400 text-sm font-medium mb-4">
            <Shield size={16} />
            Güvenli & Gizli
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Verileriniz Sizde Kalır
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto mb-8">
            Tüm veriler tarayıcınızda ve sunucu belleğinde tutulur. Üçüncü
            taraflarla paylaşılmaz. Gemini AI yalnızca analiz için kullanılır.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              "Şifreleme gerektirmez",
              "Kayıt bilgisi yok",
              "Ücretsiz kullanım",
              "Açık kaynak",
            ].map((t) => (
              <span
                key={t}
                className="flex items-center gap-1.5 text-sm text-slate-300 bg-slate-800/50 px-4 py-2 rounded-full"
              >
                <CheckCircle2 size={14} className="text-emerald-400" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Hemen Başlayın
        </h2>
        <p className="text-slate-400 mb-8">
          Demo hesapla tüm özellikleri keşfedin, kendinize ait hesap
          oluşturun.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/auth?mode=demo"
            className="group flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 px-8 py-3.5 rounded-2xl font-semibold transition-all shadow-xl shadow-brand-600/30 hover:shadow-brand-500/40"
          >
            <Zap size={18} />
            Demo ile Keşfet
          </Link>
          <Link
            href="/auth?mode=register"
            className="flex items-center gap-2 border border-slate-600 hover:border-slate-400 px-7 py-3.5 rounded-2xl font-medium transition hover:bg-white/5"
          >
            Kayıt Ol
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-brand-500" />
            <span>Akıllı Finans Asistanı</span>
            <span className="text-slate-700">•</span>
            <span>Hackathon 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-brand-500" />
              Gemini AI
            </span>
            <span>Next.js</span>
            <span>TypeScript</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

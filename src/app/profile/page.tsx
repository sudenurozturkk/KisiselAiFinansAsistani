"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { UserProfile } from "@/lib/types";
import { RotateCcw, User as UserIcon, Shield, Target, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { useToast } from "@/components/Toast";

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      const u = await api.getUser();
      setUser(u.user);
    })();
  }, []);

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const res = await api.updateUser({
        name: user.name,
        monthlyIncome: Number(user.monthlyIncome),
        monthlyBudget: Number(user.monthlyBudget),
        savingsGoal: Number(user.savingsGoal),
        riskTolerance: user.riskTolerance,
        goals: user.goals,
      });
      setUser(res.user);
      setSavedAt(new Date().toLocaleTimeString("tr-TR"));
      toast.success("Kaydedildi", "Profil bilgilerin güncellendi.");
    } catch {
      toast.error("Hata", "Kaydetme başarısız oldu.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (
      !confirm(
        "Tüm verilerin sıfırlanacak ve demo verileri tekrar yüklenecek. Emin misin?",
      )
    )
      return;
    setResetting(true);
    try {
      await api.resetDemo();
      const u = await api.getUser();
      setUser(u.user);
      toast.success("Sıfırlandı", "Demo verileri tekrar yüklendi.");
    } catch {
      toast.error("Hata", "Sıfırlama başarısız oldu.");
    } finally {
      setResetting(false);
    }
  }

  if (!user)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="card space-y-3">
          <Skeleton className="h-6 w-32" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </div>
      </div>
    );

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <UserIcon className="text-brand-600" size={22} />
            Profil
          </h1>
          <p className="text-slate-500 text-sm">
            Kişisel bilgilerin, bütçe ayarların ve hedeflerin.
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="btn-ghost text-rose-600 hover:text-rose-700"
        >
          <RotateCcw size={16} className="mr-1" />{" "}
          {resetting ? "Sıfırlanıyor..." : "Demo Sıfırla"}
        </button>
      </header>

      {/* Kişisel Bilgiler */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Briefcase size={16} className="text-brand-500" />
          <h3 className="font-semibold">Kişisel Finans Bilgileri</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="İsim">
            <input
              className="input"
              value={user.name}
              onChange={(e) => setUser({ ...user, name: e.target.value })}
            />
          </Field>
          <Field label="Aylık gelir (₺)">
            <input
              type="number"
              className="input"
              value={user.monthlyIncome}
              onChange={(e) =>
                setUser({ ...user, monthlyIncome: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Aylık bütçe (₺)">
            <input
              type="number"
              className="input"
              value={user.monthlyBudget}
              onChange={(e) =>
                setUser({ ...user, monthlyBudget: Number(e.target.value) })
              }
            />
          </Field>
          <Field label="Tasarruf hedefi (₺)">
            <input
              type="number"
              className="input"
              value={user.savingsGoal}
              onChange={(e) =>
                setUser({ ...user, savingsGoal: Number(e.target.value) })
              }
            />
          </Field>
        </div>
      </section>

      {/* Risk ve Hedefler */}
      <section className="card space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Target size={16} className="text-brand-500" />
          <h3 className="font-semibold">Hedefler & Risk Profili</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Risk toleransı">
            <div className="flex gap-2 mt-1">
              {(["düşük", "orta", "yüksek"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setUser({ ...user, riskTolerance: level })}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-1.5 ${
                    user.riskTolerance === level
                      ? level === "düşük"
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        : level === "orta"
                          ? "bg-amber-100 text-amber-700 border border-amber-200"
                          : "bg-rose-100 text-rose-700 border border-rose-200"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  <Shield size={14} />
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Finansal hedefler">
            <input
              className="input"
              placeholder="Örn: tatil, araba, ev"
              value={(user.goals || []).join(", ")}
              onChange={(e) =>
                setUser({
                  ...user,
                  goals: e.target.value
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </Field>
        </div>
      </section>

      {/* Kaydet */}
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary px-8">
          {saving ? "Kaydediliyor..." : "Profili Kaydet"}
        </button>
        {savedAt ? (
          <span className="text-xs text-emerald-600">
            ✓ Kaydedildi • {savedAt}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

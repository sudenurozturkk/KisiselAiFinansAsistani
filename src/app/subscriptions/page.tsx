"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Plus,
  CreditCard,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { Skeleton, Badge, Modal } from "@/components/ui";
import { formatTRY } from "@/lib/finance";
import { CATEGORIES, type Subscription, type SubscriptionsResponse } from "@/lib/types";

const FREQ_OPTIONS: { value: Subscription["frequency"]; label: string }[] = [
  { value: "haftalık", label: "Haftalık" },
  { value: "aylık", label: "Aylık" },
  { value: "yıllık", label: "Yıllık" },
];

function monthlyEquiv(amount: number, freq: Subscription["frequency"]) {
  if (freq === "haftalık") return amount * 4.33;
  if (freq === "yıllık") return amount / 12;
  return amount;
}

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const [form, setForm] = useState({
    name: "",
    amount: "",
    frequency: "aylık" as Subscription["frequency"],
    category: "Eğlence" as Subscription["category"],
    nextPaymentDate: "",
    note: "",
  });

  async function load() {
    setLoading(true);
    try {
      const r = await api.getSubscriptions();
      setData(r);
    } catch {
      toast.error("Hata", "Abonelikler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    if (!form.name.trim() || !form.amount) return;
    setSaving(true);
    try {
      await api.addSubscription({
        name: form.name.trim(),
        amount: Number(form.amount),
        frequency: form.frequency,
        category: form.category,
        nextPaymentDate: form.nextPaymentDate || undefined,
        note: form.note.trim() || undefined,
      });
      setForm({ name: "", amount: "", frequency: "aylık", category: "Eğlence", nextPaymentDate: "", note: "" });
      setShowAdd(false);
      await load();
      toast.success("Eklendi", `"${form.name}" aboneliği eklendi.`);
    } catch {
      toast.error("Hata", "Abonelik eklenemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(sub: Subscription) {
    try {
      await api.updateSubscription(sub._id, { active: !sub.active });
      await load();
      toast.success(
        sub.active ? "Pasife alındı" : "Aktifleştirildi",
        `"${sub.name}" ${sub.active ? "pasife alındı" : "aktifleştirildi"}.`,
      );
    } catch {
      toast.error("Hata", "Güncellenemedi.");
    }
  }

  async function deleteSub(sub: Subscription) {
    if (!confirm(`"${sub.name}" aboneliği silinsin mi?`)) return;
    try {
      await api.deleteSubscription(sub._id);
      await load();
    } catch {
      toast.error("Hata", "Silinemedi.");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const subs = data?.subscriptions || [];
  const activeSubs = subs.filter((s) => s.active);
  const inactiveSubs = subs.filter((s) => !s.active);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CreditCard className="text-brand-600" size={22} />
            Abonelik Yönetimi
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Düzenli aboneliklerini ekle, takip et ve bütçeni kontrol altında tut.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} /> Abonelik Ekle
        </button>
      </header>

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card !p-4">
          <div className="label">Toplam Abonelik</div>
          <div className="text-2xl font-semibold mt-1">{subs.length}</div>
        </div>
        <div className="card !p-4">
          <div className="label">Aktif</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-600">{activeSubs.length}</div>
        </div>
        <div className="card !p-4">
          <div className="label">Aylık Toplam</div>
          <div className="text-2xl font-semibold mt-1 text-rose-600">
            {formatTRY(data?.totalMonthly || 0)}
          </div>
        </div>
        <div className="card !p-4">
          <div className="label">Yıllık Maliyet</div>
          <div className="text-2xl font-semibold mt-1">
            {formatTRY(data?.totalYearly || 0)}
          </div>
        </div>
      </div>

      {/* Abonelik Listesi */}
      {subs.length === 0 ? (
        <div className="card text-center py-12">
          <CreditCard size={48} className="mx-auto text-slate-300 mb-4" />
          <div className="font-medium text-slate-600">Henüz abonelik eklenmedi</div>
          <div className="text-sm text-slate-500 mt-1">
            Netflix, Spotify, spor salonu gibi düzenli ödemelerini ekleyerek takip et.
          </div>
          <button onClick={() => setShowAdd(true)} className="btn-primary mt-4">
            <Plus size={16} /> İlk Aboneliği Ekle
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {activeSubs.length > 0 && (
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <CreditCard size={16} /> Aktif Abonelikler ({activeSubs.length})
            </h3>
          )}
          {activeSubs.map((sub) => (
            <SubCard key={sub._id} sub={sub} onToggle={() => toggleActive(sub)} onDelete={() => deleteSub(sub)} />
          ))}

          {inactiveSubs.length > 0 && (
            <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2 mt-4">
              Pasif ({inactiveSubs.length})
            </h3>
          )}
          {inactiveSubs.map((sub) => (
            <SubCard key={sub._id} sub={sub} onToggle={() => toggleActive(sub)} onDelete={() => deleteSub(sub)} />
          ))}
        </div>
      )}

      {/* Ekleme Modalı */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Abonelik Ekle" footer={
        <>
          <button onClick={() => setShowAdd(false)} className="btn-ghost">İptal</button>
          <button onClick={handleAdd} className="btn-primary" disabled={!form.name.trim() || !form.amount || saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Ekle
          </button>
        </>
      }>
        <div className="space-y-3">
          <div>
            <label className="label">Abonelik Adı *</label>
            <input
              className="input mt-1"
              placeholder="Örn: Netflix, Spotify, Spor Salonu, YouTube Premium..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tutar (₺) *</label>
              <input
                type="number"
                className="input mt-1"
                placeholder="Örn: 99"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Sıklık</label>
              <select
                className="input mt-1"
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as Subscription["frequency"] })}
              >
                {FREQ_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kategori</label>
              <select
                className="input mt-1"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as Subscription["category"] })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sonraki Ödeme Tarihi</label>
              <input
                type="date"
                className="input mt-1"
                value={form.nextPaymentDate}
                onChange={(e) => setForm({ ...form, nextPaymentDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Not (opsiyonel)</label>
            <input
              className="input mt-1"
              placeholder="Örn: Aile planı, 4 kişilik..."
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SubCard({
  sub,
  onToggle,
  onDelete,
}: {
  sub: Subscription;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`card !p-4 flex items-center gap-4 group ${!sub.active ? "opacity-50" : ""}`}>
      <div className={`w-12 h-12 rounded-xl grid place-items-center shrink-0 ${sub.active ? "bg-brand-50 text-brand-600" : "bg-slate-100 text-slate-400"}`}>
        <CreditCard size={24} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{sub.name}</span>
          <Badge tone="default">
            {FREQ_OPTIONS.find((f) => f.value === sub.frequency)?.label || sub.frequency}
          </Badge>
          <Badge tone={sub.active ? "good" : "default"}>{sub.active ? "Aktif" : "Pasif"}</Badge>
        </div>
        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
          <span>{sub.category}</span>
          {sub.nextPaymentDate && (
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              Sonraki: {new Date(sub.nextPaymentDate).toLocaleDateString("tr-TR")}
            </span>
          )}
          {sub.note && <span className="italic">{sub.note}</span>}
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="font-semibold text-rose-600">
          {formatTRY(sub.amount)}
          <span className="text-xs text-slate-500 font-normal">
            /{sub.frequency === "yıllık" ? "yıl" : sub.frequency === "haftalık" ? "hafta" : "ay"}
          </span>
        </div>
        {sub.frequency !== "aylık" && (
          <div className="text-[11px] text-slate-500">
            ≈ {formatTRY(Math.round(monthlyEquiv(sub.amount, sub.frequency)))}/ay
          </div>
        )}
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onToggle}
          className={`p-1.5 rounded-lg ${sub.active ? "hover:bg-amber-50 text-amber-600" : "hover:bg-emerald-50 text-emerald-600"}`}
          title={sub.active ? "Pasife al" : "Aktifleştir"}
        >
          {sub.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg"
          title="Sil"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

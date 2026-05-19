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
  Sparkles,
  ArrowDown,
  CheckCircle,
  XCircle,
  ArrowDownCircle,
  MessageSquare,
  Pencil,
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
  const [optReport, setOptReport] = useState<import("@/lib/sub-optimizer").SubOptimizationReport | null>(null);
  const [optLoading, setOptLoading] = useState(false);
  // Düzenleme modalı
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [editForm, setEditForm] = useState({ name: "", amount: "", frequency: "aylık" as Subscription["frequency"], category: "Eğlence" as Subscription["category"], nextPaymentDate: "", note: "" });
  const [editSaving, setEditSaving] = useState(false);
  const toast = useToast();

  const [form, setForm] = useState({
    name: "",
    amount: "",
    frequency: "aylık" as Subscription["frequency"],
    category: "Eğlence" as Subscription["category"],
    nextPaymentDate: "",
    note: "",
  });

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const r = await api.getSubscriptions();
      setData(r);
    } catch {
      if (!silent) toast.error("Hata", "Abonelikler yüklenemedi.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(sub: Subscription) {
    setEditSub(sub);
    setEditForm({
      name: sub.name,
      amount: String(sub.amount),
      frequency: sub.frequency,
      category: sub.category,
      nextPaymentDate: sub.nextPaymentDate ?? "",
      note: sub.note ?? "",
    });
  }

  async function handleEditSave() {
    if (!editSub || !editForm.name.trim() || !editForm.amount) return;
    setEditSaving(true);
    try {
      await api.updateSubscription(editSub._id, {
        name: editForm.name.trim(),
        amount: Number(editForm.amount),
        frequency: editForm.frequency,
        category: editForm.category,
        nextPaymentDate: editForm.nextPaymentDate || undefined,
        note: editForm.note.trim() || undefined,
      });
      toast.success("Güncellendi", `"${editForm.name}" güncellendi.`);
      setEditSub(null);
      load(true);
    } catch {
      toast.error("Hata", "Güncellenemedi.");
    } finally {
      setEditSaving(false);
    }
  }

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
    // Optimistic remove
    setData((prev) => prev ? {
      ...prev,
      subscriptions: prev.subscriptions.filter((s) => s._id !== sub._id),
    } : prev);
    try {
      await api.deleteSubscription(sub._id);
      toast.success("Silindi", `"${sub.name}" kaldırıldı.`);
      load(true);
    } catch {
      toast.error("Hata", "Silinemedi.");
      load(true);
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

      {/* AI Abonelik Optimizasyonu */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={18} className="text-indigo-600" />
          <span className="font-semibold text-indigo-900 text-sm">AI Abonelik Optimizasyonu</span>
          <button
            onClick={async () => {
              setOptLoading(true);
              try {
                const r = await api.getSubOptimization();
                setOptReport(r);
              } catch {} finally { setOptLoading(false); }
            }}
            className="ml-auto text-[11px] font-medium bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-3 py-1 rounded-lg transition-colors flex items-center gap-1"
            disabled={optLoading}
          >
            {optLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {optLoading ? "Analiz ediliyor..." : optReport ? "Yeniden Analiz Et" : "Aboneliklerimi Analiz Et"}
          </button>
        </div>
        {optReport && (
          <div className="space-y-2">
            {optReport.totalMonthlySaving > 0 && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-center">
                <div className="text-xs text-emerald-700">Potansiyel Tasarruf</div>
                <div className="text-xl font-bold text-emerald-700">
                  {formatTRY(optReport.totalMonthlySaving)}<span className="text-xs font-normal">/ay</span>
                  {" · "}
                  {formatTRY(optReport.totalYearlySaving)}<span className="text-xs font-normal">/yıl</span>
                </div>
              </div>
            )}
            <p className="text-xs text-indigo-800">{optReport.summary}</p>
            {optReport.optimizations.filter(o => o.verdict !== "keep").map((opt) => (
              <div key={opt.subscriptionId} className={`rounded-xl p-3 border flex items-start gap-3 ${
                opt.verdict === "cancel" ? "bg-red-50 border-red-200" :
                opt.verdict === "downgrade" ? "bg-amber-50 border-amber-200" :
                "bg-blue-50 border-blue-200"
              }`}>
                <div className="mt-0.5 shrink-0">
                  {opt.verdict === "cancel" ? <XCircle size={16} className="text-red-600" /> :
                   opt.verdict === "downgrade" ? <ArrowDownCircle size={16} className="text-amber-600" /> :
                   <MessageSquare size={16} className="text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs">{opt.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      opt.verdict === "cancel" ? "bg-red-100 text-red-700" :
                      opt.verdict === "downgrade" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    }`}>
                      {opt.verdict === "cancel" ? "İptal Et" : opt.verdict === "downgrade" ? "Düşür" : "Pazarlık Yap"}
                    </span>
                    {opt.monthlySaving > 0 && (
                      <span className="text-[10px] text-emerald-700 font-medium">-{formatTRY(opt.monthlySaving)}/ay</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{opt.reason}</p>
                  {opt.alternative && (
                    <p className="text-[10px] text-indigo-600 mt-1">💡 Alternatif: {opt.alternative}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
            <SubCard key={sub._id} sub={sub} onToggle={() => toggleActive(sub)} onEdit={() => openEdit(sub)} onDelete={() => deleteSub(sub)} />
          ))}

          {inactiveSubs.length > 0 && (
            <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2 mt-4">
              Pasif ({inactiveSubs.length})
            </h3>
          )}
          {inactiveSubs.map((sub) => (
            <SubCard key={sub._id} sub={sub} onToggle={() => toggleActive(sub)} onEdit={() => openEdit(sub)} onDelete={() => deleteSub(sub)} />
          ))}
        </div>
      )}

      {/* Düzenleme Modalı */}
      <Modal open={!!editSub} onClose={() => setEditSub(null)} title={`Düzenle — ${editSub?.name ?? ""}`} size="md" footer={
        <>
          <button onClick={() => setEditSub(null)} className="btn-ghost">İptal</button>
          <button onClick={handleEditSave} disabled={editSaving || !editForm.name.trim() || !editForm.amount} className="btn-primary">
            {editSaving ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} />} Kaydet
          </button>
        </>
      }>
        <div className="space-y-3">
          <div>
            <label className="label">Abonelik Adı *</label>
            <input className="input mt-1" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tutar (₺) *</label>
              <input type="number" className="input mt-1" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Sıklık</label>
              <select className="input mt-1" value={editForm.frequency} onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value as Subscription["frequency"] })}>
                {FREQ_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Kategori</label>
              <select className="input mt-1" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value as Subscription["category"] })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sonraki Ödeme</label>
              <input type="date" className="input mt-1" value={editForm.nextPaymentDate} onChange={(e) => setEditForm({ ...editForm, nextPaymentDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Not</label>
            <input className="input mt-1" value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
          </div>
        </div>
      </Modal>

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
  onEdit,
  onDelete,
}: {
  sub: Subscription;
  onToggle: () => void;
  onEdit: () => void;
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
        <button onClick={onToggle} className={`p-1.5 rounded-lg ${sub.active ? "hover:bg-amber-50 text-amber-600" : "hover:bg-emerald-50 text-emerald-600"}`} title={sub.active ? "Pasife al" : "Aktifleştir"}>
          {sub.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
        </button>
        <button onClick={onEdit} className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg" title="Düzenle">
          <Pencil size={15} />
        </button>
        <button onClick={onDelete} className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg" title="Sil">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

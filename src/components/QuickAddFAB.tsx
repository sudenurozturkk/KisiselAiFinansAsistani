"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Modal } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/types";
import type { Transaction } from "@/lib/types";
import { validateForm, required, isPositive, isNumber } from "@/lib/validation";

/**
 * Floating Action Button — her sayfadan tek tıkla işlem ekleme.
 * Tasarım hedefi: hızlı, klavyeden kullanılabilir, mobilde rahat erişim.
 */
export default function QuickAddFAB({
  onAdded,
}: {
  onAdded?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "gider" as "gelir" | "gider",
    category: "Gıda" as Transaction["category"],
    amount: "",
    note: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  function reset() {
    setForm({ type: "gider", category: "Gıda", amount: "", note: "" });
    setErrors({});
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();

    const result = validateForm(form, {
      amount: [required("Tutar gerekli"), isNumber(), isPositive("Tutar sıfırdan büyük olmalı")],
    });
    if (!result.valid) {
      setErrors(result.errors as Record<string, string>);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      await api.addTransaction({
        type: form.type,
        category: form.category,
        amount: Number(form.amount),
        note: form.note.trim() || undefined,
      });
      toast.success(
        "İşlem eklendi",
        `${form.type === "gelir" ? "+" : "-"}${form.amount}₺ • ${form.category}`,
      );
      reset();
      setOpen(false);
      onAdded?.();
    } catch {
      toast.error("Hata", "İşlem eklenemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Hızlı işlem ekle"
        title="Hızlı işlem ekle (N)"
        className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-30 w-14 h-14 rounded-full bg-brand-600 text-white shadow-lg shadow-brand-500/40 hover:bg-brand-700 hover:scale-105 active:scale-95 transition grid place-items-center"
      >
        <Plus size={24} aria-hidden="true" />
      </button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Hızlı İşlem Ekle"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="btn-ghost"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={() => submit()}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Ekleniyor…" : "Ekle"}
            </button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-3">
          {/* Tür segment */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(["gider", "gelir"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, type: t })}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  form.type === t
                    ? t === "gelir"
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "bg-rose-500 text-white shadow-sm"
                    : "text-slate-600"
                }`}
              >
                {t === "gelir" ? "Gelir" : "Gider"}
              </button>
            ))}
          </div>

          <div>
            <label className="label">Tutar (₺)</label>
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              className={`input mt-1 ${errors.amount ? "border-rose-300" : ""}`}
              placeholder="Örn: 250"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
            {errors.amount && (
              <p className="text-xs text-rose-600 mt-1" role="alert">
                {errors.amount}
              </p>
            )}
          </div>

          <div>
            <label className="label">Kategori</label>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, category: c })}
                  className={`text-xs px-2 py-1.5 rounded-lg font-medium border transition ${
                    form.category === c
                      ? "bg-brand-50 border-brand-300 text-brand-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Not (opsiyonel)</label>
            <input
              className="input mt-1"
              placeholder="Örn: Migros marketten haftalık alışveriş"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}

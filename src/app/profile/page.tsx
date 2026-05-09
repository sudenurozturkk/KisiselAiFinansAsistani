"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CATEGORIES, UserProfile, Transaction } from "@/lib/types";
import { Trash2, Edit2, RotateCcw } from "lucide-react";
import { Modal, Skeleton, EmptyState } from "@/components/ui";
import { useToast } from "@/components/Toast";

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tx, setTx] = useState<Transaction[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [newTx, setNewTx] = useState<{
    type: "gelir" | "gider";
    category: Transaction["category"];
    amount: string;
    note: string;
  }>({
    type: "gider",
    category: "Gıda",
    amount: "",
    note: "",
  });
  const [editTx, setEditTx] = useState<{
    id: string;
    type: "gelir" | "gider";
    category: Transaction["category"];
    amount: string;
    note: string;
  } | null>(null);
  const [filter, setFilter] = useState<"all" | "gelir" | "gider">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [resetting, setResetting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      const u = await api.getUser();
      setUser(u.user);
      const t = await api.getTransactions();
      setTx(t.transactions);
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

  async function addTx(e: React.FormEvent) {
    e.preventDefault();
    if (!newTx.amount) return;
    try {
      await api.addTransaction({ ...newTx, amount: Number(newTx.amount) });
      setNewTx({ type: "gider", category: "Gıda", amount: "", note: "" });
      const t = await api.getTransactions();
      setTx(t.transactions);
      toast.success("İşlem eklendi", "Yeni işlem kaydedildi.");
    } catch {
      toast.error("Hata", "İşlem ekleme başarısız oldu.");
    }
  }

  async function deleteTx(id: string) {
    if (!confirm("Bu işlemi silmek istediğine emin misin?")) return;
    try {
      await api.deleteTransaction(id);
      const t = await api.getTransactions();
      setTx(t.transactions);
      toast.success("Silindi", "İşlem başarıyla silindi.");
    } catch {
      toast.error("Hata", "Silme başarısız oldu.");
    }
  }

  async function updateTx() {
    if (!editTx) return;
    try {
      await api.updateTransaction(editTx.id, {
        type: editTx.type,
        category: editTx.category,
        amount: Number(editTx.amount),
        note: editTx.note,
      });
      setEditTx(null);
      const t = await api.getTransactions();
      setTx(t.transactions);
      toast.success("Güncellendi", "İşlem başarıyla güncellendi.");
    } catch {
      toast.error("Hata", "Güncelleme başarısız oldu.");
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
      const t = await api.getTransactions();
      setTx(t.transactions);
      toast.success("Sıfırlandı", "Demo verileri tekrar yüklendi.");
    } catch {
      toast.error("Hata", "Sıfırlama başarısız oldu.");
    } finally {
      setResetting(false);
    }
  }

  const filteredTx = tx.filter((t) => {
    if (filter !== "all" && t.type !== filter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    return true;
  });

  if (!user)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card space-y-3">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          </div>
          <div className="card space-y-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Profil</h1>
          <p className="text-slate-500 text-sm">
            Kişisel bütçe, hedefler ve risk profilini yönet.
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card space-y-3">
          <h3 className="font-semibold">Kişisel finans</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="İsim">
              <input
                className="input"
                value={user.name}
                onChange={(e) => setUser({ ...user, name: e.target.value })}
              />
            </Field>
            <Field label="Risk toleransı">
              <select
                className="input"
                value={user.riskTolerance}
                onChange={(e) =>
                  setUser({
                    ...user,
                    riskTolerance: e.target.value as
                      | "düşük"
                      | "orta"
                      | "yüksek",
                  })
                }
              >
                <option value="düşük">Düşük</option>
                <option value="orta">Orta</option>
                <option value="yüksek">Yüksek</option>
              </select>
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
            <Field label="Hedefler (virgülle)">
              <input
                className="input"
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
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            {savedAt ? (
              <span className="text-xs text-emerald-600">
                Kaydedildi • {savedAt}
              </span>
            ) : null}
          </div>
        </section>

        <section className="card space-y-3">
          <h3 className="font-semibold">İşlem ekle</h3>
          <form onSubmit={addTx} className="grid grid-cols-2 gap-3">
            <Field label="Tür">
              <select
                className="input"
                value={newTx.type}
                onChange={(e) => setNewTx({ ...newTx, type: e.target.value as "gelir" | "gider" })}
              >
                <option value="gider">Gider</option>
                <option value="gelir">Gelir</option>
              </select>
            </Field>
            <Field label="Kategori">
              <select
                className="input"
                value={newTx.category}
                onChange={(e) =>
                  setNewTx({ ...newTx, category: e.target.value as Transaction["category"] })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tutar (₺)">
              <input
                type="number"
                className="input"
                value={newTx.amount}
                onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                required
              />
            </Field>
            <Field label="Not">
              <input
                className="input"
                value={newTx.note}
                onChange={(e) => setNewTx({ ...newTx, note: e.target.value })}
              />
            </Field>
            <div className="col-span-2">
              <button className="btn-primary" type="submit">
                Ekle
              </button>
            </div>
          </form>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">İşlemler</h4>
              <div className="flex gap-2">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="text-xs py-1 px-2 border rounded"
                >
                  <option value="all">Tümü</option>
                  <option value="gelir">Gelir</option>
                  <option value="gider">Gider</option>
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs py-1 px-2 border rounded"
                >
                  <option value="all">Tüm kategoriler</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ul className="divide-y divide-slate-100 text-sm max-h-80 overflow-y-auto">
              {filteredTx.slice(0, 20).map((t) => (
                <li
                  key={t._id}
                  className="py-2 flex items-center justify-between group"
                >
                  <span>
                    <span className="font-medium">{t.note || t.category}</span>
                    <span className="text-xs text-slate-500 ml-2">
                      {new Date(t.date).toLocaleDateString("tr-TR")}
                    </span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        t.type === "gelir"
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }
                    >
                      {t.type === "gelir" ? "+" : "-"}
                      {t.amount}₺
                    </span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() =>
                          setEditTx({
                            id: t._id!,
                            type: t.type,
                            category: t.category,
                            amount: String(t.amount),
                            note: t.note ?? "",
                          })
                        }
                        className="p-1 hover:bg-slate-100 rounded"
                        title="Düzenle"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => deleteTx(t._id!)}
                        className="p-1 hover:bg-rose-50 text-rose-600 rounded"
                        title="Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {filteredTx.length === 0 && (
                <li className="py-4 text-center text-slate-500 text-xs">
                  İşlem bulunamadı
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>

      <Modal
        open={!!editTx}
        onClose={() => setEditTx(null)}
        title="İşlem Düzenle"
        footer={
          <>
            <button onClick={() => setEditTx(null)} className="btn-ghost">
              İptal
            </button>
            <button onClick={updateTx} className="btn-primary">
              Kaydet
            </button>
          </>
        }
      >
        {editTx ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tür">
              <select
                className="input"
                value={editTx.type}
                onChange={(e) => setEditTx({ ...editTx, type: e.target.value as "gelir" | "gider" })}
              >
                <option value="gider">Gider</option>
                <option value="gelir">Gelir</option>
              </select>
            </Field>
            <Field label="Kategori">
              <select
                className="input"
                value={editTx.category}
                onChange={(e) =>
                  setEditTx({ ...editTx, category: e.target.value as Transaction["category"] })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tutar (₺)">
              <input
                type="number"
                className="input"
                value={editTx.amount}
                onChange={(e) =>
                  setEditTx({ ...editTx, amount: e.target.value })
                }
              />
            </Field>
            <Field label="Not">
              <input
                className="input"
                value={editTx.note}
                onChange={(e) => setEditTx({ ...editTx, note: e.target.value })}
              />
            </Field>
          </div>
        ) : null}
      </Modal>
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

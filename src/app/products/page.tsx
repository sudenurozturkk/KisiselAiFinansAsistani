"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CATEGORIES, type WishlistItem, type WishlistAnalysis } from "@/lib/types";
import { formatTRY } from "@/lib/finance";
import { useToast } from "@/components/Toast";
import { Skeleton, Modal, Badge } from "@/components/ui";
import Markdown from "@/components/Markdown";
import {
  Plus,
  ShoppingBag,
  CheckCircle2,
  Trash2,
  Sparkles,
  Loader2,
  Star,
  Link as LinkIcon,
  AlertCircle,
  ArrowRight,
  Package,
  Clock,
  Ban,
  Search,
} from "lucide-react";

const URGENCY_OPTIONS: { value: WishlistItem["urgency"]; label: string; color: string }[] = [
  { value: "acil", label: "Acil", color: "bg-rose-100 text-rose-700" },
  { value: "ihtiyaç", label: "İhtiyaç", color: "bg-amber-100 text-amber-700" },
  { value: "istek", label: "İstek", color: "bg-blue-100 text-blue-700" },
  { value: "hobi", label: "Hobi", color: "bg-purple-100 text-purple-700" },
];

const ACTION_ICONS: Record<string, typeof CheckCircle2> = {
  buy_now: CheckCircle2,
  wait: Clock,
  skip: Ban,
  find_alternative: Search,
};

const ACTION_LABELS: Record<string, string> = {
  buy_now: "Şimdi Al",
  wait: "Bekle",
  skip: "Vazgeç",
  find_alternative: "Alternatif Bul",
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"wishlist" | "purchased">("wishlist");
  const [showAdd, setShowAdd] = useState(false);
  const [analysis, setAnalysis] = useState<WishlistAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stats, setStats] = useState({ totalEstimated: 0, purchasedTotal: 0, wishlistCount: 0, purchasedCount: 0 });
  const toast = useToast();

  // Form state
  const [form, setForm] = useState({
    name: "",
    url: "",
    price: "",
    category: "Diğer" as WishlistItem["category"],
    priority: 3 as WishlistItem["priority"],
    urgency: "istek" as WishlistItem["urgency"],
    note: "",
  });

  async function load() {
    setLoading(true);
    try {
      const r = await api.getWishlist();
      setItems(r.items);
      setStats({
        totalEstimated: r.totalEstimated,
        purchasedTotal: r.purchasedTotal,
        wishlistCount: r.wishlistCount,
        purchasedCount: r.purchasedCount,
      });
    } catch { /* */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!form.name.trim()) return;
    try {
      await api.addWishlistItem({
        name: form.name,
        url: form.url || undefined,
        price: form.price ? Number(form.price) : undefined,
        category: form.category,
        priority: form.priority,
        urgency: form.urgency,
        note: form.note || undefined,
      });
      setForm({ name: "", url: "", price: "", category: "Diğer", priority: 3, urgency: "istek", note: "" });
      setShowAdd(false);
      await load();
      toast.success("Eklendi", `"${form.name}" istek listesine eklendi.`);
    } catch {
      toast.error("Hata", "Eklenemedi.");
    }
  }

  async function markPurchased(item: WishlistItem) {
    const priceStr = prompt(`"${item.name}" için ödediğiniz tutar (₺):`, String(item.price || item.estimatedPrice || ""));
    if (priceStr === null) return;
    try {
      await api.updateWishlistItem(item._id, {
        status: "purchased",
        purchasedPrice: Number(priceStr) || item.price,
      });
      await load();
      toast.success("Satın alındı", `"${item.name}" satın alınanlar listesine taşındı.`);
    } catch {
      toast.error("Hata", "İşlem başarısız.");
    }
  }

  async function deleteItem(item: WishlistItem) {
    if (!confirm(`"${item.name}" silinsin mi?`)) return;
    try {
      await api.deleteWishlistItem(item._id);
      await load();
    } catch {
      toast.error("Hata", "Silinemedi.");
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const r = await api.analyzeWishlist();
      setAnalysis(r.analysis);
    } catch {
      toast.error("Hata", "AI analizi başarısız oldu.");
    } finally {
      setAnalyzing(false);
    }
  }

  const wishlistItems = items.filter((i) => i.status === "wishlist");
  const purchasedItems = items.filter((i) => i.status === "purchased");
  const displayItems = tab === "wishlist" ? wishlistItems : purchasedItems;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShoppingBag className="text-brand-600" size={22} />
            Akıllı İstek Listesi
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Almak istediğin ürün ve hizmetleri ekle, AI ile önceliklendirip bütçeni planla.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={runAnalysis} disabled={analyzing || wishlistItems.length === 0} className="btn-ghost">
            {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            AI Analiz
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} /> Ekle
          </button>
        </div>
      </header>

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card !p-4">
          <div className="label">İstek Listesi</div>
          <div className="text-2xl font-semibold mt-1">{stats.wishlistCount}</div>
        </div>
        <div className="card !p-4">
          <div className="label">Tahmini Toplam</div>
          <div className="text-2xl font-semibold mt-1 text-amber-600">{formatTRY(stats.totalEstimated)}</div>
        </div>
        <div className="card !p-4">
          <div className="label">Satın Alınan</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-600">{stats.purchasedCount}</div>
        </div>
        <div className="card !p-4">
          <div className="label">Harcanan</div>
          <div className="text-2xl font-semibold mt-1">{formatTRY(stats.purchasedTotal)}</div>
        </div>
      </div>

      {/* AI Analiz Sonucu */}
      {analysis && (
        <div className="card border-brand-200 bg-brand-50/30 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-brand-600" />
            <span className="font-semibold text-brand-900">AI Bütçe & Öncelik Analizi</span>
          </div>
          <p className="text-sm text-slate-700">{analysis.summary}</p>

          {analysis.prioritizedItems.length > 0 && (
            <div className="space-y-2">
              {analysis.prioritizedItems.map((pi) => {
                const Icon = ACTION_ICONS[pi.recommendedAction] || AlertCircle;
                return (
                  <div key={pi.itemId} className="flex items-start gap-3 bg-white rounded-xl p-3 border border-slate-100">
                    <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${
                      pi.recommendedAction === "buy_now" ? "bg-emerald-100 text-emerald-600" :
                      pi.recommendedAction === "wait" ? "bg-amber-100 text-amber-600" :
                      pi.recommendedAction === "find_alternative" ? "bg-blue-100 text-blue-600" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{pi.name}</span>
                        <Badge tone={pi.recommendedAction === "buy_now" ? "good" : pi.recommendedAction === "wait" ? "warn" : "default"}>
                          {ACTION_LABELS[pi.recommendedAction] || pi.recommendedAction}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{pi.reason}</p>
                      {pi.alternativeSuggestion && (
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <Search size={11} /> {pi.alternativeSuggestion}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="text-sm text-slate-700 bg-white rounded-xl p-3 border border-slate-100">
            <div className="font-medium text-xs text-slate-500 mb-1">Bütçe Planı</div>
            <Markdown text={analysis.budgetPlan} />
          </div>
          <button onClick={() => setAnalysis(null)} className="text-xs text-slate-500 underline">Kapat</button>
        </div>
      )}

      {/* Tab Seçimi */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("wishlist")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "wishlist" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          İstek Listesi ({wishlistItems.length})
        </button>
        <button
          onClick={() => setTab("purchased")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "purchased" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Satın Alınanlar ({purchasedItems.length})
        </button>
      </div>

      {/* Öğe Listesi */}
      {displayItems.length === 0 ? (
        <div className="card text-center py-12">
          <Package size={48} className="mx-auto text-slate-300 mb-4" />
          <div className="font-medium text-slate-600">
            {tab === "wishlist" ? "İstek listesi boş" : "Henüz satın alınan ürün yok"}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            {tab === "wishlist"
              ? "Almak istediğin ürün, hizmet veya market listesini ekleyerek başla!"
              : "İstek listesinden satın aldığın ürünleri buraya taşıyabilirsin."}
          </div>
          {tab === "wishlist" && (
            <button onClick={() => setShowAdd(true)} className="btn-primary mt-4">
              <Plus size={16} /> İlk Öğeyi Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayItems.map((item) => (
            <div key={item._id} className="card !p-4 flex items-start gap-4 group">
              {/* Öncelik Yıldızları */}
              <div className="flex flex-col items-center shrink-0 pt-0.5">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={12}
                      className={n <= item.priority ? "text-amber-400 fill-amber-400" : "text-slate-200"}
                    />
                  ))}
                </div>
                <span className={`text-[10px] mt-1 px-1.5 py-0.5 rounded-full font-medium ${
                  URGENCY_OPTIONS.find((u) => u.value === item.urgency)?.color || "bg-slate-100 text-slate-600"
                }`}>
                  {item.urgency}
                </span>
              </div>

              {/* İçerik */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{item.name}</span>
                  <Badge tone="default">{item.category}</Badge>
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                      <LinkIcon size={13} />
                    </a>
                  )}
                </div>
                {item.note && (
                  <p className="text-xs text-slate-500 mt-0.5 italic">&ldquo;{item.note}&rdquo;</p>
                )}
                {item.aiAnalysis && (
                  <p className="text-xs text-brand-600 mt-1">🤖 {item.aiAnalysis}</p>
                )}
                {item.purchasedAt && (
                  <p className="text-xs text-emerald-600 mt-0.5">
                    ✅ {new Date(item.purchasedAt).toLocaleDateString("tr-TR")} tarihinde satın alındı
                  </p>
                )}
              </div>

              {/* Fiyat */}
              <div className="text-right shrink-0">
                {item.status === "purchased" ? (
                  <div className="font-semibold text-emerald-600">
                    {formatTRY(item.purchasedPrice || item.price || 0)}
                  </div>
                ) : (
                  <div>
                    {item.price ? (
                      <div className="font-semibold">{formatTRY(item.price)}</div>
                    ) : item.estimatedPrice ? (
                      <div className="font-semibold text-slate-400">~{formatTRY(item.estimatedPrice)}</div>
                    ) : (
                      <div className="text-xs text-slate-400">Fiyat yok</div>
                    )}
                  </div>
                )}
              </div>

              {/* Aksiyonlar */}
              {item.status === "wishlist" && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => markPurchased(item)}
                    className="p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg"
                    title="Satın alındı olarak işaretle"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                  <button
                    onClick={() => deleteItem(item)}
                    className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg"
                    title="Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
              {item.status === "purchased" && (
                <button
                  onClick={() => deleteItem(item)}
                  className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  title="Sil"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ekleme Modalı */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="İstek Listesine Ekle" footer={
        <>
          <button onClick={() => setShowAdd(false)} className="btn-ghost">İptal</button>
          <button onClick={handleAdd} className="btn-primary" disabled={!form.name.trim()}>
            <Plus size={16} /> Ekle
          </button>
        </>
      }>
        <div className="space-y-3">
          <div>
            <label className="label">Ürün / Hizmet Adı *</label>
            <input
              className="input mt-1"
              placeholder="Örn: Nike Air Max 90, Udemy Yazılım Kursu, Haftalık Market Listesi..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Link (opsiyonel)</label>
            <input
              className="input mt-1"
              placeholder="https://trendyol.com/... veya herhangi bir ürün linki"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tahmini Fiyat (₺)</label>
              <input
                type="number"
                className="input mt-1"
                placeholder="Bilmiyorsan boş bırak, AI tahmin eder"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Kategori</label>
              <select
                className="input mt-1"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as WishlistItem["category"] })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Öncelik (1-5)</label>
              <div className="flex gap-1 mt-1.5">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm({ ...form, priority: n })}
                    className="p-1"
                  >
                    <Star
                      size={20}
                      className={`transition ${n <= form.priority ? "text-amber-400 fill-amber-400" : "text-slate-200 hover:text-amber-200"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Aciliyet</label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {URGENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, urgency: opt.value })}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                      form.urgency === opt.value
                        ? opt.color
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="label">Not / Açıklama</label>
            <textarea
              className="input mt-1"
              rows={2}
              placeholder="Örn: 'İş için acil ihtiyaç', 'Hobi olarak ilgileniyorum', 'İndirim olursa alacağım'..."
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              AI bu notları analiz ederek kişiye özel öneri yapar.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

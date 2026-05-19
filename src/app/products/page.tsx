"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  CATEGORIES,
  type WishlistItem,
  type WishlistAnalysis,
  type ProductScrapeData,
} from "@/lib/types";
import { formatTRY } from "@/lib/finance";
import { useToast } from "@/components/Toast";
import { Skeleton, Modal, Badge, ConfirmDialog } from "@/components/ui";
import Markdown from "@/components/Markdown";
import PriceSparkline from "@/components/PriceSparkline";
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
  Package,
  Clock,
  Ban,
  Search,
  RefreshCw,
  Brain,
  Wand2,
  TrendingDown,
  TrendingUp,
  Tag,
  ImageOff,
  Pencil,
} from "lucide-react";

const URGENCY_OPTIONS: {
  value: WishlistItem["urgency"];
  label: string;
  color: string;
}[] = [
  { value: "acil", label: "Acil", color: "bg-rose-100 text-rose-700" },
  { value: "ihtiyaç", label: "İhtiyaç", color: "bg-amber-100 text-amber-700" },
  { value: "istek", label: "İstek", color: "bg-blue-100 text-blue-700" },
  { value: "hobi", label: "Hobi", color: "bg-purple-100 text-purple-700" },
];

const VERDICT_CONFIG: Record<
  NonNullable<WishlistItem["aiVerdict"]>,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  buy_now: {
    label: "Şimdi al",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  wait: {
    label: "Bekle",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
  },
  skip: {
    label: "Vazgeç",
    color: "bg-slate-100 text-slate-700 border-slate-200",
    icon: Ban,
  },
  find_alternative: {
    label: "Alternatif ara",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Search,
  },
};

type EditForm = {
  name: string;
  price: string;
  category: WishlistItem["category"];
  priority: WishlistItem["priority"];
  urgency: WishlistItem["urgency"];
  note: string;
  description: string;
};

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"wishlist" | "purchased">("wishlist");
  const [showAdd, setShowAdd] = useState(false);
  const [analysis, setAnalysis] = useState<WishlistAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stats, setStats] = useState({
    totalEstimated: 0,
    purchasedTotal: 0,
    wishlistCount: 0,
    purchasedCount: 0,
  });
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<WishlistItem | null>(null);
  const [purchaseModal, setPurchaseModal] = useState<WishlistItem | null>(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  // Düzenleme modalı
  const [editItem, setEditItem] = useState<WishlistItem | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", price: "", category: "Diğer", priority: 3, urgency: "istek", note: "", description: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const toast = useToast();

  // Form state
  const [form, setForm] = useState({
    name: "",
    url: "",
    imageUrl: "",
    description: "",
    brand: "",
    siteName: "",
    price: "",
    category: "Diğer" as WishlistItem["category"],
    priority: 3 as WishlistItem["priority"],
    urgency: "istek" as WishlistItem["urgency"],
    note: "",
  });
  const [scraping, setScraping] = useState(false);
  const [scrapeOk, setScrapeOk] = useState(false);

  function resetForm() {
    setForm({
      name: "",
      url: "",
      imageUrl: "",
      description: "",
      brand: "",
      siteName: "",
      price: "",
      category: "Diğer",
      priority: 3,
      urgency: "istek",
      note: "",
    });
    setScrapeOk(false);
  }

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const r = await api.getWishlist();
      setItems(r.items);
      setStats({
        totalEstimated: r.totalEstimated,
        purchasedTotal: r.purchasedTotal,
        wishlistCount: r.wishlistCount,
        purchasedCount: r.purchasedCount,
      });
    } catch {
      if (!silent) toast.error("Hata", "Liste yüklenemedi.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEdit(item: WishlistItem) {
    setEditItem(item);
    setEditForm({
      name: item.name,
      price: item.price ? String(item.price) : "",
      category: item.category,
      priority: item.priority,
      urgency: item.urgency,
      note: item.note ?? "",
      description: item.description ?? "",
    });
  }

  async function handleEditSave() {
    if (!editItem) return;
    if (!editForm.name.trim()) { toast.error("Eksik", "Ürün adı gerekli."); return; }
    setEditSaving(true);
    // Optimistic update
    setItems((prev) => prev.map((i) =>
      i._id === editItem._id
        ? { ...i, ...editForm, price: editForm.price ? Number(editForm.price) : i.price }
        : i,
    ));
    try {
      await api.updateWishlistItem(editItem._id, {
        name: editForm.name.trim(),
        price: editForm.price ? Number(editForm.price) : undefined,
        category: editForm.category,
        priority: editForm.priority,
        urgency: editForm.urgency,
        note: editForm.note.trim() || undefined,
        description: editForm.description.trim() || undefined,
      });
      toast.success("Güncellendi", `"${editForm.name}" düzenlendi.`);
      setEditItem(null);
      load(true); // sessiz yenileme
    } catch {
      toast.error("Hata", "Güncellenemedi.");
      load(true); // geri al
    } finally {
      setEditSaving(false);
    }
  }

  /** URL'den ürün bilgisi çek (scrape) ve forma doldur. */
  async function handleScrape() {
    const url = form.url.trim();
    if (!url) return;
    setScraping(true);
    setScrapeOk(false);
    try {
      const r = await api.scrapeProductUrl(url);
      if (r.error || !r.data) {
        toast.error(
          "Bilgi alınamadı",
          r.error ?? "Sayfa okunamadı, manuel doldurabilirsin.",
        );
        return;
      }
      const d: ProductScrapeData = r.data;
      setForm((prev) => ({
        ...prev,
        name: d.name?.slice(0, 120) ?? prev.name,
        imageUrl: d.imageUrl ?? prev.imageUrl,
        description: d.description ?? prev.description,
        brand: d.brand ?? prev.brand,
        siteName: d.siteName ?? prev.siteName,
        price: d.price ? String(d.price) : prev.price,
      }));
      setScrapeOk(true);
      toast.success(
        "Bilgi yüklendi",
        `${d.name?.slice(0, 60) ?? "Ürün"}${d.price ? ` • ${formatTRY(d.price)}` : ""}`,
      );
    } catch {
      toast.error("Hata", "Bağlantı kurulamadı.");
    } finally {
      setScraping(false);
    }
  }

  async function handleAdd() {
    if (!form.name.trim()) {
      toast.error("Eksik", "Ürün adı gerekli.");
      return;
    }
    try {
      const addedName = form.name;
      await api.addWishlistItem({
        name: form.name,
        url: form.url || undefined,
        imageUrl: form.imageUrl || undefined,
        description: form.description || undefined,
        brand: form.brand || undefined,
        siteName: form.siteName || undefined,
        price: form.price ? Number(form.price) : undefined,
        category: form.category,
        priority: form.priority,
        urgency: form.urgency,
        note: form.note || undefined,
      });
      resetForm();
      setShowAdd(false);
      toast.success("Eklendi", `"${addedName}" istek listesine eklendi.`);
      load(true); // sessiz yenile — sayfa takılmaz
    } catch {
      toast.error("Hata", "Eklenemedi.");
    }
  }

  async function handlePurchase() {
    if (!purchaseModal) return;
    const price = Number(purchasePrice) || purchaseModal.price || 0;
    try {
      await api.updateWishlistItem(purchaseModal._id, {
        status: "purchased",
        purchasedPrice: price,
      });
      toast.success(
        "Satın alındı",
        `"${purchaseModal.name}" • ${formatTRY(price)}`,
      );
      setPurchaseModal(null);
      setPurchasePrice("");
      await load();
    } catch {
      toast.error("Hata", "İşlem başarısız.");
    }
  }

  async function deleteItem(item: WishlistItem) {
    // Optimistic: hemen listeden kaldır
    setItems((prev) => prev.filter((i) => i._id !== item._id));
    try {
      await api.deleteWishlistItem(item._id);
      toast.success("Silindi", `"${item.name}" listeden çıkarıldı.`);
      load(true);
    } catch {
      toast.error("Hata", "Silinemedi.");
      load(true); // geri al
    }
  }

  async function refreshPrice(item: WishlistItem) {
    setRefreshingIds((prev) => new Set(prev).add(item._id));
    try {
      const r = await api.refreshWishlistPrice(item._id);
      if (!r.priceFound) {
        toast.error("Fiyat alınamadı", r.message);
      } else if (r.dropped) {
        toast.success(
          `🎉 Fiyat düştü %${r.priceDropPct}!`,
          `${formatTRY(r.oldPrice ?? 0)} → ${formatTRY(r.newPrice ?? 0)}`,
        );
      } else {
        toast.success("Fiyat güncel", r.message);
      }
      await load();
    } catch {
      toast.error("Hata", "Fiyat güncellenemedi.");
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    }
  }

  async function aiAnalyzeItem(item: WishlistItem) {
    setAnalyzingIds((prev) => new Set(prev).add(item._id));
    try {
      const r = await api.aiAnalyzeWishlistItem(item._id);
      const verdictLabel = VERDICT_CONFIG[r.analysis.verdict]?.label ?? "AI";
      toast.success(
        `AI Önerisi: ${verdictLabel}`,
        r.analysis.summary.slice(0, 120),
      );
      await load();
    } catch {
      toast.error("Hata", "AI analizi yapılamadı.");
    } finally {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(item._id);
        return next;
      });
    }
  }

  async function runAnalysis() {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const r = await api.analyzeWishlist();
      setAnalysis(r.analysis);
    } catch {
      toast.error("Hata", "Toplu AI analizi başarısız.");
    } finally {
      setAnalyzing(false);
    }
  }

  const wishlistItems = items.filter((i) => i.status === "wishlist");
  const purchasedItems = items.filter((i) => i.status === "purchased");
  const displayItems = tab === "wishlist" ? wishlistItems : purchasedItems;

  // Toplam tasarruf (originalPrice → güncel fiyat)
  const totalSavings = wishlistItems.reduce((sum, i) => {
    if (i.originalPrice && i.price && i.price < i.originalPrice) {
      return sum + (i.originalPrice - i.price);
    }
    return sum;
  }, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
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
            URL yapıştır → AI ürünü tanısın, fiyat takip etsin,
            kişiselleştirilmiş öneri versin.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={runAnalysis}
            disabled={analyzing || wishlistItems.length === 0}
            className="btn-ghost"
          >
            {analyzing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            Toplu AI Analiz
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} /> Ekle
          </button>
        </div>
      </header>

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox
          label="İstek Listesi"
          value={String(stats.wishlistCount)}
          icon={<Package size={16} />}
        />
        <StatBox
          label="Tahmini Toplam"
          value={formatTRY(stats.totalEstimated)}
          tone="warn"
        />
        <StatBox
          label="Şu Ana Kadar Tasarruf"
          value={formatTRY(totalSavings)}
          tone={totalSavings > 0 ? "good" : "default"}
          icon={<TrendingDown size={16} />}
        />
        <StatBox
          label="Satın Alınan"
          value={`${stats.purchasedCount} • ${formatTRY(stats.purchasedTotal)}`}
        />
      </div>

      {/* Toplu AI Analiz Sonucu */}
      {analysis && (
        <div className="card border-brand-200 bg-gradient-to-br from-brand-50/40 to-purple-50/40 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-brand-600" />
            <span className="font-semibold text-brand-900">
              AI Bütçe & Öncelik Analizi
            </span>
          </div>
          <p className="text-sm text-slate-700">{analysis.summary}</p>
          <div className="text-sm text-slate-700 bg-white rounded-xl p-3 border border-slate-100">
            <Markdown text={analysis.budgetPlan} />
          </div>
          <button
            onClick={() => setAnalysis(null)}
            className="text-xs text-slate-500 underline"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Tab Seçimi */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("wishlist")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "wishlist"
              ? "bg-white shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          İstek Listesi ({wishlistItems.length})
        </button>
        <button
          onClick={() => setTab("purchased")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === "purchased"
              ? "bg-white shadow-sm text-slate-900"
              : "text-slate-500 hover:text-slate-700"
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
            {tab === "wishlist"
              ? "İstek listesi boş"
              : "Henüz satın alınan ürün yok"}
          </div>
          <div className="text-sm text-slate-500 mt-1">
            {tab === "wishlist"
              ? "Bir ürün URL'si yapıştırarak başla — AI otomatik analiz eder."
              : "İstek listesinden satın aldığın ürünler burada görünür."}
          </div>
          {tab === "wishlist" && (
            <button
              onClick={() => setShowAdd(true)}
              className="btn-primary mt-4"
            >
              <Plus size={16} /> İlk Öğeyi Ekle
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayItems.map((item) => (
            <ProductCard
              key={item._id}
              item={item}
              refreshing={refreshingIds.has(item._id)}
              analyzing={analyzingIds.has(item._id)}
              onRefreshPrice={() => refreshPrice(item)}
              onAiAnalyze={() => aiAnalyzeItem(item)}
              onEdit={() => openEdit(item)}
              onPurchase={() => {
                setPurchaseModal(item);
                setPurchasePrice(
                  String(item.price ?? item.estimatedPrice ?? ""),
                );
              }}
              onDelete={() => setConfirmDelete(item)}
            />
          ))}
        </div>
      )}

      {/* Ekleme Modalı — büyük, URL-first akış */}
      <Modal
        open={showAdd}
        onClose={() => {
          setShowAdd(false);
          resetForm();
        }}
        title="İstek Listesine Ekle"
        size="lg"
        footer={
          <>
            <button
              onClick={() => {
                setShowAdd(false);
                resetForm();
              }}
              className="btn-ghost"
            >
              İptal
            </button>
            <button
              onClick={handleAdd}
              className="btn-primary"
              disabled={!form.name.trim()}
            >
              <Plus size={16} /> Ekle
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* URL alanı — en üstte, vurgulu */}
          <div className="rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 p-3 space-y-2">
            <label className="label flex items-center gap-1">
              <LinkIcon size={12} /> Ürün URL'si (Trendyol, Hepsiburada,
              Amazon…)
            </label>
            <div className="flex gap-2">
              <input
                className="input"
                placeholder="https://www.trendyol.com/..."
                value={form.url}
                onChange={(e) => {
                  setForm({ ...form, url: e.target.value });
                  setScrapeOk(false);
                }}
              />
              <button
                type="button"
                onClick={handleScrape}
                disabled={!form.url.trim() || scraping}
                className="btn-primary shrink-0"
                title="URL'den ürün bilgisi çek"
              >
                {scraping ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Wand2 size={16} />
                )}
                Bilgi Çek
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {scrapeOk
                ? "✅ Ürün bilgileri otomatik dolduruldu — gözden geçirip ekleyebilirsin."
                : "URL yapıştırıp 'Bilgi Çek' butonuna bas; başlık, fiyat, görsel ve açıklama otomatik yüklenir."}
            </p>
          </div>

          {/* Önizleme: scrape sonrası küçük kart */}
          {(form.imageUrl || form.brand) && (
            <div className="flex gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200">
              {form.imageUrl && (
                <ProductImage src={form.imageUrl} alt={form.name} size="sm" />
              )}
              <div className="flex-1 min-w-0">
                {form.brand && (
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    {form.brand}
                    {form.siteName ? ` • ${form.siteName}` : ""}
                  </div>
                )}
                <div className="text-sm font-medium truncate">{form.name}</div>
                {form.description && (
                  <p className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                    {form.description}
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="label">Ürün / Hizmet Adı *</label>
            <input
              className="input mt-1"
              placeholder="Örn: Nike Air Max 90"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fiyat (₺)</label>
              <input
                type="number"
                className="input mt-1"
                placeholder="Boş bırakırsan AI tahmin eder"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Kategori</label>
              <select
                className="input mt-1"
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as WishlistItem["category"],
                  })
                }
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
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
                    aria-label={`Öncelik ${n}`}
                  >
                    <Star
                      size={20}
                      className={`transition ${
                        n <= form.priority
                          ? "text-amber-400 fill-amber-400"
                          : "text-slate-200 hover:text-amber-200"
                      }`}
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
              placeholder="Örn: 'İş için acil ihtiyaç' — AI bu notları kişiselleştirilmiş öneri için kullanır."
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Satın alma modalı */}
      <Modal
        open={!!purchaseModal}
        onClose={() => {
          setPurchaseModal(null);
          setPurchasePrice("");
        }}
        title="Satın Aldım"
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setPurchaseModal(null);
                setPurchasePrice("");
              }}
              className="btn-ghost"
            >
              İptal
            </button>
            <button onClick={handlePurchase} className="btn-primary">
              <CheckCircle2 size={16} /> Onayla
            </button>
          </>
        }
      >
        {purchaseModal && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              <strong>{purchaseModal.name}</strong> satın alındı olarak
              işaretlenecek.
            </p>
            <div>
              <label className="label">Ödediğin tutar (₺)</label>
              <input
                type="number"
                className="input mt-1"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                autoFocus
              />
              {purchaseModal.originalPrice &&
                Number(purchasePrice) < purchaseModal.originalPrice && (
                  <p className="text-xs text-emerald-600 mt-1">
                    🎉 Orijinal fiyattan{" "}
                    {formatTRY(
                      purchaseModal.originalPrice - Number(purchasePrice),
                    )}{" "}
                    tasarruf!
                  </p>
                )}
            </div>
          </div>
        )}
      </Modal>

      {/* Düzenleme Modalı */}
      <Modal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        title={`Düzenle — ${editItem?.name ?? ""}`}
        size="md"
        footer={
          <>
            <button onClick={() => setEditItem(null)} className="btn-ghost">İptal</button>
            <button onClick={handleEditSave} disabled={editSaving || !editForm.name.trim()} className="btn-primary">
              {editSaving ? <Loader2 size={16} className="animate-spin" /> : <Star size={16} />}
              Kaydet
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Ürün / Hizmet Adı *</label>
            <input
              className="input mt-1"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fiyat (₺)</label>
              <input
                type="number"
                className="input mt-1"
                placeholder="Fiyat"
                value={editForm.price}
                onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Kategori</label>
              <select
                className="input mt-1"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value as WishlistItem["category"] })}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Öncelik (1–5)</label>
              <div className="flex gap-1 mt-1.5">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEditForm({ ...editForm, priority: n })}
                    className="p-1"
                    aria-label={`Öncelik ${n}`}
                  >
                    <Star
                      size={20}
                      className={`transition ${n <= editForm.priority ? "text-amber-400 fill-amber-400" : "text-slate-200 hover:text-amber-200"}`}
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
                    onClick={() => setEditForm({ ...editForm, urgency: opt.value })}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${editForm.urgency === opt.value ? opt.color : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="label">Açıklama</label>
            <input
              className="input mt-1"
              placeholder="Ürün açıklaması"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Not</label>
            <textarea
              className="input mt-1"
              rows={2}
              placeholder="Kişisel notunuz"
              value={editForm.note}
              onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Silme onayı */}
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) await deleteItem(confirmDelete);
        }}
        title={`"${confirmDelete?.name ?? ""}" silinsin mi?`}
        description="Bu işlem geri alınamaz."
        confirmText="Sil"
        destructive
      />
    </div>
  );
}

/* ─── ALT BİLEŞENLER ──────────────────────────────────────── */

function StatBox({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn";
  icon?: React.ReactNode;
}) {
  const colorClass =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-slate-900";
  return (
    <div className="card !p-4">
      <div className="label flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-xl md:text-2xl font-semibold mt-1 ${colorClass}`}>
        {value}
      </div>
    </div>
  );
}

function ProductImage({
  src,
  alt,
  size = "md",
}: {
  src: string;
  alt: string;
  size?: "sm" | "md";
}) {
  const [error, setError] = useState(false);
  const dim = size === "sm" ? "w-16 h-16" : "w-20 h-20";
  if (error) {
    return (
      <div
        className={`${dim} rounded-lg bg-slate-100 grid place-items-center text-slate-400 shrink-0`}
      >
        <ImageOff size={20} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`${dim} rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200`}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
}

function ProductCard({
  item,
  refreshing,
  analyzing,
  onRefreshPrice,
  onAiAnalyze,
  onEdit,
  onPurchase,
  onDelete,
}: {
  item: WishlistItem;
  refreshing: boolean;
  analyzing: boolean;
  onRefreshPrice: () => void;
  onAiAnalyze: () => void;
  onEdit: () => void;
  onPurchase: () => void;
  onDelete: () => void;
}) {
  const verdictCfg = item.aiVerdict ? VERDICT_CONFIG[item.aiVerdict] : null;
  const VerdictIcon = verdictCfg?.icon;
  const purchased = item.status === "purchased";

  const priceDropped =
    item.originalPrice && item.price && item.price < item.originalPrice;
  const dropPct = priceDropped
    ? Math.round(
        ((item.originalPrice! - item.price!) / item.originalPrice!) * 100,
      )
    : 0;

  return (
    <article
      className={`card !p-4 flex gap-3 group transition ${
        purchased ? "opacity-70" : ""
      }`}
    >
      {/* Görsel */}
      {item.imageUrl ? (
        <ProductImage src={item.imageUrl} alt={item.name} />
      ) : (
        <div className="w-20 h-20 rounded-lg bg-slate-100 grid place-items-center text-slate-300 shrink-0">
          <Package size={28} />
        </div>
      )}

      {/* İçerik */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Marka + site */}
        {(item.brand || item.siteName) && (
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1">
            {item.brand && <Tag size={10} />}
            {item.brand}
            {item.brand && item.siteName ? " • " : ""}
            {item.siteName}
          </div>
        )}

        {/* Başlık */}
        <h3 className="font-semibold text-sm leading-tight line-clamp-2">
          {item.name}
        </h3>

        {/* Açıklama */}
        {item.description && (
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-snug">
            {item.description}
          </p>
        )}

        {/* Etiketler: kategori, aciliyet, AI verdict, fiyat-düştü */}
        <div className="flex flex-wrap gap-1 items-center mt-0.5">
          <Badge tone="default">{item.category}</Badge>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              URGENCY_OPTIONS.find((u) => u.value === item.urgency)?.color ??
              "bg-slate-100"
            }`}
          >
            {item.urgency}
          </span>
          {/* Yıldızlar inline */}
          <span
            className="flex gap-0.5"
            title={`Öncelik: ${item.priority}/5`}
            aria-label={`Öncelik ${item.priority} / 5`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={11}
                className={
                  n <= item.priority
                    ? "text-amber-400 fill-amber-400"
                    : "text-slate-200"
                }
              />
            ))}
          </span>
          {priceDropped && !purchased && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
              <TrendingDown size={10} /> %{dropPct} indi
            </span>
          )}
          {verdictCfg && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold border flex items-center gap-0.5 ${verdictCfg.color}`}
              title="AI önerisi"
            >
              {VerdictIcon && <VerdictIcon size={10} />} {verdictCfg.label}
            </span>
          )}
        </div>

        {/* AI yorumu — tıklayınca göster */}
        {!purchased && (
          item.aiAnalysis ? (
            <details className="mt-1">
              <summary className="text-[11px] text-brand-700 cursor-pointer flex items-center gap-1.5 w-fit rounded-lg hover:bg-brand-50 px-1.5 py-0.5 transition">
                <Brain size={11} />
                <span>AI Yorumu</span>
              </summary>
              <p className="text-[11px] text-slate-700 leading-relaxed mt-1 whitespace-pre-line bg-brand-50/50 rounded-lg p-2 border border-brand-100">
                {item.aiAnalysis}
              </p>
            </details>
          ) : (
            <button
              onClick={onAiAnalyze}
              disabled={analyzing}
              className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-brand-600 hover:bg-brand-50 px-1.5 py-0.5 rounded-lg transition w-fit"
              title="AI ile bu ürünü analiz et"
            >
              {analyzing ? <Loader2 size={11} className="animate-spin" /> : <Brain size={11} />}
              {analyzing ? "Analiz ediliyor…" : "AI Yorumu Al"}
            </button>
          )
        )}

        {/* Kullanıcı notu */}
        {item.note && !item.aiAnalysis && (
          <p className="text-[11px] text-slate-500 italic">
            &ldquo;{item.note}&rdquo;
          </p>
        )}

        {/* Satın alınma bilgisi */}
        {purchased && item.purchasedAt && (
          <p className="text-[11px] text-emerald-600 mt-0.5">
            ✅ {new Date(item.purchasedAt).toLocaleDateString("tr-TR")} •{" "}
            {formatTRY(item.purchasedPrice ?? 0)}
            {item.originalPrice &&
              item.purchasedPrice &&
              item.originalPrice > item.purchasedPrice && (
                <>
                  {" "}
                  <span className="font-semibold">
                    ({formatTRY(item.originalPrice - item.purchasedPrice)}{" "}
                    tasarruf)
                  </span>
                </>
              )}
          </p>
        )}
      </div>

      {/* Sağ: fiyat + aksiyonlar */}
      <div className="flex flex-col items-end justify-between gap-2 shrink-0">
        {/* Fiyat bloğu */}
        <div className="text-right">
          {item.price ? (
            <>
              <div className="font-bold text-lg leading-tight">
                {formatTRY(item.price)}
              </div>
              {priceDropped && (
                <div className="text-[10px] text-slate-400 line-through">
                  {formatTRY(item.originalPrice!)}
                </div>
              )}
            </>
          ) : item.estimatedPrice ? (
            <div>
              <div className="text-[9px] uppercase text-slate-400 tracking-wider">
                AI tahmin
              </div>
              <div className="font-semibold text-slate-500">
                ~{formatTRY(item.estimatedPrice)}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">Fiyat yok</div>
          )}
          {item.priceHistory && item.priceHistory.length >= 2 && (
            <div className="mt-1">
              <PriceSparkline history={item.priceHistory} />
            </div>
          )}
        </div>

        {/* Aksiyon butonları */}
        <div className="flex flex-col gap-1">
          {!purchased && (
            <>
              {item.url && (
                <button
                  onClick={onRefreshPrice}
                  disabled={refreshing}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 disabled:opacity-50 transition"
                  title="Fiyatı güncelle (URL'den yeniden çek)"
                  aria-label="Fiyatı yenile"
                >
                  {refreshing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                </button>
              )}
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                title="Düzenle"
                aria-label="Düzenle"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={onPurchase}
                className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition"
                title="Satın aldım olarak işaretle"
                aria-label="Satın al"
              >
                <CheckCircle2 size={14} />
              </button>
            </>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition"
              title="Siteyi aç"
              aria-label="Siteyi aç"
            >
              <LinkIcon size={14} />
            </a>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 transition"
            title="Sil"
            aria-label="Sil"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

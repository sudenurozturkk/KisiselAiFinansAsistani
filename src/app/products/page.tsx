"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatTRY } from "@/lib/finance";
import { Star, Search, ShoppingCart, Heart } from "lucide-react";
import { Badge, Modal, Skeleton, EmptyState } from "@/components/ui";
import { useToast } from "@/components/Toast";
import type { EnrichedProduct } from "@/lib/types";

interface ProductsData {
  products: EnrichedProduct[];
  context?: {
    remainingBudget: number;
  };
}

export default function ProductsPage() {
  const [data, setData] = useState<ProductsData | null>(null);
  const [filter, setFilter] = useState<"all" | "affordable" | "stretch">("all");
  const [search, setSearch] = useState("");
  const [buyModal, setBuyModal] = useState<{
    product: EnrichedProduct | null;
    installments: number;
  }>({ product: null, installments: 1 });
  const [buying, setBuying] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.getProducts().then(setData);
  }, []);

  const products = useMemo(() => {
    if (!data) return [];
    let filtered = data.products;
    if (filter === "affordable")
      filtered = filtered.filter((p: EnrichedProduct) => p.affordableNow);
    if (filter === "stretch")
      filtered = filtered.filter((p: EnrichedProduct) => !p.affordableNow);
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p: EnrichedProduct) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return filtered;
  }, [data, filter, search]);

  async function handleBuy() {
    if (!buyModal.product || buying) return;
    setBuying(true);
    try {
      await api.buyProduct(buyModal.product.id, buyModal.installments);
      toast.success(
        "Satın alındı",
        `${buyModal.product.name} işlem olarak eklendi.`,
      );
      setBuyModal({ product: null, installments: 1 });
      api.getTransactions().then(() => api.getProducts().then(setData));
    } catch {
      toast.error("Hata", "Satın alma başarısız oldu.");
    } finally {
      setBuying(false);
    }
  }

  const badgeLabels: Record<string, string> = {
    yeni: "Yeni",
    firsat: "Fırsat",
    populer: "Popüler",
    eko: "Eko",
    sinirli: "Sınırlı",
  };
  const badgeTones: Record<string, "brand" | "good" | "warn" | "info" | "bad"> =
    {
      yeni: "brand",
      firsat: "good",
      populer: "warn",
      eko: "good",
      sinirli: "bad",
    };

  if (!data)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card space-y-3">
              <Skeleton className="h-40" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ürünler</h1>
          <p className="text-slate-500 text-sm">
            Kalan bütçen:{" "}
            <span className="font-medium text-slate-800">
              {formatTRY(data.context?.remainingBudget ?? 0)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:border-brand-500 w-40"
            />
          </div>
          {[
            { k: "all", label: "Tümü" },
            { k: "affordable", label: "Bütçeye uygun" },
            { k: "stretch", label: "Zorlayıcı" },
          ].map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k as any)}
              className={`px-3 py-1.5 rounded-full border ${
                filter === f.k
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              title="Ürün bulunamadı"
              description="Arama kriterlerine uygun ürün yok. Filtreleri temizlemeyi deneyin."
              icon={<Search size={40} />}
            />
          </div>
        ) : (
          products.map((p: EnrichedProduct) => (
            <article key={p.id} className="card flex flex-col">
              <div className="aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 mb-3 relative">
                <img
                  src={p.image}
                  alt={p.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 flex gap-1">
                  {p.badges?.map((b) => (
                    <Badge key={b} tone={badgeTones[b] as any}>
                      {badgeLabels[b]}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="chip">{p.category}</span>
                <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                  <Star size={12} className="text-amber-500" /> {p.rating} (
                  {p.reviewCount})
                </span>
              </div>
              <h3 className="mt-2 font-semibold">{p.name}</h3>
              <p className="text-xs text-slate-500">{p.brand}</p>
              <p className="text-xs text-slate-500 line-clamp-2">
                {p.description}
              </p>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-lg font-semibold">
                    {formatTRY(p.price)}
                    {p.oldPrice ? (
                      <span className="text-sm text-slate-400 line-through ml-2">
                        {formatTRY(p.oldPrice)}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.recommendedInstallment > 1
                      ? `${p.recommendedInstallment} taksit • ${formatTRY(p.monthly)}/ay`
                      : "Tek çekim önerilir"}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    p.affordableNow
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {p.affordableNow ? "Bütçede" : "Zorlayıcı"}
                </span>
              </div>
              <div className="mt-3 text-sm text-slate-700 bg-slate-50 rounded-xl p-3 border border-slate-100">
                {p.advice}
              </div>
              <button
                onClick={() =>
                  setBuyModal({
                    product: p,
                    installments: p.recommendedInstallment,
                  })
                }
                className="mt-3 btn-primary"
              >
                <ShoppingCart size={16} className="mr-1.5" /> Satın Al
              </button>
            </article>
          ))
        )}
      </div>

      <Modal
        open={!!buyModal.product}
        onClose={() => setBuyModal({ product: null, installments: 1 })}
        title="Satın Al"
        footer={
          <>
            <button
              onClick={() => setBuyModal({ product: null, installments: 1 })}
              className="btn-ghost"
            >
              İptal
            </button>
            <button
              onClick={handleBuy}
              disabled={buying}
              className="btn-primary"
            >
              {buying ? "Satın alınıyor..." : "Satın Al"}
            </button>
          </>
        }
      >
        {buyModal.product ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={buyModal.product.image}
                alt=""
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div>
                <div className="font-semibold">{buyModal.product.name}</div>
                <div className="text-sm text-slate-500">
                  {formatTRY(buyModal.product.price)}
                </div>
              </div>
            </div>
            <div>
              <label className="label">Taksit sayısı</label>
              <select
                className="input"
                value={buyModal.installments}
                onChange={(e) =>
                  setBuyModal({
                    ...buyModal,
                    installments: Number(e.target.value),
                  })
                }
              >
                {buyModal.product.installments.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "Tek çekim" : `${n} taksit`}
                  </option>
                ))}
              </select>
              <div className="text-xs text-slate-500 mt-1">
                Aylık:{" "}
                {formatTRY(
                  Math.round(buyModal.product.price / buyModal.installments),
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

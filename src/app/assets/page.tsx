"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { formatTRY } from "@/lib/finance";
import { useToast } from "@/components/Toast";
import { Skeleton, Modal, ConfirmDialog, Badge } from "@/components/ui";
import {
  Plus,
  Trash2,
  Pencil,
  TrendingUp,
  TrendingDown,
  Landmark,
  Wallet,
  Coins,
  Building2,
  BarChart3,
  Loader2,
  DollarSign,
  PiggyBank,
  Sparkles,
  Search,
  CheckCircle2,
} from "lucide-react";
import type {
  Asset,
  AssetType,
  AssetsResponse,
  IncomeSource,
  IncomesResponse,
  ASSET_TYPES as AssetTypesArr,
} from "@/lib/types";
import { ASSET_TYPES, INCOME_CATEGORIES } from "@/lib/types";

const ASSET_ICONS: Record<AssetType, typeof Coins> = {
  altın: Coins,
  döviz: DollarSign,
  hisse: BarChart3,
  kripto: Landmark,
  gayrimenkul: Building2,
  fon: PiggyBank,
  diğer: Wallet,
};

export default function AssetsPage() {
  const [tab, setTab] = useState<"assets" | "incomes">("assets");
  const [assetsData, setAssetsData] = useState<AssetsResponse | null>(null);
  const [incomesData, setIncomesData] = useState<IncomesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [confirmDel, setConfirmDel] = useState<{
    type: "asset" | "income";
    id: string;
    name: string;
  } | null>(null);
  const toast = useToast();

  // Asset form
  const [af, setAf] = useState({
    type: "altın" as AssetType,
    name: "",
    ticker: "",
    quantity: "",
    buyPrice: "",
    currentPrice: "",
    note: "",
  });
  // Income form
  const [inf, setInf] = useState({
    name: "",
    amount: "",
    frequency: "aylık" as IncomeSource["frequency"],
    category: "kira" as IncomeSource["category"],
    note: "",
  });

  // AI Sembol Çözme
  const [symbolResolving, setSymbolResolving] = useState(false);
  const [resolvedSymbol, setResolvedSymbol] = useState<{
    symbol: string;
    name: string;
    exchange: string;
  } | null>(null);
  const symbolDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTickerChange = useCallback((value: string) => {
    setAf((prev) => ({ ...prev, ticker: value }));
    setResolvedSymbol(null);
    if (symbolDebounce.current) clearTimeout(symbolDebounce.current);
    if (!value.trim() || value.length < 2) return;
    symbolDebounce.current = setTimeout(async () => {
      setSymbolResolving(true);
      try {
        const res = await api.resolveSymbol(value);
        if (res.found && res.resolved) {
          setResolvedSymbol(res.resolved);
        }
      } catch {
        /* ignore */
      } finally {
        setSymbolResolving(false);
      }
    }, 500);
  }, []);

  function applyResolvedSymbol() {
    if (!resolvedSymbol) return;
    setAf((prev) => ({
      ...prev,
      ticker: resolvedSymbol.symbol,
      name: prev.name || resolvedSymbol.name,
    }));
    toast.success(
      "Sembol çözüldü",
      `${resolvedSymbol.symbol} (${resolvedSymbol.name})`,
    );
  }

  async function load() {
    setLoading(true);
    try {
      const [a, i] = await Promise.all([api.getAssets(), api.getIncomes()]);
      setAssetsData(a);
      setIncomesData(i);
    } catch {
      toast.error("Hata", "Veriler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetAssetForm() {
    setAf({
      type: "altın",
      name: "",
      ticker: "",
      quantity: "",
      buyPrice: "",
      currentPrice: "",
      note: "",
    });
  }
  function resetIncomeForm() {
    setInf({
      name: "",
      amount: "",
      frequency: "aylık",
      category: "kira",
      note: "",
    });
  }

  async function handleAddAsset() {
    if (!af.name.trim()) {
      toast.error("Eksik", "Varlık adı gerekli.");
      return;
    }
    try {
      await api.addAsset({
        type: af.type,
        name: af.name,
        ticker: af.ticker || undefined,
        quantity: Number(af.quantity) || 0,
        buyPrice: Number(af.buyPrice) || 0,
        currentPrice: Number(af.currentPrice) || 0,
        note: af.note || undefined,
      });
      toast.success("Eklendi", `"${af.name}" portföyünüze eklendi.`);
      resetAssetForm();
      setShowAddAsset(false);
      await load();
    } catch {
      toast.error("Hata", "Eklenemedi.");
    }
  }

  async function handleUpdateAsset() {
    if (!editAsset) return;
    try {
      await api.updateAsset(editAsset._id, {
        currentPrice: Number(af.currentPrice) || editAsset.currentPrice,
        quantity: Number(af.quantity) || editAsset.quantity,
        note: af.note || editAsset.note,
      });
      toast.success("Güncellendi", `"${editAsset.name}" güncellendi.`);
      setEditAsset(null);
      resetAssetForm();
      await load();
    } catch {
      toast.error("Hata", "Güncellenemedi.");
    }
  }

  async function handleAddIncome() {
    if (!inf.name.trim()) {
      toast.error("Eksik", "Gelir adı gerekli.");
      return;
    }
    try {
      await api.addIncome({
        name: inf.name,
        amount: Number(inf.amount) || 0,
        frequency: inf.frequency,
        category: inf.category,
        active: true,
        note: inf.note || undefined,
      });
      toast.success("Eklendi", `"${inf.name}" ek gelirlere eklendi.`);
      resetIncomeForm();
      setShowAddIncome(false);
      await load();
    } catch {
      toast.error("Hata", "Eklenemedi.");
    }
  }

  async function handleDelete() {
    if (!confirmDel) return;
    try {
      if (confirmDel.type === "asset") await api.deleteAsset(confirmDel.id);
      else await api.deleteIncome(confirmDel.id);
      toast.success("Silindi", `"${confirmDel.name}" kaldırıldı.`);
      setConfirmDel(null);
      await load();
    } catch {
      toast.error("Hata", "Silinemedi.");
    }
  }

  async function toggleIncomeActive(inc: IncomeSource) {
    try {
      await api.updateIncome(inc._id, { active: !inc.active });
      toast.success(
        inc.active ? "Pasifleştirildi" : "Aktifleştirildi",
        inc.name,
      );
      await load();
    } catch {
      toast.error("Hata", "Güncellenemedi.");
    }
  }

  if (loading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );

  const assets = assetsData?.assets ?? [];
  const incomes = incomesData?.incomes ?? [];
  const totalAssetValue = assetsData?.totalValue ?? 0;
  const totalProfit = assetsData?.totalProfit ?? 0;
  const profitPct = assetsData?.profitPercent ?? 0;
  const totalMonthlyIncome = incomesData?.totalMonthly ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Landmark className="text-brand-600" size={22} /> Varlıklarım & Ek
            Gelirler
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Yatırımlarınızı, gayrimenkullerinizi ve pasif gelirlerinizi tek
            yerden yönetin.
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
              <TrendingUp size={9} /> Canlı Fiyatlar
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "assets" ? (
            <button
              onClick={() => setShowAddAsset(true)}
              className="btn-primary"
            >
              <Plus size={16} /> Varlık Ekle
            </button>
          ) : (
            <button
              onClick={() => setShowAddIncome(true)}
              className="btn-primary"
            >
              <Plus size={16} /> Gelir Ekle
            </button>
          )}
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Toplam Portföy"
          value={formatTRY(totalAssetValue)}
          icon={<Wallet size={16} />}
        />
        <SummaryCard
          label="Toplam Kâr/Zarar"
          value={`${totalProfit >= 0 ? "+" : ""}${formatTRY(totalProfit)}`}
          tone={totalProfit >= 0 ? "good" : "bad"}
          icon={
            totalProfit >= 0 ? (
              <TrendingUp size={16} />
            ) : (
              <TrendingDown size={16} />
            )
          }
        />
        <SummaryCard
          label="Getiri Oranı"
          value={`%${profitPct.toFixed(1)}`}
          tone={profitPct >= 0 ? "good" : "bad"}
        />
        <SummaryCard
          label="Aylık Ek Gelir"
          value={formatTRY(totalMonthlyIncome)}
          tone="good"
          icon={<PiggyBank size={16} />}
        />
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("assets")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "assets" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
        >
          Varlıklar ({assets.length})
        </button>
        <button
          onClick={() => setTab("incomes")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "incomes" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
        >
          Ek Gelirler ({incomes.length})
        </button>
      </div>

      {/* Assets Tab */}
      {tab === "assets" &&
        (assets.length === 0 ? (
          <div className="card text-center py-12">
            <Coins size={48} className="mx-auto text-slate-300 mb-4" />
            <div className="font-medium text-slate-600">
              Henüz varlık eklenmemiş
            </div>
            <button
              onClick={() => setShowAddAsset(true)}
              className="btn-primary mt-4"
            >
              <Plus size={16} /> İlk Varlığı Ekle
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assets.map((a) => {
              const Icon = ASSET_ICONS[a.type] || Wallet;
              const profit = (a.currentPrice - a.buyPrice) * a.quantity;
              const pct =
                a.buyPrice > 0
                  ? ((a.currentPrice - a.buyPrice) / a.buyPrice) * 100
                  : 0;
              const typeInfo = ASSET_TYPES.find((t) => t.value === a.type);
              return (
                <div key={a._id} className="card !p-4 flex gap-4 group">
                  <div
                    className={`w-12 h-12 rounded-xl grid place-items-center shrink-0 ${profit >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
                  >
                    <Icon size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{a.name}</span>
                      {a.ticker && <Badge tone="info">{a.ticker}</Badge>}
                      <Badge tone="brand">
                        {typeInfo?.icon} {typeInfo?.label}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {a.quantity} birim × {formatTRY(a.currentPrice)} ={" "}
                      <span className="font-semibold text-slate-900">
                        {formatTRY(a.currentValue)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
                      <span className="text-slate-400">
                        Alış: {formatTRY(a.buyPrice)}
                      </span>
                      <span
                        className={
                          profit >= 0
                            ? "text-emerald-600 font-medium"
                            : "text-rose-600 font-medium"
                        }
                      >
                        {profit >= 0 ? "+" : ""}
                        {formatTRY(profit)} ({pct >= 0 ? "+" : ""}
                        {pct.toFixed(1)}%)
                      </span>
                      {a.dailyChangePct !== undefined &&
                        a.dailyChangePct !== 0 && (
                          <span
                            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold text-[10px] ${a.dailyChangePct > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
                          >
                            {a.dailyChangePct > 0 ? (
                              <TrendingUp size={10} />
                            ) : (
                              <TrendingDown size={10} />
                            )}
                            Bugün: {a.dailyChangePct > 0 ? "+" : ""}
                            {a.dailyChangePct.toFixed(2)}%
                          </span>
                        )}
                    </div>
                    {a.note && (
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        {a.note}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button
                      onClick={() => {
                        setEditAsset(a);
                        setAf({
                          ...af,
                          quantity: String(a.quantity),
                          currentPrice: String(a.currentPrice),
                          note: a.note || "",
                        });
                      }}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-600"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() =>
                        setConfirmDel({
                          type: "asset",
                          id: a._id,
                          name: a.name,
                        })
                      }
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {/* Incomes Tab */}
      {tab === "incomes" &&
        (incomes.length === 0 ? (
          <div className="card text-center py-12">
            <PiggyBank size={48} className="mx-auto text-slate-300 mb-4" />
            <div className="font-medium text-slate-600">
              Henüz ek gelir eklenmemiş
            </div>
            <button
              onClick={() => setShowAddIncome(true)}
              className="btn-primary mt-4"
            >
              <Plus size={16} /> İlk Geliri Ekle
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {incomes.map((inc) => {
              const catInfo = INCOME_CATEGORIES.find(
                (c) => c.value === inc.category,
              );
              return (
                <div
                  key={inc._id}
                  className={`card !p-4 flex items-center gap-4 ${!inc.active ? "opacity-50" : ""}`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${inc.active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}
                  >
                    <DollarSign size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{inc.name}</span>
                      <Badge tone={inc.active ? "good" : "default"}>
                        {inc.active ? "Aktif" : "Pasif"}
                      </Badge>
                      <Badge tone="info">{catInfo?.label}</Badge>
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5">
                      <span className="font-semibold text-slate-900">
                        {formatTRY(inc.amount)}
                      </span>{" "}
                      / {inc.frequency}
                      {inc.note && (
                        <span className="text-slate-400 ml-2">
                          • {inc.note}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleIncomeActive(inc)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${inc.active ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}
                    >
                      {inc.active ? "Pasifleştir" : "Aktifleştir"}
                    </button>
                    <button
                      onClick={() =>
                        setConfirmDel({
                          type: "income",
                          id: inc._id,
                          name: inc.name,
                        })
                      }
                      className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}

      {/* Add Asset Modal */}
      <Modal
        open={showAddAsset}
        onClose={() => {
          setShowAddAsset(false);
          resetAssetForm();
        }}
        title="Yeni Varlık Ekle"
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowAddAsset(false);
                resetAssetForm();
              }}
              className="btn-ghost"
            >
              İptal
            </button>
            <button
              onClick={handleAddAsset}
              className="btn-primary"
              disabled={!af.name.trim()}
            >
              <Plus size={16} /> Ekle
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Varlık Türü</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {ASSET_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setAf({ ...af, type: t.value })}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${af.type === t.value ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Varlık Adı *</label>
              <input
                className="input mt-1"
                placeholder="Örn: Gram Altın, THY, Bitcoin"
                value={af.name}
                onChange={(e) => setAf({ ...af, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label flex items-center gap-1">
                Sembol / Ticker
                {symbolResolving && (
                  <Loader2 size={12} className="animate-spin text-brand-500" />
                )}
              </label>
              <input
                className="input mt-1"
                placeholder="Örn: THY, GARAN, BTC"
                value={af.ticker}
                onChange={(e) => handleTickerChange(e.target.value)}
              />
              {resolvedSymbol && (
                <button
                  type="button"
                  onClick={applyResolvedSymbol}
                  className="mt-1.5 flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition w-full"
                >
                  <Sparkles size={12} />
                  <span>
                    AI: <strong>{resolvedSymbol.symbol}</strong> (
                    {resolvedSymbol.name}) olarak algılandı
                  </span>
                  <CheckCircle2 size={12} className="ml-auto" />
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Miktar</label>
              <input
                type="number"
                className="input mt-1"
                placeholder="50"
                value={af.quantity}
                onChange={(e) => setAf({ ...af, quantity: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Alış Fiyatı (₺)</label>
              <input
                type="number"
                className="input mt-1"
                placeholder="2850"
                value={af.buyPrice}
                onChange={(e) => setAf({ ...af, buyPrice: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Güncel Fiyat (₺)</label>
              <input
                type="number"
                className="input mt-1"
                placeholder="Otomatik çekilir"
                value={af.currentPrice}
                onChange={(e) => setAf({ ...af, currentPrice: e.target.value })}
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Ticker varsa API'den otomatik çekilir
              </p>
            </div>
          </div>
          <div>
            <label className="label">Not</label>
            <input
              className="input mt-1"
              placeholder="Opsiyonel açıklama"
              value={af.note}
              onChange={(e) => setAf({ ...af, note: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Edit Asset Modal */}
      <Modal
        open={!!editAsset}
        onClose={() => {
          setEditAsset(null);
          resetAssetForm();
        }}
        title={`"${editAsset?.name}" Güncelle`}
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setEditAsset(null);
                resetAssetForm();
              }}
              className="btn-ghost"
            >
              İptal
            </button>
            <button onClick={handleUpdateAsset} className="btn-primary">
              Güncelle
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Miktar</label>
            <input
              type="number"
              className="input mt-1"
              value={af.quantity}
              onChange={(e) => setAf({ ...af, quantity: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Güncel Fiyat (₺)</label>
            <input
              type="number"
              className="input mt-1"
              value={af.currentPrice}
              onChange={(e) => setAf({ ...af, currentPrice: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Not</label>
            <input
              className="input mt-1"
              value={af.note}
              onChange={(e) => setAf({ ...af, note: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* Add Income Modal */}
      <Modal
        open={showAddIncome}
        onClose={() => {
          setShowAddIncome(false);
          resetIncomeForm();
        }}
        title="Yeni Ek Gelir Ekle"
        size="md"
        footer={
          <>
            <button
              onClick={() => {
                setShowAddIncome(false);
                resetIncomeForm();
              }}
              className="btn-ghost"
            >
              İptal
            </button>
            <button
              onClick={handleAddIncome}
              className="btn-primary"
              disabled={!inf.name.trim()}
            >
              <Plus size={16} /> Ekle
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Gelir Adı *</label>
            <input
              className="input mt-1"
              placeholder="Örn: Kadıköy Daire Kirası"
              value={inf.name}
              onChange={(e) => setInf({ ...inf, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Miktar (₺)</label>
              <input
                type="number"
                className="input mt-1"
                placeholder="14500"
                value={inf.amount}
                onChange={(e) => setInf({ ...inf, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Sıklık</label>
              <select
                className="input mt-1"
                value={inf.frequency}
                onChange={(e) =>
                  setInf({
                    ...inf,
                    frequency: e.target.value as IncomeSource["frequency"],
                  })
                }
              >
                <option value="haftalık">Haftalık</option>
                <option value="aylık">Aylık</option>
                <option value="yıllık">Yıllık</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Kategori</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {INCOME_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setInf({ ...inf, category: c.value })}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${inf.category === c.value ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Not</label>
            <input
              className="input mt-1"
              placeholder="Opsiyonel açıklama"
              value={inf.note}
              onChange={(e) => setInf({ ...inf, note: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={handleDelete}
        title={`"${confirmDel?.name}" silinsin mi?`}
        description="Bu işlem geri alınamaz."
        confirmText="Sil"
        destructive
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "bad";
  icon?: React.ReactNode;
}) {
  const color =
    tone === "good"
      ? "text-emerald-600"
      : tone === "bad"
        ? "text-rose-600"
        : "text-slate-900";
  return (
    <div className="card !p-4">
      <div className="label flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className={`text-xl md:text-2xl font-semibold mt-1 ${color}`}>
        {value}
      </div>
    </div>
  );
}

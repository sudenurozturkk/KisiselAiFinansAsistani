"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/ui";
import { CATEGORIES, type Transaction } from "@/lib/types";
import {
  CreditCard, Upload, FileText, CheckCircle2, AlertTriangle,
  Loader2, Plus, X, ChevronDown, ChevronRight,
  Sparkles, ArrowRight, Camera, Trash2, Edit2, Receipt, File,
} from "lucide-react";
import { formatTRY } from "@/lib/finance";
import Link from "next/link";
import type { CSVImportResult } from "@/lib/types";

type StatementTx = { date: string; description: string; amount: number; category: string; type: string; isInstallment: boolean; installmentInfo: string };
type CardInfo = { bankName: string; cardLast4: string; statementPeriod: string; totalAmount: number; minimumPayment: number };
type StatementResult = { cardInfo: CardInfo; transactions: StatementTx[]; summary: { totalExpense: number; transactionCount: number; topCategory: string }; confidence: number };

const CATEGORY_COLORS: Record<string, string> = {
  "Gıda": "bg-orange-100 text-orange-700",
  "Ulaşım": "bg-blue-100 text-blue-700",
  "Kira/Fatura": "bg-purple-100 text-purple-700",
  "Eğlence": "bg-pink-100 text-pink-700",
  "Alışveriş": "bg-yellow-100 text-yellow-700",
  "Sağlık": "bg-green-100 text-green-700",
  "Eğitim": "bg-cyan-100 text-cyan-700",
  "Yatırım": "bg-emerald-100 text-emerald-700",
  "Diğer": "bg-slate-100 text-slate-600",
};

export default function StatementsPage() {
  const [activeTab, setActiveTab] = useState<"add" | "statement" | "history">("add");
  const [mode, setMode] = useState<"image" | "text" | "pdf">("image");
  const [dragging, setDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState("image/jpeg");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [statement, setStatement] = useState<StatementResult | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedTxs, setSelectedTxs] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [tx, setTx] = useState<Transaction[]>([]);
  const [newTx, setNewTx] = useState<{ type: "gelir" | "gider"; category: Transaction["category"]; amount: string; note: string }>({ type: "gider", category: "Gıda", amount: "", note: "" });
  const [editTx, setEditTx] = useState<{ id: string; type: "gelir" | "gider"; category: Transaction["category"]; amount: string; note: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "gelir" | "gider">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [scannedReceipt, setScannedReceipt] = useState<{
    storeName: string;
    date: string;
    totalAmount: number;
    category: Transaction["category"];
    items?: { name: string }[];
  } | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<CSVImportResult | null>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => { api.getTransactions().then((t) => setTx(t.transactions)).catch(() => {}); }, []);

  async function addTx(e: React.FormEvent) {
    e.preventDefault();
    if (!newTx.amount) return;
    try {
      await api.addTransaction({ ...newTx, amount: Number(newTx.amount) });
      setNewTx({ type: "gider", category: "Gıda", amount: "", note: "" });
      const t = await api.getTransactions(); setTx(t.transactions);
      toast.success("İşlem eklendi", "Yeni işlem kaydedildi.");
    } catch { toast.error("Hata", "İşlem ekleme başarısız."); }
  }

  async function deleteTx(id: string) {
    if (!confirm("Bu işlemi silmek istediğine emin misin?")) return;
    try { await api.deleteTransaction(id); const t = await api.getTransactions(); setTx(t.transactions); toast.success("Silindi", "İşlem silindi."); }
    catch { toast.error("Hata", "Silme başarısız."); }
  }

  async function updateTx() {
    if (!editTx) return;
    try { await api.updateTransaction(editTx.id, { type: editTx.type, category: editTx.category, amount: Number(editTx.amount), note: editTx.note }); setEditTx(null); const t = await api.getTransactions(); setTx(t.transactions); toast.success("Güncellendi", "İşlem güncellendi."); }
    catch { toast.error("Hata", "Güncelleme başarısız."); }
  }

  async function handleReceiptScan(file: File) {
    setScanningReceipt(true);
    setScannedReceipt(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => { reader.onload = () => resolve((reader.result as string).split(",")[1]); reader.onerror = reject; reader.readAsDataURL(file); });
      const res = await api.scanReceipt(base64, file.type);
      const r = res.receipt;
      const receipt = {
        storeName: r.storeName,
        date: r.date,
        totalAmount: r.totalAmount,
        category: r.category as Transaction["category"],
        items: r.items,
      };
      setScannedReceipt(receipt);
      setNewTx({
        type: "gider",
        category: receipt.category,
        amount: String(receipt.totalAmount),
        note:
          receipt.storeName +
          (receipt.items?.length ? ` (${receipt.items.length} ürün)` : ""),
      });
      toast.success("Fiş okundu!", `${receipt.storeName} — ${receipt.totalAmount}₺`);
    } catch { toast.error("Fiş okunamadı", "Daha net fotoğraf deneyin."); }
    finally { setScanningReceipt(false); }
  }

  async function addScannedReceiptToHistory() {
    if (!scannedReceipt) return;
    try {
      await api.addTransaction({
        type: "gider",
        category: scannedReceipt.category,
        amount: scannedReceipt.totalAmount,
        note:
          scannedReceipt.storeName +
          (scannedReceipt.items?.length
            ? ` (${scannedReceipt.items.length} ürün)`
            : ""),
        date: scannedReceipt.date,
      });
      const t = await api.getTransactions();
      setTx(t.transactions);
      setScannedReceipt(null);
      setNewTx({ type: "gider", category: "Gıda", amount: "", note: "" });
      setActiveTab("history");
      toast.success("Harcama geçmişine eklendi", scannedReceipt.storeName);
    } catch {
      toast.error("Hata", "İşlem kaydedilemedi.");
    }
  }

  async function handleCSVImport(file: File) {
    setCsvImporting(true); setCsvResult(null);
    try {
      const text = await file.text(); const result = await api.importCSV(text); setCsvResult(result);
      let added = 0;
      for (const row of result.rows) { try { await api.addTransaction({ type: row.type, category: row.category as Transaction["category"], amount: row.amount, note: row.description, date: row.date }); added++; } catch {} }
      const t = await api.getTransactions(); setTx(t.transactions);
      toast.success("Ekstre aktarıldı!", `${added} işlem eklendi.`);
    } catch { toast.error("İçe aktarma başarısız", "CSV formatını kontrol edin."); }
    finally { setCsvImporting(false); }
  }

  function handleFile(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Hata", "Lütfen bir görüntü dosyası seçin."); return; }
    setImageMime(file.type);
    const reader = new FileReader();
    reader.onload = (e) => { const dataUrl = e.target?.result as string; setImagePreview(dataUrl); setImageBase64(dataUrl.split(",")[1] || ""); };
    reader.readAsDataURL(file);
  }

  function handlePdfFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Hata", "Lütfen bir PDF dosyası seçin.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPdfBase64(dataUrl.split(",")[1] || "");
      setPdfName(file.name);
    };
    reader.readAsDataURL(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setMode("pdf");
      handlePdfFile(file);
    } else {
      handleFile(file);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function analyze() {
    setLoading(true); setStatement(null); setWarning(null);
    try {
      let payload: Record<string, string>;
      if (mode === "image") {
        payload = { image: imageBase64!, mimeType: imageMime };
      } else if (mode === "pdf") {
        payload = { image: pdfBase64!, mimeType: "application/pdf" };
      } else {
        payload = { textContent };
      }
      const res = await api.scanCreditCardStatement(payload);
      setStatement(res.statement);
      if ((res as { warning?: string }).warning) setWarning((res as { warning?: string }).warning || null);
      setSelectedTxs(new Set(res.statement.transactions.map((_: StatementTx, i: number) => i)));
    } catch (e: unknown) { toast.error("Hata", (e instanceof Error) ? e.message : "Ekstre okunamadı."); }
    finally { setLoading(false); }
  }

  async function importSelected() {
    if (!statement) return;
    const toImport = statement.transactions.filter((_, i) => selectedTxs.has(i));
    if (toImport.length === 0) {
      toast.error("Seçim yok", "En az bir işlem seçin.");
      return;
    }
    setImporting(true);
    try {
      const res = await api.importTransactions(
        toImport.map((stx) => ({
          type: stx.type,
          category: stx.category,
          amount: stx.amount,
          description: stx.description,
          date: stx.date,
        })),
      );
      toast.success(
        "İçe aktarıldı",
        `${res.imported} işlem harcama geçmişine eklendi.`,
      );
      setShowImport(false);
      setStatement(null);
      setImagePreview(null);
      setImageBase64(null);
      setPdfBase64(null);
      setPdfName(null);
      setTextContent("");
      const t = await api.getTransactions();
      setTx(t.transactions);
      setActiveTab("history");
    } catch (e: unknown) {
      toast.error(
        "Hata",
        e instanceof Error ? e.message : "İçe aktarma başarısız.",
      );
    } finally {
      setImporting(false);
    }
  }

  function toggleTxSelection(index: number) {
    setSelectedTxs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const filteredTx = tx.filter((t) => { if (filter !== "all" && t.type !== filter) return false; if (categoryFilter !== "all" && t.category !== categoryFilter) return false; return true; });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2"><Receipt className="text-brand-600" size={22} /> Harcamalar</h1>
        <p className="text-slate-500 text-sm mt-0.5">İşlem ekle, fiş tara, ekstre yükle veya geçmişi görüntüle.</p>
      </header>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {([{ key: "add" as const, label: "Manuel Ekle", icon: Plus }, { key: "statement" as const, label: "Ekstre Analizi", icon: CreditCard }, { key: "history" as const, label: "İşlem Geçmişi", icon: FileText }]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)} className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${activeTab === key ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}><Icon size={15} /> {label}</button>
        ))}
      </div>

      {activeTab === "add" && (
        <section className="card space-y-3">
          <h3 className="font-semibold">Yeni İşlem Ekle</h3>
          <form onSubmit={addTx} className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Tür</span><select className="input mt-1" value={newTx.type} onChange={(e) => setNewTx({ ...newTx, type: e.target.value as "gelir" | "gider" })}><option value="gider">Gider</option><option value="gelir">Gelir</option></select></label>
            <label className="block"><span className="label">Kategori</span><select className="input mt-1" value={newTx.category} onChange={(e) => setNewTx({ ...newTx, category: e.target.value as Transaction["category"] })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label className="block"><span className="label">Tutar (₺)</span><input type="number" className="input mt-1" value={newTx.amount} onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })} required /></label>
            <label className="block"><span className="label">Not</span><input className="input mt-1" value={newTx.note} onChange={(e) => setNewTx({ ...newTx, note: e.target.value })} /></label>
            <div className="col-span-2 flex flex-wrap gap-2">
              <button className="btn-primary" type="submit"><Plus size={14} /> Ekle</button>
              <button type="button" className="btn-ghost text-xs" onClick={() => receiptInputRef.current?.click()} disabled={scanningReceipt}>{scanningReceipt ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Fiş Tara (AI)</button>
              <button type="button" className="btn-ghost text-xs" onClick={() => csvInputRef.current?.click()} disabled={csvImporting}>{csvImporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Ekstre Yükle (CSV)</button>
              <input ref={receiptInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReceiptScan(f); e.target.value = ""; }} />
              <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVImport(f); e.target.value = ""; }} />
            </div>
          </form>
          {scannedReceipt && (
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-brand-800">
                <span className="font-medium">{scannedReceipt.storeName}</span>
                {" — "}
                {formatTRY(scannedReceipt.totalAmount)} • {scannedReceipt.category}
              </div>
              <button type="button" onClick={addScannedReceiptToHistory} className="btn-primary text-xs">
                Harcama geçmişine ekle
              </button>
            </div>
          )}
          {csvResult && (<div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><div className="flex items-center gap-2 mb-1"><CheckCircle2 size={16} className="text-emerald-600" /><span className="font-medium text-sm text-emerald-800">Ekstre Aktarıldı</span></div><div className="text-xs text-emerald-700">{csvResult.rows.length} işlem • Gelir: {csvResult.totalIncome}₺ • Gider: {csvResult.totalExpense}₺</div><button onClick={() => setCsvResult(null)} className="text-xs text-emerald-600 underline mt-1">Kapat</button></div>)}
        </section>
      )}

      {activeTab === "statement" && (
        <div className="space-y-6">
          <div className="card !p-2 flex gap-1 w-fit">
            <button onClick={() => setMode("image")} className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${mode === "image" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><Upload size={15} /> Fotoğraf</button>
            <button onClick={() => setMode("pdf")} className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${mode === "pdf" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><File size={15} /> PDF</button>
            <button onClick={() => setMode("text")} className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${mode === "text" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><FileText size={15} /> Metin</button>
          </div>

          {mode === "image" && (
            <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => fileRef.current?.click()} className={`card border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center py-12 gap-4 ${dragging ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:border-brand-300"}`}>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {imagePreview ? (<div className="flex flex-col items-center gap-3">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={imagePreview} alt="Ekstre" className="max-h-48 rounded-xl shadow-md object-contain" /><div className="text-sm text-emerald-600 font-medium"><CheckCircle2 size={16} className="inline mr-1" />Yüklendi</div><button onClick={(e) => { e.stopPropagation(); setImagePreview(null); setImageBase64(null); }} className="text-xs text-slate-400 hover:text-rose-500"><X size={12} className="inline" /> Kaldır</button></div>) : (<><div className="w-16 h-16 rounded-2xl bg-brand-50 grid place-items-center"><Upload size={28} className="text-brand-400" /></div><div className="text-center"><div className="font-medium text-slate-700">Ekstre fotoğrafını sürükle veya tıkla</div><div className="text-sm text-slate-400 mt-1">JPG, PNG, WEBP</div></div></>)}
            </div>
          )}

          {mode === "pdf" && (
            <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => pdfRef.current?.click()} className={`card border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center py-12 gap-4 ${dragging ? "border-brand-400 bg-brand-50" : "border-slate-200 hover:border-brand-300"}`}>
              <input ref={pdfRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdfFile(f); e.target.value = ""; }} />
              {pdfBase64 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-rose-50 grid place-items-center"><File size={28} className="text-rose-500" /></div>
                  <div className="text-sm text-emerald-600 font-medium"><CheckCircle2 size={16} className="inline mr-1" />{pdfName ?? "PDF yüklendi"}</div>
                  <button onClick={(e) => { e.stopPropagation(); setPdfBase64(null); setPdfName(null); }} className="text-xs text-slate-400 hover:text-rose-500"><X size={12} className="inline" /> Kaldır</button>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-rose-50 grid place-items-center"><File size={28} className="text-rose-400" /></div>
                  <div className="text-center">
                    <div className="font-medium text-slate-700">PDF ekstresini sürükle veya tıkla</div>
                    <div className="text-sm text-slate-400 mt-1">Kredi kartı ekstresi PDF • AI okuyup işlem listesi çıkarır</div>
                  </div>
                </>
              )}
            </div>
          )}

          {mode === "text" && (
            <div className="card space-y-3"><label className="label">Ekstre metnini yapıştırın</label><textarea className="input min-h-[200px] font-mono text-xs resize-y" placeholder={"Tarih\tİşlem\tTutar\n15.05.2025\tMigros\t-342,50 TL"} value={textContent} onChange={(e) => setTextContent(e.target.value)} /></div>
          )}

          <button
            onClick={analyze}
            disabled={
              loading ||
              (mode === "image" ? !imageBase64 : mode === "pdf" ? !pdfBase64 : !textContent.trim())
            }
            className="btn-primary w-full py-3 text-base disabled:opacity-50"
          >
            {loading ? <><Loader2 size={18} className="animate-spin" /> Analiz ediliyor…</> : <><Sparkles size={18} /> Ekstreyi Analiz Et</>}
          </button>
          {warning && <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>{warning}</span></div>}
          {statement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="card !p-4"><div className="text-xs text-slate-500">Banka</div><div className="font-semibold mt-1">{statement.cardInfo.bankName || "—"}</div></div>
                <div className="card !p-4"><div className="text-xs text-slate-500">Dönem</div><div className="font-semibold mt-1 text-sm">{statement.cardInfo.statementPeriod || "—"}</div></div>
                <div className="card !p-4"><div className="text-xs text-slate-500">Toplam</div><div className="font-semibold mt-1 text-rose-600">{formatTRY(statement.summary.totalExpense)}</div></div>
                <div className="card !p-4"><div className="text-xs text-slate-500">En Çok</div><div className="font-semibold mt-1">{statement.summary.topCategory || "—"}</div></div>
              </div>
              <div className="card bg-gradient-to-r from-brand-50 to-indigo-50 border-brand-200 flex items-center justify-between gap-4">
                <div><div className="font-semibold text-brand-800">İşlemleri içe aktar</div><div className="text-sm text-brand-600">{statement.transactions.length} işlem bulundu</div></div>
                <button type="button" onClick={() => { setSelectedTxs(new Set(statement.transactions.map((_: StatementTx, i: number) => i))); setShowImport(true); }} className="btn-primary shrink-0">İçe Aktar <ArrowRight size={16} /></button>
              </div>
              <div className="card !p-0 overflow-hidden">
                <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto text-sm">
                  {statement.transactions.map((stx: StatementTx, i: number) => (
                    <li key={i} className="px-4 py-2 flex items-center justify-between gap-2">
                      <span className="truncate"><span className="font-medium">{stx.description}</span><span className="text-xs text-slate-500 ml-2">{stx.date}</span></span>
                      <span className="text-rose-600 shrink-0">-{formatTRY(stx.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Tüm İşlemler ({filteredTx.length})</h3>
            <div className="flex gap-2">
              <select value={filter} onChange={(e) => setFilter(e.target.value as "all" | "gelir" | "gider")} className="text-xs py-1 px-2 border rounded"><option value="all">Tümü</option><option value="gelir">Gelir</option><option value="gider">Gider</option></select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="text-xs py-1 px-2 border rounded"><option value="all">Tüm kategoriler</option>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </div>
          </div>
          <ul className="divide-y divide-slate-100 text-sm max-h-[500px] overflow-y-auto">
            {filteredTx.slice(0, 50).map((t) => (
              <li key={t._id} className="py-2 flex items-center justify-between group">
                <span><span className="font-medium">{t.note || t.category}</span><span className="text-xs text-slate-500 ml-2">{new Date(t.date).toLocaleDateString("tr-TR")}</span></span>
                <div className="flex items-center gap-3">
                  <span className={t.type === "gelir" ? "text-emerald-600" : "text-rose-600"}>{t.type === "gelir" ? "+" : "-"}{t.amount.toLocaleString("tr-TR")}₺</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditTx({ id: t._id!, type: t.type, category: t.category, amount: String(t.amount), note: t.note ?? "" })} className="p-1 hover:bg-slate-100 rounded"><Edit2 size={14} /></button>
                    <button onClick={() => deleteTx(t._id!)} className="p-1 hover:bg-rose-50 text-rose-600 rounded"><Trash2 size={14} /></button>
                  </div>
                </div>
              </li>
            ))}
            {filteredTx.length === 0 && <li className="py-4 text-center text-slate-500 text-xs">İşlem bulunamadı</li>}
          </ul>
        </section>
      )}

      <Modal open={showImport} onClose={() => setShowImport(false)} title="İşlemleri İçe Aktar" size="md" footer={<><button type="button" onClick={() => setShowImport(false)} className="btn-ghost">İptal</button><button type="button" onClick={importSelected} disabled={importing || selectedTxs.size === 0} className="btn-primary">{importing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Harcama geçmişine ekle</button></>}>
        <p className="text-sm text-slate-700 mb-3">Seçili <strong>{selectedTxs.size} işlem</strong> kaydedilecek.</p>
        {statement && (
          <ul className="divide-y divide-slate-100 max-h-72 overflow-y-auto text-sm border rounded-xl">
            {statement.transactions.map((stx: StatementTx, i: number) => (
              <li key={i} className="px-3 py-2 flex items-center gap-3">
                <input type="checkbox" checked={selectedTxs.has(i)} onChange={() => toggleTxSelection(i)} className="rounded" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{stx.description}</div>
                  <div className="text-xs text-slate-500">{stx.date} • {stx.category}</div>
                </div>
                <span className="text-rose-600 shrink-0">-{formatTRY(stx.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <Modal open={!!editTx} onClose={() => setEditTx(null)} title="İşlem Düzenle" footer={<><button onClick={() => setEditTx(null)} className="btn-ghost">İptal</button><button onClick={updateTx} className="btn-primary">Kaydet</button></>}>
        {editTx && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">Tür</span><select className="input mt-1" value={editTx.type} onChange={(e) => setEditTx({ ...editTx, type: e.target.value as "gelir" | "gider" })}><option value="gider">Gider</option><option value="gelir">Gelir</option></select></label>
            <label className="block"><span className="label">Kategori</span><select className="input mt-1" value={editTx.category} onChange={(e) => setEditTx({ ...editTx, category: e.target.value as Transaction["category"] })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label className="block"><span className="label">Tutar (₺)</span><input type="number" className="input mt-1" value={editTx.amount} onChange={(e) => setEditTx({ ...editTx, amount: e.target.value })} /></label>
            <label className="block"><span className="label">Not</span><input className="input mt-1" value={editTx.note} onChange={(e) => setEditTx({ ...editTx, note: e.target.value })} /></label>
          </div>
        )}
      </Modal>
    </div>
  );
}

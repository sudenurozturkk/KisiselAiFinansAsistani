"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui";
import {
  FileText, Globe, Code2, Download, RefreshCw, Loader2,
  CheckCircle2, ChevronDown, Printer, Share2, BarChart3,
} from "lucide-react";
import type { UserProfile } from "@/lib/types";

type ReportFormat = "web" | "pdf" | "json";

interface ReportData {
  format: string;
  markdown?: string;
  generatedAt: string;
  user: UserProfile;
  htmlTemplate?: string;
  summary?: Record<string, unknown>;
  portfolio?: Record<string, unknown>;
}

export default function ReportsPage() {
  const [format, setFormat] = useState<ReportFormat>("web");
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  async function generateReport(fmt: ReportFormat) {
    setFormat(fmt);
    setLoading(true);
    setError(null);
    try {
      const data = await api.getFinancialReport(fmt);
      setReport(data);
    } catch (e) {
      setError("Rapor oluşturulamadı. Lütfen tekrar deneyin.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    generateReport("web");
  }, []);

  function downloadPDF() {
    if (!report?.htmlTemplate) return;
    const blob = new Blob([report.htmlTemplate], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finansal-rapor-${new Date().toISOString().split("T")[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    if (!report?.htmlTemplate) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(report.htmlTemplate);
    win.document.close();
    win.print();
  }

  function downloadJSON() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finansal-rapor-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadMarkdown() {
    if (!report?.markdown) return;
    const blob = new Blob([report.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finansal-rapor-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <FileText className="text-brand-600" size={22} />
            Finansal Rapor
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            AI destekli kişisel finansal analiziniz — PDF, Web veya JSON formatında.
          </p>
        </div>
        <button
          onClick={() => generateReport(format)}
          disabled={loading}
          className="btn-ghost"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Yenile
        </button>
      </header>

      {/* Format Seçimi */}
      <div className="card !p-2 flex gap-1">
        <FormatButton
          active={format === "web"}
          onClick={() => generateReport("web")}
          icon={<Globe size={15} />}
          label="Web Raporu"
          desc="Okunabilir Markdown"
        />
        <FormatButton
          active={format === "pdf"}
          onClick={() => generateReport("pdf")}
          icon={<Printer size={15} />}
          label="PDF / Yazdır"
          desc="Yazdırmaya hazır"
        />
        <FormatButton
          active={format === "json"}
          onClick={() => generateReport("json")}
          icon={<Code2 size={15} />}
          label="JSON Veri"
          desc="Ham yapısal veri"
        />
      </div>

      {/* İndirme Araç Çubuğu */}
      {report && !loading && (
        <div className="flex flex-wrap gap-2">
          {format === "web" && (
            <button onClick={downloadMarkdown} className="btn-ghost text-xs">
              <Download size={14} /> Markdown İndir
            </button>
          )}
          {format === "pdf" && (
            <>
              <button onClick={downloadPDF} className="btn-primary text-xs">
                <Download size={14} /> HTML İndir
              </button>
              <button onClick={printReport} className="btn-ghost text-xs">
                <Printer size={14} /> Yazdır / PDF
              </button>
            </>
          )}
          {format === "json" && (
            <button onClick={downloadJSON} className="btn-ghost text-xs">
              <Download size={14} /> JSON İndir
            </button>
          )}
          <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto">
            <CheckCircle2 size={12} className="text-emerald-500" />
            {new Date(report.generatedAt).toLocaleString("tr-TR")}
          </span>
        </div>
      )}

      {/* İçerik Alanı */}
      {loading && (
        <div className="card space-y-4">
          <div className="flex items-center gap-3 text-brand-600">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm font-medium">Gemini AI rapor hazırlıyor…</span>
          </div>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      )}

      {error && (
        <div className="card border-rose-200 bg-rose-50 text-rose-700 text-sm p-4">
          {error}
        </div>
      )}

      {!loading && !error && report && (
        <div ref={reportRef}>
          {format === "web" && report.markdown && (
            <MarkdownReport markdown={report.markdown} />
          )}

          {format === "pdf" && report.htmlTemplate && (
            <div className="card space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-xl p-3 text-sm">
                <CheckCircle2 size={16} />
                PDF önizleme hazır. "Yazdır / PDF" ile tarayıcınızın PDF kaydetme özelliğini kullanın.
              </div>
              <iframe
                srcDoc={report.htmlTemplate}
                className="w-full rounded-xl border border-slate-200"
                style={{ height: "600px" }}
                title="PDF Rapor Önizlemesi"
              />
            </div>
          )}

          {format === "json" && report.summary && (
            <JSONReport data={report} />
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Format Butonu ─────────────────────────────────────────── */

function FormatButton({
  active, onClick, icon, label, desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl text-left transition-all ${
        active
          ? "bg-brand-600 text-white shadow-sm"
          : "hover:bg-slate-100 text-slate-600"
      }`}
    >
      <span className={active ? "text-white" : "text-brand-500"}>{icon}</span>
      <div>
        <div className="text-sm font-medium leading-none">{label}</div>
        <div className={`text-xs mt-0.5 ${active ? "text-brand-100" : "text-slate-400"}`}>{desc}</div>
      </div>
    </button>
  );
}

/* ─── Markdown Rapor ───────────────────────────────────────── */

function MarkdownReport({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="text-2xl font-bold text-slate-900 mb-2 mt-6 first:mt-0">
          {renderInline(line.slice(2))}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-lg font-semibold text-brand-700 mb-2 mt-5 flex items-center gap-2">
          <BarChart3 size={16} className="text-brand-400 shrink-0" />
          {renderInline(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-semibold text-slate-800 mb-1 mt-4">
          {renderInline(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={i} className="text-sm text-slate-700 ml-4 mb-1 list-disc leading-relaxed">
          {renderInline(line.slice(2))}
        </li>,
      );
    } else if (/^\d+\. /.test(line)) {
      const content = line.replace(/^\d+\. /, "");
      elements.push(
        <li key={i} className="text-sm text-slate-700 ml-4 mb-1 list-decimal leading-relaxed">
          {renderInline(content)}
        </li>,
      );
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-4 border-brand-300 bg-brand-50 text-slate-600 text-sm px-4 py-2 my-2 rounded-r-lg italic">
          {renderInline(line.slice(2))}
        </blockquote>,
      );
    } else if (line.startsWith("|") && line.includes("|")) {
      if (!line.includes("---")) {
        const cells = line.split("|").filter((c) => c.trim());
        const isHeader = lines[i + 1]?.includes("---");
        elements.push(
          isHeader ? (
            <tr key={i} className="bg-slate-50">
              {cells.map((c, j) => (
                <th key={j} className="px-3 py-2 text-xs font-semibold text-left text-slate-700 border border-slate-200">
                  {c.trim()}
                </th>
              ))}
            </tr>
          ) : (
            <tr key={i} className="hover:bg-slate-50">
              {cells.map((c, j) => (
                <td key={j} className="px-3 py-2 text-xs text-slate-600 border border-slate-200">
                  {renderInline(c.trim())}
                </td>
              ))}
            </tr>
          ),
        );
      }
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm text-slate-700 leading-relaxed mb-1">
          {renderInline(line)}
        </p>,
      );
    }
  });

  // Tabloları sarmala
  const wrapped: React.ReactNode[] = [];
  let tableBuffer: React.ReactNode[] = [];
  let inTable = false;

  elements.forEach((el, i) => {
    const type = (el as React.ReactElement)?.type;
    if (type === "tr") {
      if (!inTable) inTable = true;
      tableBuffer.push(el);
    } else {
      if (inTable && tableBuffer.length > 0) {
        wrapped.push(
          <div key={`table-${i}`} className="overflow-x-auto my-3">
            <table className="w-full text-sm border-collapse border border-slate-200 rounded-lg overflow-hidden">
              <tbody>{tableBuffer}</tbody>
            </table>
          </div>,
        );
        tableBuffer = [];
        inTable = false;
      }
      wrapped.push(el);
    }
  });
  if (tableBuffer.length > 0) {
    wrapped.push(
      <div key="table-last" className="overflow-x-auto my-3">
        <table className="w-full text-sm border-collapse border border-slate-200 rounded-lg overflow-hidden">
          <tbody>{tableBuffer}</tbody>
        </table>
      </div>,
    );
  }

  return (
    <div className="card prose-custom">
      {wrapped}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

/* ─── JSON Rapor ─────────────────────────────────────────── */

function JSONReport({ data }: { data: ReportData }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    user: true,
    summary: true,
    portfolio: true,
  });

  const toggle = (key: string) =>
    setExpanded((p) => ({ ...p, [key]: !p[key] }));

  const summary = data.summary as Record<string, unknown> | undefined;
  const portfolio = data.portfolio as Record<string, unknown> | undefined;

  return (
    <div className="space-y-3">
      {/* Kullanıcı */}
      <JsonSection
        title="👤 Kullanıcı Profili"
        expanded={expanded.user!}
        onToggle={() => toggle("user")}
      >
        <JsonRow label="Ad" value={String(data.user?.name || "-")} />
        <JsonRow label="Aylık Gelir" value={`₺${Number(data.user?.monthlyIncome || 0).toLocaleString("tr-TR")}`} />
        <JsonRow label="Bütçe" value={`₺${Number(data.user?.monthlyBudget || 0).toLocaleString("tr-TR")}`} />
        <JsonRow label="Tasarruf Hedefi" value={`₺${Number(data.user?.savingsGoal || 0).toLocaleString("tr-TR")}`} />
        <JsonRow label="Risk Toleransı" value={String(data.user?.riskTolerance || "-")} />
      </JsonSection>

      {/* Finansal Özet */}
      {summary && (
        <JsonSection
          title="📊 Finansal Özet"
          expanded={expanded.summary!}
          onToggle={() => toggle("summary")}
        >
          <JsonRow label="Bu ay gelir" value={`₺${Number(summary.income || 0).toLocaleString("tr-TR")}`} />
          <JsonRow label="Bu ay gider" value={`₺${Number(summary.expense || 0).toLocaleString("tr-TR")}`} />
          <JsonRow label="Net" value={`₺${Number(summary.net || 0).toLocaleString("tr-TR")}`} tone={Number(summary.net) >= 0 ? "good" : "bad"} />
          <JsonRow label="Bütçe Kullanımı" value={`%${summary.budgetUsedPct}`} />
          <JsonRow label="Tasarruf Oranı" value={`%${summary.savingsRate}`} />
          <JsonRow label="Günlük Ort." value={`₺${Number(summary.dailyAvg || 0).toLocaleString("tr-TR")}`} />
          {Array.isArray(summary.topCategories) && (
            <div className="mt-2">
              <div className="text-xs text-slate-500 mb-1 font-medium">En Yüksek Kategoriler</div>
              {(summary.topCategories as { category: string; amount: number }[]).slice(0, 5).map((c, i) => (
                <JsonRow key={i} label={c.category} value={`₺${Number(c.amount).toLocaleString("tr-TR")}`} />
              ))}
            </div>
          )}
        </JsonSection>
      )}

      {/* Portföy */}
      {portfolio && (
        <JsonSection
          title="💼 Yatırım Portföyü"
          expanded={expanded.portfolio!}
          onToggle={() => toggle("portfolio")}
        >
          <JsonRow label="Toplam Değer" value={`₺${Number(portfolio.totalValue || 0).toLocaleString("tr-TR")}`} />
          <JsonRow label="Toplam Maliyet" value={`₺${Number(portfolio.totalCost || 0).toLocaleString("tr-TR")}`} />
          <JsonRow label="Kâr/Zarar" value={`₺${Number(portfolio.totalProfit || 0).toLocaleString("tr-TR")}`} tone={Number(portfolio.totalProfit) >= 0 ? "good" : "bad"} />
          <JsonRow label="Getiri" value={`%${portfolio.profitPercent}`} tone={Number(portfolio.profitPercent) >= 0 ? "good" : "bad"} />
          {Array.isArray(portfolio.assets) && (
            <div className="mt-2">
              <div className="text-xs text-slate-500 mb-1 font-medium">Varlıklar</div>
              {(portfolio.assets as { name: string; ticker: string; currentValue: number; profit: number }[]).map((a, i) => (
                <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-slate-800">{a.name}</span>
                    {a.ticker && a.ticker !== "-" && (
                      <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{a.ticker}</span>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">₺{Number(a.currentValue).toLocaleString("tr-TR")}</div>
                    <div className={`text-[10px] ${Number(a.profit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {Number(a.profit) >= 0 ? "+" : ""}₺{Number(a.profit).toLocaleString("tr-TR")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </JsonSection>
      )}

      {/* Raw JSON */}
      <details className="card">
        <summary className="cursor-pointer text-sm text-slate-500 font-medium flex items-center gap-2">
          <Code2 size={14} /> Ham JSON Veri
        </summary>
        <pre className="mt-3 text-xs text-slate-600 overflow-x-auto bg-slate-50 p-3 rounded-lg">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function JsonSection({
  title, expanded, onToggle, children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-sm font-semibold text-slate-800 mb-2"
      >
        {title}
        <ChevronDown size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

function JsonRow({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-medium ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : "text-slate-800"}`}>
        {value}
      </span>
    </div>
  );
}

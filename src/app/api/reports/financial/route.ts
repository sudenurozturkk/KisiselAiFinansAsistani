import { NextRequest, NextResponse } from "next/server";
import { getUserIdFromReq } from "@/lib/auth";
import { getOrCreateUser, listTransactions, listAssets, seedAllIfEmpty } from "@/lib/repo";
import { generateFinancialReport } from "@/lib/gemini";
import { geminiErrorResponse, getAiMeta } from "@/lib/gemini-required";
import { getMarketSummaryForAI } from "@/lib/market";
import { summarizeFinance, formatTRY } from "@/lib/finance";
import type { Asset } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/reports/financial?format=web|pdf|json
 *
 * format=web  → Markdown rapor (varsayılan)
 * format=json → JSON yapısal veri
 * format=pdf  → PDF-ready HTML
 */
export async function GET(req: NextRequest) {
  try {
  const userId = getUserIdFromReq(req);
  await seedAllIfEmpty(userId);

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "web";

  const [user, txs, assets] = await Promise.all([
    getOrCreateUser(userId),
    listTransactions(userId),
    listAssets(userId),
  ]);

  const summary = summarizeFinance(txs, user.monthlyBudget);
  const generatedAt = new Date().toISOString();

  // Piyasa verisi
  let marketText = "";
  try {
    marketText = await getMarketSummaryForAI();
  } catch { /* fallback: piyasa verisi olmadan devam */ }

  // Varlık özeti
  const totalAssetValue = assets.reduce((s: number, a: Asset) => s + a.currentValue, 0);
  const totalAssetCost = assets.reduce((s: number, a: Asset) => s + a.quantity * a.buyPrice, 0);
  const totalAssetProfit = totalAssetValue - totalAssetCost;

  if (format === "json") {
    return NextResponse.json({
      format: "json",
      generatedAt,
      user: {
        name: user.name,
        monthlyIncome: user.monthlyIncome,
        monthlyBudget: user.monthlyBudget,
        savingsGoal: user.savingsGoal,
        riskTolerance: user.riskTolerance,
        goals: user.goals,
      },
      summary: {
        income: summary.thisMonth.income,
        expense: summary.thisMonth.expense,
        net: summary.thisMonth.net,
        budgetUsedPct: summary.thisMonth.budgetUsedPct,
        savingsRate: summary.savingsRate,
        dailyAvg: summary.dailyAvg,
        projectedMonthEnd: summary.projectedMonthEnd,
        topCategories: summary.topCategories.slice(0, 5),
      },
      portfolio: {
        totalValue: totalAssetValue,
        totalCost: totalAssetCost,
        totalProfit: totalAssetProfit,
        profitPercent: totalAssetCost > 0 ? ((totalAssetProfit / totalAssetCost) * 100).toFixed(1) : "0",
        assets: assets.map(a => ({
          name: a.name,
          type: a.type,
          ticker: a.ticker,
          quantity: a.quantity,
          buyPrice: a.buyPrice,
          currentPrice: a.currentPrice,
          currentValue: a.currentValue,
          profit: (a.currentPrice - a.buyPrice) * a.quantity,
        })),
      },
      transactionCount: txs.length,
    });
  }

  // AI rapor (Markdown) — varlık verisi ile zenginleştirilmiş
  const portfolioPromptBlock = assets.length > 0
    ? `\nPORTFÖY DURUMU\n${assets.map(a => `  - ${a.name} (${a.ticker || a.type}): ${a.quantity} birim × ${formatTRY(a.currentPrice)} = ${formatTRY(a.currentValue)}`).join("\n")}\n  Toplam: ${formatTRY(totalAssetValue)} | Kâr/Zarar: ${formatTRY(totalAssetProfit)}`
    : "";

  const markdown = await generateFinancialReport({
    user,
    txs,
    extraContext: `${marketText}\n${portfolioPromptBlock}`,
  });

  if (format === "pdf") {
    // PDF-ready: HTML wrapper ile markdown gönder
    return NextResponse.json({
      format: "pdf",
      markdown,
      generatedAt,
      user: { name: user.name },
      htmlTemplate: buildPdfHtml(markdown, user.name, generatedAt),
      ...getAiMeta(),
    });
  }

  // Web (varsayılan)
  return NextResponse.json({ format: "web", markdown, generatedAt, user, ...getAiMeta() });
  } catch (err) {
    return geminiErrorResponse(err);
  }
}

function buildPdfHtml(markdown: string, userName: string, date: string): string {
  // Basit markdown → HTML dönüşümü
  let html = markdown
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Tablo satırlarını HTML'e çevir
  html = html.replace(/\|(.+)\|/g, (match) => {
    const cells = match.split('|').filter(c => c.trim());
    if (cells.every(c => c.trim().match(/^-+$/))) return '';
    const tag = cells[0]?.includes('---') ? 'th' : 'td';
    return `<tr>${cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('')}</tr>`;
  });

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${userName} — Finansal Rapor</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; color: #1e293b; line-height: 1.7; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.8rem; color: #0f172a; border-bottom: 3px solid #6366f1; padding-bottom: 8px; margin-bottom: 20px; }
    h2 { font-size: 1.3rem; color: #4338ca; margin-top: 28px; margin-bottom: 12px; }
    h3 { font-size: 1.1rem; color: #1e293b; margin-top: 20px; margin-bottom: 8px; }
    p { margin-bottom: 12px; }
    li { margin-left: 20px; margin-bottom: 4px; }
    strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; font-size: 0.9rem; }
    th { background: #f1f5f9; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 0.8rem; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <p>${html}</p>
  <div class="footer">
    ${userName} • Finansal Rapor • Oluşturulma: ${new Date(date).toLocaleDateString("tr-TR")} • Akıllı Finans Asistanı
  </div>
</body>
</html>`;
}

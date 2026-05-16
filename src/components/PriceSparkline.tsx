"use client";
import type { PricePoint } from "@/lib/types";

/**
 * Mini fiyat geçmişi grafiği — SVG sparkline.
 * Trend yönüne göre renk değiştirir: düşüyorsa yeşil, yükseliyorsa kırmızı.
 */
export default function PriceSparkline({
  history,
  width = 90,
  height = 28,
}: {
  history: PricePoint[];
  width?: number;
  height?: number;
}) {
  if (!history || history.length < 2) {
    return null;
  }

  const sorted = [...history].sort(
    (a, b) => +new Date(a.date) - +new Date(b.date),
  );
  const prices = sorted.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = sorted.map((p, i) => {
    const x = (i / (sorted.length - 1)) * (width - 4) + 2;
    const y = height - 2 - ((p.price - min) / range) * (height - 4);
    return `${x},${y}`;
  });

  const first = prices[0]!;
  const last = prices[prices.length - 1]!;
  const trending: "down" | "up" | "flat" =
    last < first ? "down" : last > first ? "up" : "flat";

  const stroke =
    trending === "down" ? "#10b981" : trending === "up" ? "#ef4444" : "#94a3b8";
  const fill =
    trending === "down"
      ? "rgba(16, 185, 129, 0.12)"
      : trending === "up"
        ? "rgba(239, 68, 68, 0.12)"
        : "rgba(148, 163, 184, 0.12)";

  // Polyline + alt alan dolgusu
  const areaPath = `M${points[0]} L${points.join(" ")} L${width - 2},${height} L2,${height} Z`;

  const dropPct =
    first > 0 ? Math.round(((first - last) / first) * 100) : 0;

  return (
    <div
      className="inline-flex items-center gap-1.5"
      title={`${sorted.length} fiyat noktası • ${trending === "down" ? `%${dropPct} düştü` : trending === "up" ? `%${Math.abs(dropPct)} yükseldi` : "değişmedi"}`}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
      >
        <path d={areaPath} fill={fill} />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Son nokta */}
        <circle
          cx={parseFloat(points[points.length - 1]!.split(",")[0]!)}
          cy={parseFloat(points[points.length - 1]!.split(",")[1]!)}
          r={2}
          fill={stroke}
        />
      </svg>
      {trending !== "flat" && (
        <span
          className={`text-[10px] font-semibold ${
            trending === "down" ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {trending === "down" ? "↓" : "↑"}%{Math.abs(dropPct)}
        </span>
      )}
    </div>
  );
}

"use client";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  BarChart,
  Bar,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";
import type { ForecastResult } from "@/lib/forecast";

const COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#ec4899",
  "#64748b",
  "#eab308",
];

export function SpendingPie({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (!data || data.length === 0) {
    return <Empty label="Bu ay için harcama yok" />;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={3}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: any) => `${v}₺`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function IncomeExpenseLine({
  data,
}: {
  data: { month: string; income: number; expense: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} />
        <Tooltip formatter={(v: any) => `${v}₺`} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="income"
          name="Gelir"
          stroke="#22c55e"
          strokeWidth={2.5}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="expense"
          name="Gider"
          stroke="#ef4444"
          strokeWidth={2.5}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryBars({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (!data || data.length === 0) return <Empty label="Veri yok" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
        <YAxis stroke="#94a3b8" fontSize={12} />
        <Tooltip formatter={(v: any) => `${v}₺`} />
        <Bar
          dataKey="value"
          name="Harcama"
          fill="#0ea5e9"
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ─── Forecast Chart ───────────────────────────────────────── */

export function ForecastChart({ forecast }: { forecast: ForecastResult }) {
  if (!forecast || forecast.series.length === 0)
    return <Empty label="Tahmin için yeterli veri yok" />;

  // İki seri olarak göster: geçmiş ve gelecek
  const data = forecast.series.map((s) => ({
    date: new Date(s.date).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
    }),
    actual: s.isFuture ? null : s.expense,
    forecast: s.isFuture ? s.expense : null,
  }));

  // Eklemenin başladığı X değeri (geçmiş/gelecek geçişi)
  const transitionIdx = forecast.series.findIndex((s) => s.isFuture);
  const transitionLabel =
    transitionIdx > 0 && forecast.series[transitionIdx]
      ? new Date(forecast.series[transitionIdx]!.date).toLocaleDateString(
          "tr-TR",
          { day: "2-digit", month: "short" },
        )
      : null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
      >
        <defs>
          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          stroke="#94a3b8"
          fontSize={10}
          interval="preserveStartEnd"
        />
        <YAxis stroke="#94a3b8" fontSize={11} />
        <Tooltip
          formatter={(v) =>
            typeof v === "number" ? `${v.toLocaleString("tr-TR")}₺` : "—"
          }
          labelStyle={{ fontSize: 12 }}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {transitionLabel && (
          <ReferenceLine
            x={transitionLabel}
            stroke="#cbd5e1"
            strokeDasharray="4 4"
            label={{
              value: "Bugün",
              position: "top",
              fontSize: 10,
              fill: "#64748b",
            }}
          />
        )}
        <Area
          type="monotone"
          dataKey="actual"
          name="Gerçekleşen"
          stroke="#0ea5e9"
          strokeWidth={2}
          fill="url(#actualGrad)"
          connectNulls={false}
        />
        <Area
          type="monotone"
          dataKey="forecast"
          name="Tahmin"
          stroke="#a78bfa"
          strokeWidth={2}
          strokeDasharray="5 5"
          fill="url(#forecastGrad)"
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="h-[260px] grid place-items-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
      {label}
    </div>
  );
}

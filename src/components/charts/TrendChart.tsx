"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatCompactINR } from "@/lib/format";

interface TrendPoint {
  month: string;
  billed: number;
  collected: number;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const allZero = data.every((d) => d.billed === 0 && d.collected === 0);
  if (allZero) {
    return (
      <div className="flex items-center justify-center h-[220px] text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
        No billing or collection activity in the last 6 months.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="billedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--status-completed)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--status-completed)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11.5, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10.5, fill: "var(--ink-faint)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCompactINR(v)}
          width={56}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div
                className="rounded-lg px-3 py-2 text-[12px] flex flex-col gap-1"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
              >
                <div className="font-medium mb-0.5">{label}</div>
                {payload.map((p) => (
                  <div key={p.dataKey as string} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span style={{ color: "var(--ink-muted)" }}>{p.dataKey === "billed" ? "Billed" : "Collected"}</span>
                    <span className="tabular font-medium ml-auto">{formatCompactINR(p.value as number)}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Area type="monotone" dataKey="billed" stroke="var(--accent)" fill="url(#billedGradient)" strokeWidth={2} />
        <Area type="monotone" dataKey="collected" stroke="var(--status-completed)" fill="url(#collectedGradient)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AGING_BUCKET_META, AgingBucket } from "@/lib/billing";
import { formatCompactINR } from "@/lib/format";

const ORDER: AgingBucket[] = ["current", "days30", "days60", "days90", "days90plus"];

export function AgingChart({ aging }: { aging: Record<AgingBucket, number> }) {
  const data = ORDER.map((key) => ({
    key,
    label: AGING_BUCKET_META[key].label,
    value: aging[key],
  }));

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
        No outstanding balances to age.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={90}
          tick={{ fontSize: 11.5, fill: "var(--ink-muted)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--surface-hover)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0];
            return (
              <div
                className="rounded-lg px-3 py-2 text-[12px]"
                style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}
              >
                <div className="font-medium">{p.payload.label}</div>
                <div className="tabular mt-0.5" style={{ color: "var(--ink-muted)" }}>
                  {formatCompactINR(p.value as number)}
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((d) => (
            <Cell key={d.key} fill={`var(${AGING_BUCKET_META[d.key].colorVar})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

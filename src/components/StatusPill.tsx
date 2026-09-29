import { DueStatus, DUE_STATUS_META } from "@/lib/billing";

export function StatusPill({ status, label }: { status: DueStatus; label?: string }) {
  const meta = DUE_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap tracking-wide"
      style={{
        background: `var(${meta.colorVar}-bg)`,
        color: `var(${meta.colorVar})`,
      }}
    >
      {label ?? meta.label}
    </span>
  );
}

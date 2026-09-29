import { ReactNode } from "react";

export function Card({
  children,
  className = "",
  padded = true,
  hover = false,
  style,
  outlined = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  hover?: boolean;
  style?: React.CSSProperties;
  outlined?: boolean;
}) {
  return (
    <div
      className={`rounded-xl ${outlined ? "border" : ""} ${padded ? "p-5" : ""} ${hover ? "transition-all duration-200" : ""} ${className}`}
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-sm)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

const TONE_COLOR: Record<string, string> = {
  default: "var(--ink)",
  good: "var(--status-completed)",
  warn: "var(--status-due-soon)",
  crit: "var(--status-overdue)",
  accent: "var(--accent)",
};

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn" | "crit" | "accent";
  icon?: ReactNode;
}) {
  const color = TONE_COLOR[tone];
  return (
    <Card className="relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-faint)" }}>
          {label}
        </div>
        {icon && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-soft)", color }}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="font-display mt-2 text-[1.6rem] font-semibold tabular tracking-tight" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[12px] font-medium" style={{ color: "var(--ink-muted)" }}>
          {sub}
        </div>
      )}
    </Card>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--accent)",
      color: "var(--accent-ink)",
    },
    secondary: { background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-strong)" },
    ghost: { background: "transparent", color: "var(--ink-muted)" },
    danger: { background: "var(--status-overdue-bg)", color: "var(--status-overdue)" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 hover:brightness-105 ${className}`}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-[13.5px] outline-none border transition-colors focus:border-[var(--accent)] ${props.className ?? ""}`}
      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-strong)", color: "var(--ink)" }}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-[13.5px] outline-none border resize-y transition-colors focus:border-[var(--accent)] ${props.className ?? ""}`}
      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-strong)", color: "var(--ink)" }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg px-3 py-2 text-[13.5px] outline-none border transition-colors focus:border-[var(--accent)] ${props.className ?? ""}`}
      style={{ background: "var(--bg-elevated)", borderColor: "var(--border-strong)", color: "var(--ink)" }}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-faint)" }}>
      {children}
    </label>
  );
}

export function Field({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

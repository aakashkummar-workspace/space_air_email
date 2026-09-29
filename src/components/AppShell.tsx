"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useSession, signOut } from "next-auth/react";
import { NotificationBell } from "@/components/NotificationBell";

// Dashboard nav item temporarily hidden — re-add
// { href: "/", label: "Dashboard", icon: GridIcon } to restore it.
const NAV = [
  { href: "/projects", label: "Projects", icon: FolderIcon },
  { href: "/reminders", label: "Reminders", icon: BellIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className="hidden md:flex md:flex-col md:w-64 md:shrink-0 md:h-screen border-r"
        style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
      >
        <div className="h-16 flex items-center gap-3 px-5">
          <div
            className="rounded-lg px-2.5 py-2 shrink-0 border"
            style={{ background: "#ffffff", borderColor: "var(--border)" }}
          >
            <Image src="/brand/spaceair-logo-original.svg" alt="Space Air" width={90} height={29} priority />
          </div>
          <div className="min-w-0">
            <div className="font-display text-[14px] tracking-tight leading-tight" style={{ color: "var(--ink)" }}>
              Billing Suite
            </div>
            <div className="text-[10.5px] leading-tight font-medium" style={{ color: "var(--ink-faint)" }}>
              MEP Contracting
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 pt-3 flex flex-col gap-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-semibold transition-colors"
                style={{
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent-soft-ink)" : "var(--ink-muted)",
                }}
              >
                <Icon className="w-[17px] h-[17px] shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div
          className="mx-3 mb-3 px-3.5 py-3 rounded-lg text-[11px] flex items-center justify-between gap-2 border"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--ink-faint)" }}
        >
          <div className="min-w-0">
            <div className="font-semibold" style={{ color: "var(--ink-muted)" }}>
              {session?.user?.role ?? "Signed in as"}
            </div>
            <div className="mt-0.5 truncate">{session?.user?.email ?? "…"}</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="shrink-0 text-[10.5px] font-semibold px-2 py-1 rounded-full transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--ink-muted)" }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header
          className="md:hidden h-14 flex items-center px-4 border-b shrink-0 gap-2.5"
          style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
        >
          <div className="rounded-lg px-2 py-1.5 border" style={{ background: "#ffffff", borderColor: "var(--border)" }}>
            <Image src="/brand/spaceair-logo-original.svg" alt="Space Air" width={78} height={25} priority />
          </div>
          <span className="font-display text-[14px] flex-1">Billing Suite</span>
          <NotificationBell />
        </header>
        <div className="hidden md:flex items-center justify-end px-6 h-14 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <NotificationBell />
        </div>
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
        <nav
          className="md:hidden shrink-0 flex items-stretch border-t"
          style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
        >
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-medium"
                style={{ color: active ? "var(--accent)" : "var(--ink-faint)" }}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.96 19.34a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.66 8.96a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.04 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}

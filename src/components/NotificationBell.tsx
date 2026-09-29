"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { formatDate } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const KIND_COLOR: Record<string, string> = {
  OVERDUE: "var(--status-overdue)",
  ESCALATED: "var(--status-escalated)",
  DUE_SOON: "var(--status-due-soon)",
  REMINDER_SENT: "var(--accent)",
  SYSTEM: "var(--ink-muted)",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useSWR<{ notifications: Notification[]; unreadCount: number }>("/api/notifications", fetcher, {
    refreshInterval: 30000,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = data?.unreadCount ?? 0;

  async function markAllRead() {
    await fetch("/api/notifications/mark-all-read", { method: "POST" });
    mutate("/api/notifications");
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    mutate("/api/notifications");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--surface-hover)]"
        style={{ color: "var(--ink-muted)" }}
      >
        <BellIcon />
        {unread > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[15px] h-[15px] px-[3px] rounded-full text-[9px] font-bold flex items-center justify-center"
            style={{ background: "var(--status-overdue)", color: "#fff" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 w-80 max-h-[420px] overflow-y-auto rounded-xl border z-50 animate-fade-up"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <span className="text-[13px] font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[11.5px] font-medium" style={{ color: "var(--accent)" }}>
                Mark all read
              </button>
            )}
          </div>
          {!data || data.notifications.length === 0 ? (
            <p className="text-[12.5px] px-4 py-6 text-center" style={{ color: "var(--ink-faint)" }}>
              No notifications yet.
            </p>
          ) : (
            <div>
              {data.notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link ?? "#"}
                  onClick={() => {
                    if (!n.read) markRead(n.id);
                    setOpen(false);
                  }}
                  className="flex items-start gap-2.5 px-4 py-3 border-b transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ borderColor: "var(--border)", opacity: n.read ? 0.6 : 1 }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{ background: KIND_COLOR[n.kind] ?? "var(--ink-faint)" }}
                  />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium">{n.title}</div>
                    <div className="text-[11.5px] mt-0.5 line-clamp-2" style={{ color: "var(--ink-muted)" }}>
                      {n.body}
                    </div>
                    <div className="text-[10.5px] mt-1" style={{ color: "var(--ink-faint)" }}>
                      {formatDate(n.createdAt)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

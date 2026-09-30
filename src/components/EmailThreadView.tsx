"use client";

import useSWR, { mutate } from "swr";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}
interface EmailMessage {
  id: string;
  direction: "OUTBOUND" | "INBOUND";
  fromAddress: string;
  toRecipients: string;
  ccRecipients: string;
  subject: string;
  body: string;
  status: "SENT" | "DELIVERED" | "FAILED" | "SIMULATED" | "RECEIVED";
  errorMessage: string | null;
  createdAt: string;
  attachments: Attachment[];
  sentByUser: { name: string; email: string } | null;
}
interface EmailThread {
  id: string;
  subject: string;
  unread: boolean;
  messages: EmailMessage[];
}

const STATUS_META: Record<string, { label: string; color: string; background: string }> = {
  SENT: { label: "Sent", color: "var(--status-completed)", background: "var(--status-completed-bg)" },
  DELIVERED: { label: "Delivered", color: "var(--status-completed)", background: "var(--status-completed-bg)" },
  FAILED: { label: "Failed", color: "var(--status-overdue)", background: "var(--status-overdue-bg)" },
  SIMULATED: { label: "Simulated", color: "var(--status-due-soon)", background: "var(--status-due-soon-bg)" },
  RECEIVED: { label: "Reply", color: "var(--accent-soft-ink)", background: "var(--accent-soft)" },
};

export function EmailThreadView({ installmentId }: { installmentId: string }) {
  const key = `/api/retention/${installmentId}/email-thread`;
  const { data: threads, isLoading } = useSWR<EmailThread[]>(key, fetcher, { refreshInterval: 20000 });
  const [checking, setChecking] = useState(false);

  const unreadThread = threads?.find((t) => t.unread);
  useEffect(() => {
    if (unreadThread) {
      fetch(`/api/email-threads/${unreadThread.id}/mark-read`, { method: "POST" }).then(() => mutate(key));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadThread?.id]);

  // Passively check Gmail for replies every 30s while this thread is open,
  // in addition to the manual button below.
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/email-threads/poll-replies", { method: "POST" }).then(() => mutate(key));
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkNow() {
    setChecking(true);
    await fetch("/api/email-threads/poll-replies", { method: "POST" });
    await mutate(key);
    setChecking(false);
  }

  if (isLoading) {
    return <div className="h-16 rounded-xl animate-pulse" style={{ background: "var(--bg)" }} />;
  }

  const allMessages = (threads ?? [])
    .flatMap((t) => t.messages)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={checkNow} disabled={checking} className="text-[12px] px-3 py-1.5">
          {checking ? "Checking…" : "Check for replies"}
        </Button>
      </div>
      {allMessages.length === 0 ? (
        <p className="text-[12px] py-2" style={{ color: "var(--ink-faint)" }}>
          No emails sent yet for this installment.
        </p>
      ) : (
        allMessages.map((m) => <MessageBubble key={m.id} message={m} />)
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: EmailMessage }) {
  const isInbound = message.direction === "INBOUND";
  const meta = STATUS_META[message.status];
  const [open, setOpen] = useState(true);
  return (
    <div
      className="rounded-lg px-3.5 py-3 border-l-4"
      style={{
        background: "var(--bg)",
        borderLeftColor: isInbound ? "var(--accent)" : "var(--border-strong)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 flex-wrap text-left"
      >
        <div className="min-w-0 flex items-center gap-1.5">
          <span className="text-[11px] shrink-0" style={{ color: "var(--ink-faint)" }}>
            {open ? "▾" : "▸"}
          </span>
          <span className="text-[12.5px] font-semibold">
            {isInbound ? message.fromAddress : message.sentByUser?.name || "You"}
          </span>
          <span className="text-[11px] ml-1" style={{ color: "var(--ink-faint)" }}>
            to {message.toRecipients}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wide"
            style={{ background: meta.background, color: meta.color }}
          >
            {meta.label}
          </span>
          <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
            {formatDateTime(message.createdAt)}
          </span>
        </div>
      </button>
      <div className="text-[12.5px] font-medium mt-1.5">{message.subject}</div>
      {open && (
        <>
          {message.ccRecipients && (
            <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
              cc {message.ccRecipients}
            </div>
          )}
          {!isInbound && message.sentByUser && (
            <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
              Sent by {message.sentByUser.name} ({message.sentByUser.email})
            </div>
          )}
          <div className="text-[12px] mt-1 whitespace-pre-wrap" style={{ color: "var(--ink-muted)" }}>
            {stripHtml(message.body).slice(0, 500)}
          </div>
          {message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {message.attachments.map((a) => (
                <span key={a.id} className="text-[11px] px-2 py-1 rounded" style={{ background: "var(--surface)", color: "var(--ink-muted)" }}>
                  📎 {a.filename}
                </span>
              ))}
            </div>
          )}
          {message.errorMessage && (
            <div className="text-[11px] mt-1.5" style={{ color: "var(--status-overdue)" }}>
              {message.errorMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function stripHtml(s: string): string {
  return s
    // Drop <style>/<script> blocks entirely — their contents aren't visible
    // text and stripping only the tags would leave raw CSS/JS behind.
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-zA-Z]+;/g, (entity) => HTML_ENTITIES[entity] ?? entity)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

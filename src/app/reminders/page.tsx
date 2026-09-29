"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import Link from "next/link";
import { Card, Button } from "@/components/ui";
import { formatDate } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface EmailStatus {
  configured: boolean;
  provider: "gmail" | "resend" | null;
  googleEmail: string | null;
}

interface ReminderLog {
  id: string;
  status: "SENT" | "FAILED" | "SIMULATED";
  sentAt: string;
  subject: string;
  body: string;
  toRecipients: string;
  ccRecipients: string;
  errorMessage: string | null;
  reminderStage: { name: string; isEscalation: boolean };
  milestone: {
    label: string;
    subJob: { name: string; project: { id: string; name: string } };
  };
}

export default function RemindersPage() {
  const { data: logs, isLoading } = useSWR<ReminderLog[]>("/api/reminder-logs", fetcher, {
    refreshInterval: 15000,
  });
  const { data: emailStatus } = useSWR<EmailStatus>("/api/email-status", fetcher);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function runCheck() {
    setRunning(true);
    setResult(null);
    const res = await fetch("/api/reminder-logs/simulate", { method: "POST" });
    const data = await res.json();
    setResult(
      data.created > 0
        ? `${data.created} reminder${data.created === 1 ? "" : "s"} generated.`
        : "No new reminders due right now."
    );
    await mutate("/api/reminder-logs");
    setRunning(false);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap animate-fade-up">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Reminders</h1>
          <p className="text-[13.5px] mt-1.5" style={{ color: "var(--ink-muted)" }}>
            Reminder history across all projects, evaluated against your configured stages
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Button onClick={runCheck} disabled={running}>
            {running ? "Checking…" : "Run reminder check now"}
          </Button>
          {result && (
            <span className="text-[11.5px]" style={{ color: "var(--ink-muted)" }}>
              {result}
            </span>
          )}
        </div>
      </div>

      {emailStatus?.configured ? (
        <Card className="text-[12.5px]" style={{ background: "var(--status-completed-bg)", color: "var(--status-completed)" }}>
          Reminders send for real via{" "}
          <b>{emailStatus.provider === "gmail" ? emailStatus.googleEmail : "Resend"}</b>.
        </Card>
      ) : (
        <Card className="text-[12.5px]" style={{ color: "var(--ink-muted)" } as React.CSSProperties}>
          No email provider is configured yet, so reminders are <b style={{ color: "var(--ink)" }}>simulated</b> — logged
          here exactly as they would be sent, without actually emailing anyone. Connect Google Mail or set a Resend key
          under{" "}
          <Link href="/settings" style={{ color: "var(--accent)" }}>
            Settings
          </Link>{" "}
          to enable real delivery.
        </Card>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
          ))}
        </div>
      ) : logs && logs.length > 0 ? (
        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <ReminderLogRow key={log.id} log={log} />
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
            No reminders have been generated yet. Run a check, or wait for the next scheduled evaluation.
          </p>
        </Card>
      )}
    </div>
  );
}

function ReminderLogRow({ log }: { log: ReminderLog }) {
  const [open, setOpen] = useState(false);
  const statusColor =
    log.status === "SENT" ? "var(--status-completed)" : log.status === "FAILED" ? "var(--status-overdue)" : "var(--status-due-soon)";
  const statusBg =
    log.status === "SENT" ? "var(--status-completed-bg)" : log.status === "FAILED" ? "var(--status-overdue-bg)" : "var(--status-due-soon-bg)";

  return (
    <Card padded={false}>
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate">
            <Link href={`/projects/${log.milestone.subJob.project.id}`} className="hover:underline" style={{ color: "var(--accent)" }} onClick={(e) => e.stopPropagation()}>
              {log.milestone.subJob.project.name}
            </Link>{" "}
            — {log.milestone.subJob.name} · {log.milestone.label}
          </div>
          <div className="text-[11.5px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
            {log.reminderStage.name} · {formatDate(log.sentAt)}
          </div>
        </div>
        <span
          className="text-[11px] font-semibold px-2 py-1 rounded-full shrink-0"
          style={{ background: statusBg, color: statusColor }}
        >
          {log.status}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-[12.5px] flex flex-col gap-2" style={{ color: "var(--ink-muted)" }}>
          <div>
            <b style={{ color: "var(--ink)" }}>Subject:</b> {log.subject}
          </div>
          <div>
            <b style={{ color: "var(--ink)" }}>To:</b> {log.toRecipients || "—"}
            {log.ccRecipients && (
              <>
                {" "}
                <b style={{ color: "var(--ink)" }}>CC:</b> {log.ccRecipients}
              </>
            )}
          </div>
          <pre className="whitespace-pre-wrap rounded-lg p-3 text-[12px]" style={{ background: "var(--bg)" }}>
            {log.body}
          </pre>
          {log.errorMessage && (
            <div style={{ color: "var(--status-overdue)" }}>Error: {log.errorMessage}</div>
          )}
        </div>
      )}
    </Card>
  );
}

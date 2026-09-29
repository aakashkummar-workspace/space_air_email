"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import { Card, Button, Input, Label, Textarea } from "@/components/ui";
import { ProgressBar } from "@/components/ProgressBar";
import { EmailComposer } from "@/components/EmailComposer";
import { EmailThreadView } from "@/components/EmailThreadView";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatCompactMoney } from "@/lib/currency";
import { computeRetentionStatus, RETENTION_STATUS_META } from "@/lib/billing";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Formats an ISO datetime string as the local "YYYY-MM-DDTHH:mm" value a
// <input type="datetime-local"> expects, in the browser's own timezone.
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface RetentionInstallment {
  id: string;
  label: string;
  amount: number;
  dueDate: string | null;
  amountReceived: number;
  remarks: string | null;
  autoSendEmail: boolean;
  autoSentAt: string | null;
}

function RetentionStatusPill({ dueDate, amount, amountReceived }: { dueDate: string | null; amount: number; amountReceived: number }) {
  const { status, label } = computeRetentionStatus(dueDate, amount, amountReceived);
  const meta = RETENTION_STATUS_META[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap tracking-wide"
      style={{ background: `var(${meta.colorVar}-bg)`, color: `var(${meta.colorVar})` }}
    >
      {label}
    </span>
  );
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: "MILESTONE" | "RETENTION";
  toRecipients: string;
  ccRecipients: string;
  bccRecipients: string;
}

export function RetentionSection({
  projectId,
  currency,
  clientEmail,
  suggestedAmount,
  projectName,
  clientName,
  jobCode,
  poAmount,
  billedAmount,
  outstandingAmount,
}: {
  projectId: string;
  currency: string;
  clientEmail: string;
  suggestedAmount: number;
  projectName: string;
  clientName: string | null;
  jobCode: string | null;
  poAmount: number;
  billedAmount: number;
  outstandingAmount: number;
}) {
  const key = `/api/projects/${projectId}/retention`;
  const { data: installments, isLoading } = useSWR<RetentionInstallment[]>(key, fetcher);
  const { data: allTemplates } = useSWR<EmailTemplate[]>("/api/templates", fetcher);
  // Only retention-category templates make sense here — a milestone
  // template's tokens (milestoneLabel, balanceAmount, dueDate, jobCode)
  // aren't filled in when sending a retention email, so offering it here
  // would send an email with literal unrendered {{tokens}} in it.
  const templates = (allTemplates ?? []).filter((t) => t.category === "RETENTION");
  const [showAdd, setShowAdd] = useState(false);

  if (isLoading) {
    return <div className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />;
  }

  const list = installments ?? [];
  const totalAmount = list.reduce((s, r) => s + r.amount, 0);
  const totalReceived = list.reduce((s, r) => s + r.amountReceived, 0);
  const totalOutstanding = Math.max(0, totalAmount - totalReceived);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display text-[15px]">Retention</h3>
          <p className="text-[11.5px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
            Held-back amounts released on separate installment dates
          </p>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="text-[12px] font-medium" style={{ color: "var(--accent)" }}>
          + Add Installment
        </button>
      </div>

      {list.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg px-3 py-2.5" style={{ background: "var(--bg)" }}>
            <div className="text-[10.5px] uppercase tracking-wide font-medium" style={{ color: "var(--ink-faint)" }}>
              Total Retention
            </div>
            <div className="mt-1 text-[13.5px] font-semibold tabular">{formatCompactMoney(totalAmount, currency)}</div>
          </div>
          <div className="rounded-lg px-3 py-2.5" style={{ background: "var(--bg)" }}>
            <div className="text-[10.5px] uppercase tracking-wide font-medium" style={{ color: "var(--ink-faint)" }}>
              Received
            </div>
            <div className="mt-1 text-[13.5px] font-semibold tabular" style={{ color: "var(--status-completed)" }}>
              {formatCompactMoney(totalReceived, currency)}
            </div>
          </div>
          <div className="rounded-lg px-3 py-2.5" style={{ background: "var(--bg)" }}>
            <div className="text-[10.5px] uppercase tracking-wide font-medium" style={{ color: "var(--ink-faint)" }}>
              Outstanding
            </div>
            <div
              className="mt-1 text-[13.5px] font-semibold tabular"
              style={{ color: totalOutstanding > 0 ? "var(--status-overdue)" : "var(--status-completed)" }}
            >
              {formatCompactMoney(totalOutstanding, currency)}
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <AddRetentionForm
          projectId={projectId}
          targetKey={key}
          onClose={() => setShowAdd(false)}
          suggestedAmount={suggestedAmount}
        />
      )}

      {list.length === 0 ? (
        <p className="text-[12.5px] py-2" style={{ color: "var(--ink-faint)" }}>
          No retention installments recorded yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((r) => (
            <RetentionRow
              key={r.id}
              installment={r}
              currency={currency}
              targetKey={key}
              clientEmail={clientEmail}
              templates={templates}
              projectName={projectName}
              clientName={clientName}
              jobCode={jobCode}
              poAmount={poAmount}
              billedAmount={billedAmount}
              outstandingAmount={outstandingAmount}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function RetentionRow({
  installment,
  currency,
  targetKey,
  clientEmail,
  templates,
  projectName,
  clientName,
  jobCode,
  poAmount,
  billedAmount,
  outstandingAmount,
}: {
  installment: RetentionInstallment;
  currency: string;
  targetKey: string;
  clientEmail: string;
  templates: EmailTemplate[];
  projectName: string;
  clientName: string | null;
  jobCode: string | null;
  poAmount: number;
  billedAmount: number;
  outstandingAmount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const outstanding = Math.max(0, installment.amount - installment.amountReceived);
  const pct = installment.amount > 0 ? Math.min(100, (installment.amountReceived / installment.amount) * 100) : 0;

  async function remove() {
    if (!confirm(`Remove "${installment.label}"?`)) return;
    await fetch(`/api/retention/${installment.id}`, { method: "DELETE" });
    mutate(targetKey);
  }

  if (editing) {
    return (
      <EditRetentionForm installment={installment} targetKey={targetKey} onClose={() => setEditing(false)} />
    );
  }

  return (
    <div className="rounded-lg" style={{ background: "var(--bg)" }}>
      <div className="px-3.5 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium">{installment.label}</span>
            <RetentionStatusPill dueDate={installment.dueDate} amount={installment.amount} amountReceived={installment.amountReceived} />
          </div>
          <div className="text-[11.5px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
            Due {formatDateTime(installment.dueDate)}
            {installment.remarks && ` · ${installment.remarks}`}
            {installment.autoSendEmail && (
              <span style={{ color: installment.autoSentAt ? "var(--status-completed)" : "var(--accent)" }}>
                {" · "}
                {installment.autoSentAt ? "Auto-reminder sent" : "Auto-send scheduled"}
              </span>
            )}
          </div>
          {installment.amountReceived > 0 && (
            <div className="w-32 mt-1.5">
              <ProgressBar pct={pct} color="var(--status-completed)" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <div className="text-[13px] font-semibold tabular">{formatCompactMoney(installment.amount, currency)}</div>
            {installment.amountReceived > 0 && (
              <div className="text-[11px] tabular" style={{ color: "var(--status-completed)" }}>
                {formatCompactMoney(installment.amountReceived, currency)} received
              </div>
            )}
            {outstanding > 0 && (
              <div className="text-[11px] tabular" style={{ color: "var(--status-overdue)" }}>
                {formatCompactMoney(outstanding, currency)} outstanding
              </div>
            )}
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setShowComposer(true)} className="text-[11.5px] font-medium" style={{ color: "var(--accent)" }}>
              Send Email
            </button>
            <button onClick={() => setShowThread((v) => !v)} className="text-[11.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
              {showThread ? "Hide" : "History"}
            </button>
            <button onClick={() => setEditing(true)} className="text-[11.5px] font-medium" style={{ color: "var(--accent)" }}>
              Edit
            </button>
            <button onClick={remove} className="text-[11.5px] font-medium" style={{ color: "var(--status-overdue)" }}>
              Remove
            </button>
          </div>
        </div>
      </div>

      {showThread && (
        <div className="px-3.5 pb-3">
          <EmailThreadView installmentId={installment.id} />
        </div>
      )}

      {showComposer && (
        <EmailComposer
          installmentId={installment.id}
          installmentLabel={installment.label}
          defaultTo={clientEmail}
          templates={templates}
          threadKey={`/api/retention/${installment.id}/email-thread`}
          tokenContext={{
            clientName: clientName || projectName,
            projectName,
            jobCode: jobCode || "—",
            poAmount: formatCompactMoney(poAmount, currency),
            billedAmount: formatCompactMoney(billedAmount, currency),
            outstandingAmount: formatCompactMoney(outstandingAmount, currency),
            retentionAmount: formatCompactMoney(installment.amount, currency),
            retentionDueDate: formatDateTime(installment.dueDate),
            retentionLabel: installment.label,
            retentionReceived: formatCompactMoney(installment.amountReceived, currency),
            retentionOutstanding: formatCompactMoney(outstanding, currency),
          }}
          onClose={() => {
            setShowComposer(false);
            setShowThread(true);
          }}
        />
      )}
    </div>
  );
}

function AddRetentionForm({
  projectId,
  targetKey,
  onClose,
  suggestedAmount,
}: {
  projectId: string;
  targetKey: string;
  onClose: () => void;
  suggestedAmount: number;
}) {
  const [label, setLabel] = useState("Installment 1");
  const [amount, setAmount] = useState(suggestedAmount > 0 ? String(suggestedAmount) : "");
  const [dueDate, setDueDate] = useState(""); // datetime-local value
  const [remarks, setRemarks] = useState("");
  const [autoSendEmail, setAutoSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!amount) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/retention`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label || "Retention",
        amount: parseFloat(amount),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        remarks: remarks || undefined,
        autoSendEmail: autoSendEmail && !!dueDate,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Couldn't save this installment — check the amount and due date.");
      return;
    }
    await mutate(targetKey);
    onClose();
  }

  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--bg)" }}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <div>
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Installment 1" />
        </div>
        <div>
          <Label>Amount</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          {suggestedAmount > 0 && (
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-faint)" }}>
              Prefilled from outstanding balance — edit as needed.
            </p>
          )}
        </div>
        <div>
          <Label>Due Date &amp; Time</Label>
          <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Remarks</Label>
        <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional notes" />
      </div>
      <label className="flex items-center gap-2 text-[12.5px] cursor-pointer" style={{ color: dueDate ? "var(--ink)" : "var(--ink-faint)" }}>
        <input
          type="checkbox"
          checked={autoSendEmail}
          disabled={!dueDate}
          onChange={(e) => setAutoSendEmail(e.target.checked)}
        />
        Send the reminder email automatically at the due date &amp; time above
        {!dueDate && <span className="text-[11px]">(set a due date first)</span>}
      </label>
      {error && (
        <p className="text-[12px]" style={{ color: "var(--status-overdue)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving || !amount}>
          {saving ? "Saving…" : "Add Installment"}
        </Button>
      </div>
    </div>
  );
}

function EditRetentionForm({
  installment,
  targetKey,
  onClose,
}: {
  installment: RetentionInstallment;
  targetKey: string;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(installment.label);
  const [amount, setAmount] = useState(String(installment.amount));
  const [dueDate, setDueDate] = useState(installment.dueDate ? toDatetimeLocal(installment.dueDate) : "");
  const [amountReceived, setAmountReceived] = useState(String(installment.amountReceived));
  const [remarks, setRemarks] = useState(installment.remarks ?? "");
  const [autoSendEmail, setAutoSendEmail] = useState(installment.autoSendEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/retention/${installment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        amount: parseFloat(amount) || 0,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        amountReceived: parseFloat(amountReceived) || 0,
        remarks: remarks || null,
        autoSendEmail: autoSendEmail && !!dueDate,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Couldn't save changes — check the fields.");
      return;
    }
    await mutate(targetKey);
    onClose();
  }

  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--bg)" }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <Label>Amount</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label>Due Date &amp; Time</Label>
          <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <Label>Amount Received</Label>
          <Input type="number" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Remarks</Label>
        <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-[12.5px] cursor-pointer" style={{ color: dueDate ? "var(--ink)" : "var(--ink-faint)" }}>
        <input
          type="checkbox"
          checked={autoSendEmail}
          disabled={!dueDate}
          onChange={(e) => setAutoSendEmail(e.target.checked)}
        />
        Send the reminder email automatically at the due date &amp; time above
        {!dueDate && <span className="text-[11px]">(set a due date first)</span>}
      </label>
      {error && (
        <p className="text-[12px]" style={{ color: "var(--status-overdue)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

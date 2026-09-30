"use client";

import useSWR, { mutate } from "swr";
import { use, useState } from "react";
import Link from "next/link";
import { Card, Button, Input, Label } from "@/components/ui";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill } from "@/components/StatusPill";
import { RetentionSection } from "@/components/RetentionSection";
import { formatDate } from "@/lib/format";
import { computeDueStatus, subJobTotals } from "@/lib/billing";
import { formatCompactMoney } from "@/lib/currency";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error("Failed to load project");
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return res.json();
};

interface Milestone {
  id: string;
  label: string;
  percent: number;
  sequence: number;
  billedSupplyAmt: number;
  billedInstallationAmt: number;
  dueDate: string | null;
  createdAt: string;
  reminderLogs: {
    id: string;
    status: string;
    sentAt: string;
    subject: string;
    reminderStage: { name: string };
  }[];
}
interface Collection {
  id: string;
  amount: number;
  receivedOn: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}
interface SubJob {
  id: string;
  name: string;
  poSupplyAmt: number;
  poInstallationAmt: number;
  sellingSupplyAmt: number;
  sellingErectionAmt: number;
  createdAt: string;
  milestones: Milestone[];
  collections: Collection[];
}
interface RetentionInstallmentSummary {
  amount: number;
  amountReceived: number;
}
interface Project {
  id: string;
  name: string;
  clientName: string | null;
  clientEmail: string | null;
  jobCode: string | null;
  remarks: string | null;
  status: string;
  currency: string;
  subJobs: SubJob[];
  retentionInstallments: RetentionInstallmentSummary[];
}

async function downloadStatement(project: Project) {
  const res = await fetch(`/api/projects/${project.id}/statement`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = project.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  a.download = `statement-${slug || project.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const key = `/api/projects/${id}`;
  const { data: project, error, isLoading } = useSWR<Project>(key, fetcher);

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 flex flex-col items-center text-center gap-3 mt-16">
        <div className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
          Project not found
        </div>
        <p className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
          This project may have been deleted, or the link is out of date.
        </p>
        <Link href="/projects" className="text-[13px] font-medium mt-1" style={{ color: "var(--accent)" }}>
          ← Back to Projects
        </Link>
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        <div className="h-8 w-64 rounded-lg animate-pulse mb-6" style={{ background: "var(--surface)" }} />
        <div className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
      </div>
    );
  }

  const totals = project.subJobs.reduce(
    (acc, sj) => {
      const t = subJobTotals(sj);
      acc.po += t.po;
      acc.selling += t.selling;
      acc.billed += t.billed;
      acc.collected += t.collected;
      acc.unbilled += t.unbilled;
      acc.outstanding += t.outstanding;
      return acc;
    },
    { po: 0, selling: 0, billed: 0, collected: 0, unbilled: 0, outstanding: 0 }
  );
  // Outstanding is the single "total owed" figure — remaining contract
  // balance (PO − Collected) plus any retention still unpaid, so it's not
  // split across two numbers the reader has to add up themselves.
  const retentionOutstanding = project.retentionInstallments.reduce(
    (s, r) => s + Math.max(0, r.amount - r.amountReceived),
    0
  );
  totals.outstanding += retentionOutstanding;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-6">
      <div className="animate-fade-up">
        <Link href="/projects" className="text-[12.5px] font-medium hover:opacity-80 transition-opacity" style={{ color: "var(--accent)" }}>
          ← All Projects
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-[15px] font-bold shrink-0"
              style={{ background: "var(--accent-soft)", color: "var(--accent-soft-ink)" }}
            >
              {project.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight">{project.name}</h1>
              <div className="text-[13px] mt-0.5" style={{ color: "var(--ink-muted)" }}>
                {project.clientName ?? "—"} · {project.jobCode ?? "No job code"}
              </div>
            </div>
          </div>
          <Button variant="secondary" onClick={() => downloadStatement(project)}>
            Download Statement (PDF)
          </Button>
        </div>
        {project.remarks && (
          <div
            className="mt-4 text-[12.5px] rounded-lg px-3.5 py-2.5 flex items-start gap-2"
            style={{ background: "var(--status-due-soon-bg)", color: "var(--status-due-soon)" }}
          >
            <span className="mt-0.5">⚠</span>
            <span>{project.remarks}</span>
          </div>
        )}
        <ClientEmailField project={project} projectKey={`/api/projects/${project.id}`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
        <Metric label="PO Value" value={formatCompactMoney(totals.po, project.currency)} />
        <Metric label="Selling Value" value={totals.selling > 0 ? formatCompactMoney(totals.selling, project.currency) : "—"} />
        <Metric label="Billed" value={formatCompactMoney(totals.billed, project.currency)} />
        <Metric label="Collected" value={formatCompactMoney(totals.collected, project.currency)} tone="good" />
        <Metric
          label="Outstanding"
          value={formatCompactMoney(totals.outstanding, project.currency)}
          tone={totals.outstanding > 0 ? "crit" : "good"}
        />
      </div>

      <div className="flex flex-col gap-4">
        {project.subJobs.map((subJob) => (
          <SubJobCard key={subJob.id} subJob={subJob} currency={project.currency} />
        ))}
      </div>

      <AddSubJobForm projectId={project.id} projectKey={key} />

      <RetentionSection
        projectId={project.id}
        currency={project.currency}
        clientEmail={project.clientEmail ?? ""}
        suggestedAmount={Math.max(0, totals.po - totals.billed)}
        projectName={project.name}
        clientName={project.clientName}
        jobCode={project.jobCode}
        poAmount={totals.po}
        billedAmount={totals.billed}
        outstandingAmount={totals.outstanding}
      />

      <MonthlyTargetsSection projectId={project.id} currency={project.currency} />
    </div>
  );
}

function ClientEmailField({ project, projectKey }: { project: Project; projectKey: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(project.clientEmail ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientEmail: value.trim() || null }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Enter a valid email address.");
      return;
    }
    await mutate(projectKey);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mt-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <div className="w-80">
            <Input
              type="email"
              multiple
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="client@example.com, accounts@example.com"
              autoFocus
            />
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" onClick={() => { setEditing(false); setError(null); }}>
            Cancel
          </Button>
        </div>
        {error && (
          <p className="text-[12px]" style={{ color: "var(--status-overdue)" }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="mt-4 flex items-center gap-2 text-[12.5px] rounded-lg px-3 py-2 transition-colors hover:bg-[var(--surface-hover)]"
      style={{
        background: project.clientEmail ? "var(--bg)" : "var(--status-due-soon-bg)",
        color: project.clientEmail ? "var(--ink-muted)" : "var(--status-due-soon)",
      }}
    >
      <span>✉</span>
      {project.clientEmail ? (
        <span>
          Reminders send to <b style={{ color: "var(--ink)" }}>{project.clientEmail}</b>
        </span>
      ) : (
        <span>No client email set — reminders won&apos;t have a recipient. Click to add one.</span>
      )}
      {project.clientEmail && (
        <span className="ml-1 font-semibold underline underline-offset-2" style={{ color: "var(--accent)" }}>
          Edit
        </span>
      )}
    </button>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "crit" }) {
  const color = tone === "good" ? "var(--status-completed)" : tone === "crit" ? "var(--status-overdue)" : "var(--ink)";
  return (
    <Card>
      <div className="text-[10.5px] uppercase tracking-wide font-medium" style={{ color: "var(--ink-faint)" }}>
        {label}
      </div>
      <div className="mt-1 text-[1.15rem] font-semibold tabular" style={{ color }}>
        {value}
      </div>
    </Card>
  );
}

function SubJobCard({ subJob, currency }: { subJob: SubJob; currency: string }) {
  const totals = subJobTotals(subJob);
  const billedPct = totals.base > 0 ? (totals.billed / totals.base) * 100 : 0;
  const collectedPct = totals.billed > 0 ? (totals.collected / totals.billed) * 100 : 0;

  return (
    <Card padded={false}>
      <div className="p-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-[15px]">{subJob.name}</h3>
          <div className="text-[12px] tabular" style={{ color: "var(--ink-muted)" }}>
            {formatCompactMoney(totals.billed, currency)} / {formatCompactMoney(totals.base, currency)} billed
          </div>
        </div>
        <div className="mt-2.5">
          <ProgressBar pct={billedPct} />
        </div>
      </div>

      <div className="p-5">
        <SubJobOverview subJob={subJob} totals={totals} billedPct={billedPct} collectedPct={collectedPct} currency={currency} />
      </div>
    </Card>
  );
}

function BreakdownRow({
  label,
  supply,
  secondary,
  secondaryLabel,
  total,
  currency,
}: {
  label: string;
  supply: number;
  secondary: number;
  secondaryLabel: string;
  total: number;
  currency: string;
}) {
  return (
    <tr className="border-t" style={{ borderColor: "var(--border)" }}>
      <td className="py-2.5 text-[12.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
        {label}
      </td>
      <td className="py-2.5 text-[12.5px] tabular text-right">{formatCompactMoney(supply, currency)}</td>
      <td className="py-2.5 text-[12.5px] tabular text-right">{formatCompactMoney(secondary, currency)}</td>
      <td className="py-2.5 text-[13px] tabular text-right font-semibold">{formatCompactMoney(total, currency)}</td>
    </tr>
  );
}

function SubJobOverview({
  subJob,
  totals,
  billedPct,
  collectedPct,
  currency,
}: {
  subJob: SubJob;
  totals: ReturnType<typeof subJobTotals>;
  billedPct: number;
  collectedPct: number;
  currency: string;
}) {
  const hasSelling = subJob.sellingSupplyAmt > 0 || subJob.sellingErectionAmt > 0;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label="PO Value" value={formatCompactMoney(totals.po, currency)} />
        <MiniStat label="Selling Value" value={hasSelling ? formatCompactMoney(totals.selling, currency) : "—"} />
        <MiniStat label="Unbilled" value={formatCompactMoney(totals.unbilled, currency)} tone={totals.unbilled > 0 ? "warn" : "good"} />
        <MiniStat label="Contract Balance" value={formatCompactMoney(totals.outstanding, currency)} tone={totals.outstanding > 0 ? "crit" : "good"} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left pb-2 text-[10.5px] uppercase tracking-wide font-semibold" style={{ color: "var(--ink-faint)" }}>
                Component
              </th>
              <th className="text-right pb-2 text-[10.5px] uppercase tracking-wide font-semibold" style={{ color: "var(--ink-faint)" }}>
                Supply
              </th>
              <th className="text-right pb-2 text-[10.5px] uppercase tracking-wide font-semibold" style={{ color: "var(--ink-faint)" }}>
                Installation
              </th>
              <th className="text-right pb-2 text-[10.5px] uppercase tracking-wide font-semibold" style={{ color: "var(--ink-faint)" }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <BreakdownRow
              label="PO Amount"
              supply={subJob.poSupplyAmt}
              secondary={subJob.poInstallationAmt}
              secondaryLabel="Installation"
              total={subJob.poSupplyAmt + subJob.poInstallationAmt}
              currency={currency}
            />
            {hasSelling && (
              <BreakdownRow
                label="Selling Value"
                supply={subJob.sellingSupplyAmt}
                secondary={subJob.sellingErectionAmt}
                secondaryLabel="Erection"
                total={subJob.sellingSupplyAmt + subJob.sellingErectionAmt}
                currency={currency}
              />
            )}
            <BreakdownRow
              label="Billed"
              supply={subJob.milestones.reduce((s, m) => s + m.billedSupplyAmt, 0)}
              secondary={subJob.milestones.reduce((s, m) => s + m.billedInstallationAmt, 0)}
              secondaryLabel="Installation"
              total={totals.billed}
              currency={currency}
            />
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
              Billed vs {hasSelling ? "Selling Value" : "PO"}
            </span>
            <span className="text-[11.5px] tabular" style={{ color: "var(--ink-faint)" }}>
              {billedPct.toFixed(1)}%
            </span>
          </div>
          <ProgressBar pct={billedPct} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
              Collected vs Billed
            </span>
            <span className="text-[11.5px] tabular" style={{ color: "var(--ink-faint)" }}>
              {collectedPct.toFixed(1)}%
            </span>
          </div>
          <ProgressBar pct={collectedPct} color="var(--status-completed)" />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "crit" }) {
  const color =
    tone === "good" ? "var(--status-completed)" : tone === "warn" ? "var(--status-due-soon)" : tone === "crit" ? "var(--status-overdue)" : "var(--ink)";
  return (
    <div className="rounded-lg px-3 py-2.5" style={{ background: "var(--bg)" }}>
      <div className="text-[10.5px] uppercase tracking-wide font-medium" style={{ color: "var(--ink-faint)" }}>
        {label}
      </div>
      <div className="mt-1 text-[13.5px] font-semibold tabular" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function SubJobMilestones({ subJob, projectKey, currency }: { subJob: SubJob; projectKey: string; currency: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const totals = subJobTotals(subJob);
  const collectedRatio = totals.billed > 0 ? totals.collected / totals.billed : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[12.5px] font-semibold" style={{ color: "var(--ink-muted)" }}>
          PAYMENT MILESTONE LEDGER
        </h4>
        <button onClick={() => setShowAdd((v) => !v)} className="text-[12px] font-medium" style={{ color: "var(--accent)" }}>
          + Add milestone
        </button>
      </div>

      {showAdd && <AddMilestoneForm subJobId={subJob.id} projectKey={projectKey} onClose={() => setShowAdd(false)} />}

      {subJob.milestones.length === 0 ? (
        <p className="text-[12.5px] py-2" style={{ color: "var(--ink-faint)" }}>
          No milestones yet.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                {["Milestone", "%", "Due Date", "Billed", "Collected", "Balance", "Status"].map((h, i) => (
                  <th
                    key={h}
                    className={`pb-2 px-1 text-[10.5px] uppercase tracking-wide font-semibold ${i === 0 ? "text-left" : "text-right"}`}
                    style={{ color: "var(--ink-faint)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subJob.milestones
                .sort((a, b) => a.sequence - b.sequence)
                .map((m) => {
                  const billed = m.billedSupplyAmt + m.billedInstallationAmt;
                  const estCollected = billed * Math.min(1, collectedRatio);
                  const balance = Math.max(0, billed - estCollected);
                  const { status, label } = computeDueStatus(m.dueDate, balance);
                  return (
                    <tr key={m.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="py-2.5 px-1 text-[12.5px] font-medium">
                        {m.label}
                        {m.reminderLogs.length > 0 && (
                          <span className="ml-1.5 text-[10.5px] font-normal" style={{ color: "var(--ink-faint)" }}>
                            · {m.reminderLogs.length} reminder{m.reminderLogs.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-1 text-[12px] tabular text-right" style={{ color: "var(--ink-muted)" }}>
                        {(m.percent * 100).toFixed(0)}%
                      </td>
                      <td className="py-2.5 px-1 text-[12px] tabular text-right" style={{ color: "var(--ink-muted)" }}>
                        {formatDate(m.dueDate)}
                      </td>
                      <td className="py-2.5 px-1 text-[12.5px] tabular text-right font-medium">{formatCompactMoney(billed, currency)}</td>
                      <td className="py-2.5 px-1 text-[12.5px] tabular text-right" style={{ color: "var(--status-completed)" }}>
                        {formatCompactMoney(estCollected, currency)}
                      </td>
                      <td
                        className="py-2.5 px-1 text-[12.5px] tabular text-right font-semibold"
                        style={{ color: balance > 0 ? "var(--status-overdue)" : "var(--ink-faint)" }}
                      >
                        {formatCompactMoney(balance, currency)}
                      </td>
                      <td className="py-2.5 px-1 text-right">
                        <StatusPill status={status} label={label} />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SubJobCollections({ subJob, projectKey, currency }: { subJob: SubJob; projectKey: string; currency: string }) {
  const [showAdd, setShowAdd] = useState(false);
  const sorted = [...subJob.collections].sort((a, b) => new Date(b.receivedOn).getTime() - new Date(a.receivedOn).getTime());
  let running = subJob.collections.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[12.5px] font-semibold" style={{ color: "var(--ink-muted)" }}>
          COLLECTION HISTORY
        </h4>
        <button onClick={() => setShowAdd((v) => !v)} className="text-[12px] font-medium" style={{ color: "var(--accent)" }}>
          + Record payment
        </button>
      </div>
      {showAdd && <AddCollectionForm subJobId={subJob.id} projectKey={projectKey} onClose={() => setShowAdd(false)} />}
      {subJob.collections.length === 0 ? (
        <p className="text-[12.5px] py-2" style={{ color: "var(--ink-faint)" }}>
          No collections recorded.
        </p>
      ) : (
        <div className="flex flex-col">
          {sorted.map((c, i) => {
            const runningAtThisPoint = running;
            running -= c.amount;
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 py-2.5"
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium">{formatDate(c.receivedOn)}</div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                    {c.reference || "No reference"} {c.notes && `· ${c.notes}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[13px] font-semibold tabular" style={{ color: "var(--status-completed)" }}>
                    +{formatCompactMoney(c.amount, currency)}
                  </div>
                  <div className="text-[10.5px] tabular mt-0.5" style={{ color: "var(--ink-faint)" }}>
                    total {formatCompactMoney(runningAtThisPoint, currency)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TimelineEvent {
  date: string;
  kind: "milestone" | "collection" | "reminder";
  title: string;
  detail: string;
  amount?: number;
}

function SubJobTimeline({ subJob, currency }: { subJob: SubJob; currency: string }) {
  const events: TimelineEvent[] = [];

  for (const m of subJob.milestones) {
    events.push({
      date: m.createdAt,
      kind: "milestone",
      title: `Milestone added — ${m.label}`,
      detail: `${(m.percent * 100).toFixed(0)}% · Due ${formatDate(m.dueDate)}`,
      amount: m.billedSupplyAmt + m.billedInstallationAmt,
    });
    for (const r of m.reminderLogs) {
      events.push({
        date: r.sentAt,
        kind: "reminder",
        title: `${r.reminderStage.name} — ${r.status}`,
        detail: `${m.label} · ${r.subject}`,
      });
    }
  }
  for (const c of subJob.collections) {
    events.push({
      date: c.createdAt,
      kind: "collection",
      title: "Payment recorded",
      detail: c.reference || "No reference",
      amount: c.amount,
    });
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (events.length === 0) {
    return (
      <p className="text-[12.5px] py-2" style={{ color: "var(--ink-faint)" }}>
        No activity yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-[12.5px] font-semibold" style={{ color: "var(--ink-muted)" }}>
        ACTIVITY TIMELINE
      </h4>
      <div className="flex flex-col">
        {events.map((e, i) => (
          <div key={i} className="flex gap-3 relative">
            <div className="flex flex-col items-center">
              <span
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{
                  background:
                    e.kind === "collection" ? "var(--status-completed)" : e.kind === "reminder" ? "var(--status-due-soon)" : "var(--accent)",
                }}
              />
              {i < events.length - 1 && <span className="w-px flex-1 my-0.5" style={{ background: "var(--border)" }} />}
            </div>
            <div className="pb-4 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[12.5px] font-medium">{e.title}</span>
                {e.amount !== undefined && (
                  <span className="text-[12px] tabular font-semibold" style={{ color: "var(--ink-muted)" }}>
                    {formatCompactMoney(e.amount, currency)}
                  </span>
                )}
              </div>
              <div className="text-[11.5px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                {formatDate(e.date)} · {e.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddMilestoneForm({
  subJobId,
  projectKey,
  onClose,
}: {
  subJobId: string;
  projectKey: string;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [percent, setPercent] = useState("");
  const [billed, setBilled] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!label.trim()) return;
    setSaving(true);
    await fetch(`/api/subjobs/${subJobId}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label,
        percent: percent ? parseFloat(percent) / 100 : 0,
        billedSupplyAmt: billed ? parseFloat(billed) : 0,
        billedInstallationAmt: 0,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      }),
    });
    await mutate(projectKey);
    setSaving(false);
    onClose();
  }

  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--bg)" }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Term 1" />
        </div>
        <div>
          <Label>Percent</Label>
          <Input value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="20" type="number" />
        </div>
        <div>
          <Label>Billed Amount</Label>
          <Input value={billed} onChange={(e) => setBilled(e.target.value)} placeholder="0" type="number" />
        </div>
        <div>
          <Label>Due Date</Label>
          <Input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving || !label.trim()}>
          {saving ? "Saving…" : "Add Milestone"}
        </Button>
      </div>
    </div>
  );
}

function AddCollectionForm({
  subJobId,
  projectKey,
  onClose,
}: {
  subJobId: string;
  projectKey: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!amount) return;
    setSaving(true);
    await fetch(`/api/subjobs/${subJobId}/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(amount), reference: reference || undefined }),
    });
    await mutate(projectKey);
    setSaving(false);
    onClose();
  }

  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--bg)" }}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Amount</Label>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="0" />
        </div>
        <div>
          <Label>Reference</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque no." />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving || !amount}>
          {saving ? "Saving…" : "Record Payment"}
        </Button>
      </div>
    </div>
  );
}

function AddSubJobForm({ projectId, projectKey }: { projectId: string; projectKey: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [poSupply, setPoSupply] = useState("");
  const [poInstall, setPoInstall] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch(`/api/projects/${projectId}/subjobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        poSupplyAmt: poSupply ? parseFloat(poSupply) : 0,
        poInstallationAmt: poInstall ? parseFloat(poInstall) : 0,
      }),
    });
    await mutate(projectKey);
    setSaving(false);
    setOpen(false);
    setName("");
    setPoSupply("");
    setPoInstall("");
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + Add Sub-job
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="font-semibold text-[14px]">New Sub-job</h3>
      <div className="grid md:grid-cols-3 gap-3">
        <Input placeholder="Sub-job name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="PO Supply Amt" type="number" value={poSupply} onChange={(e) => setPoSupply(e.target.value)} />
        <Input placeholder="PO Installation Amt" type="number" value={poInstall} onChange={(e) => setPoInstall(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Add Sub-job"}
        </Button>
      </div>
    </Card>
  );
}

interface MonthlyTarget {
  id: string;
  month: number;
  year: number;
  billingTarget: number;
  billingAchieved: number;
  collectionTarget: number;
  collectionAchieved: number;
}

const MONTH_LABELS = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function MonthlyTargetsSection({ projectId, currency }: { projectId: string; currency: string }) {
  const key = `/api/projects/${projectId}/monthly-targets`;
  const { data: targets, isLoading } = useSWR<MonthlyTarget[]>(key, (u: string) => fetch(u).then((r) => r.json()));
  const [showAdd, setShowAdd] = useState(false);

  if (isLoading) {
    return <div className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />;
  }

  const sorted = [...(targets ?? [])].sort((a, b) => a.year - b.year || a.month - b.month);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-[15px]">Monthly Billing &amp; Collection Targets</h3>
          <p className="text-[11.5px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
            Forward-looking plan vs. actual, by month
          </p>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="text-[12px] font-medium" style={{ color: "var(--accent)" }}>
          + Add Month
        </button>
      </div>

      {showAdd && <AddMonthlyTargetForm projectId={projectId} targetsKey={key} onClose={() => setShowAdd(false)} />}

      {sorted.length === 0 ? (
        <p className="text-[12.5px] py-2" style={{ color: "var(--ink-faint)" }}>
          No monthly targets recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr>
                {["Month", "Billing Target", "Billing Achieved", "Collection Target", "Collection Achieved"].map((h, i) => (
                  <th
                    key={h}
                    className={`pb-2 px-1 text-[10.5px] uppercase tracking-wide font-semibold ${i === 0 ? "text-left" : "text-right"}`}
                    style={{ color: "var(--ink-faint)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((mt) => (
                <MonthlyTargetRow key={mt.id} target={mt} currency={currency} targetsKey={key} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function MonthlyTargetRow({ target, currency, targetsKey }: { target: MonthlyTarget; currency: string; targetsKey: string }) {
  const billingPct = target.billingTarget > 0 ? Math.min(100, (target.billingAchieved / target.billingTarget) * 100) : 0;
  const collectionPct = target.collectionTarget > 0 ? Math.min(100, (target.collectionAchieved / target.collectionTarget) * 100) : 0;

  async function remove() {
    if (!confirm(`Remove ${MONTH_LABELS[target.month]} ${target.year} target?`)) return;
    await fetch(`/api/monthly-targets/${target.id}`, { method: "DELETE" });
    mutate(targetsKey);
  }

  return (
    <tr className="border-t group" style={{ borderColor: "var(--border)" }}>
      <td className="py-2.5 px-1 text-[12.5px] font-medium">
        {MONTH_LABELS[target.month]} {target.year}
      </td>
      <td className="py-2.5 px-1 text-right">
        <div className="text-[12.5px] tabular font-medium">{formatCompactMoney(target.billingTarget, currency)}</div>
      </td>
      <td className="py-2.5 px-1 text-right">
        <div className="text-[12.5px] tabular" style={{ color: billingPct >= 100 ? "var(--status-completed)" : "var(--ink-muted)" }}>
          {formatCompactMoney(target.billingAchieved, currency)}
        </div>
        {target.billingTarget > 0 && (
          <div className="w-16 ml-auto mt-1">
            <ProgressBar pct={billingPct} />
          </div>
        )}
      </td>
      <td className="py-2.5 px-1 text-right">
        <div className="text-[12.5px] tabular font-medium">{formatCompactMoney(target.collectionTarget, currency)}</div>
      </td>
      <td className="py-2.5 px-1 text-right">
        <div className="flex items-center justify-end gap-2">
          <div>
            <div className="text-[12.5px] tabular" style={{ color: collectionPct >= 100 ? "var(--status-completed)" : "var(--ink-muted)" }}>
              {formatCompactMoney(target.collectionAchieved, currency)}
            </div>
            {target.collectionTarget > 0 && (
              <div className="w-16 ml-auto mt-1">
                <ProgressBar pct={collectionPct} color="var(--status-completed)" />
              </div>
            )}
          </div>
          <button
            onClick={remove}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px]"
            style={{ color: "var(--status-overdue)" }}
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddMonthlyTargetForm({ projectId, targetsKey, onClose }: { projectId: string; targetsKey: string; onClose: () => void }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [billingTarget, setBillingTarget] = useState("");
  const [billingAchieved, setBillingAchieved] = useState("");
  const [collectionTarget, setCollectionTarget] = useState("");
  const [collectionAchieved, setCollectionAchieved] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/monthly-targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month: parseInt(month, 10),
        year: parseInt(year, 10),
        billingTarget: billingTarget ? parseFloat(billingTarget) : 0,
        billingAchieved: billingAchieved ? parseFloat(billingAchieved) : 0,
        collectionTarget: collectionTarget ? parseFloat(collectionTarget) : 0,
        collectionAchieved: collectionAchieved ? parseFloat(collectionAchieved) : 0,
      }),
    });
    await mutate(targetsKey);
    setSaving(false);
    onClose();
  }

  return (
    <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: "var(--bg)" }}>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <div>
          <Label>Month</Label>
          <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div>
          <Label>Year</Label>
          <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
        <div>
          <Label>Billing Target</Label>
          <Input type="number" value={billingTarget} onChange={(e) => setBillingTarget(e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label>Billing Achieved</Label>
          <Input type="number" value={billingAchieved} onChange={(e) => setBillingAchieved(e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label>Collection Target</Label>
          <Input type="number" value={collectionTarget} onChange={(e) => setCollectionTarget(e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label>Collection Achieved</Label>
          <Input type="number" value={collectionAchieved} onChange={(e) => setCollectionAchieved(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save Month"}
        </Button>
      </div>
    </div>
  );
}

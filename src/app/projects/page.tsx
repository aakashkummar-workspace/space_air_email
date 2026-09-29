"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Button, Input, Select } from "@/components/ui";
import { downloadExport } from "@/lib/download";
import { ProgressBar } from "@/components/ProgressBar";
import { subJobTotals, computeDueStatus } from "@/lib/billing";
import { CURRENCIES, formatCompactMoney } from "@/lib/currency";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Milestone {
  dueDate: string | null;
  billedSupplyAmt: number;
  billedInstallationAmt: number;
}
interface SubJob {
  poSupplyAmt: number;
  poInstallationAmt: number;
  sellingSupplyAmt: number;
  sellingErectionAmt: number;
  milestones: Milestone[];
  collections: { amount: number }[];
}
interface Project {
  id: string;
  name: string;
  clientName: string | null;
  jobCode: string | null;
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED";
  currency: string;
  subJobs: SubJob[];
  retentionInstallments: { amount: number; amountReceived: number }[];
}

function projectTotals(project: Project) {
  const totals = project.subJobs.reduce(
    (acc, sj) => {
      const t = subJobTotals(sj);
      acc.po += t.po;
      acc.billed += t.billed;
      acc.collected += t.collected;
      acc.unbilled += t.unbilled;
      acc.outstanding += t.outstanding;
      return acc;
    },
    { po: 0, billed: 0, collected: 0, unbilled: 0, outstanding: 0 }
  );
  // Fold in unpaid retention so this list's Outstanding matches the total
  // owed shown on the project detail page (PO − Collected + unpaid retention).
  totals.outstanding += project.retentionInstallments.reduce(
    (s, r) => s + Math.max(0, r.amount - r.amountReceived),
    0
  );

  let worstStatus: "none" | "overdue" | "escalated" | "dueSoon" = "none";
  for (const sj of project.subJobs) {
    const t = subJobTotals(sj);
    const collectedRatio = t.billed > 0 ? t.collected / t.billed : 0;
    for (const m of sj.milestones) {
      const billed = m.billedSupplyAmt + m.billedInstallationAmt;
      const estCollected = billed * Math.min(1, collectedRatio);
      const balance = Math.max(0, billed - estCollected);
      const { status } = computeDueStatus(m.dueDate, balance);
      if (status === "ESCALATED") worstStatus = "escalated";
      else if (status === "OVERDUE" && worstStatus !== "escalated") worstStatus = "overdue";
      else if ((status === "DUE_SOON" || status === "DUE_TODAY") && worstStatus === "none") worstStatus = "dueSoon";
    }
  }

  return { ...totals, worstStatus };
}

type FilterStatus = "all" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
type FilterUrgency = "all" | "overdue" | "escalated" | "dueSoon";

export default function ProjectsPage() {
  const { data: projects, isLoading } = useSWR<Project[]>("/api/projects", fetcher);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<FilterUrgency>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const enriched = useMemo(() => (projects ?? []).map((p) => ({ project: p, totals: projectTotals(p) })), [projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter(({ project, totals }) => {
      if (q && !project.name.toLowerCase().includes(q) && !(project.jobCode ?? "").toLowerCase().includes(q) && !(project.clientName ?? "").toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter !== "all" && project.status !== statusFilter) return false;
      if (urgencyFilter !== "all" && totals.worstStatus !== urgencyFilter) return false;
      return true;
    });
  }, [enriched, search, statusFilter, urgencyFilter]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((f) => f.project.id)));
  }

  async function bulkAction(action: "setStatus" | "shiftDueDates" | "delete", extra?: Record<string, unknown>) {
    const projectIds = Array.from(selected);
    if (projectIds.length === 0) return;
    if (action === "delete" && !confirm(`Delete ${projectIds.length} project(s)? This cannot be undone.`)) return;

    await fetch("/api/projects/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, projectIds, ...extra }),
    });
    setSelected(new Set());
    mutate("/api/projects");
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-5">
      <div className="flex items-center justify-between animate-fade-up flex-wrap gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Projects</h1>
          <p className="text-[13.5px] mt-1.5" style={{ color: "var(--ink-muted)" }}>
            {projects ? `${filtered.length} of ${projects.length} project${projects.length === 1 ? "" : "s"}` : "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={downloadExport}>
            Export to Excel
          </Button>
          <Link href="/projects/import">
            <Button variant="secondary">Import from Excel</Button>
          </Link>
          <Button onClick={() => setShowNew(true)}>+ New Project</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap animate-fade-up" style={{ animationDelay: "20ms" }}>
        <div className="flex-1 min-w-[200px]">
          <Input placeholder="Search by name, client, or job code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-40">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}>
            <option value="all">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
          </Select>
        </div>
        <div className="w-44">
          <Select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value as FilterUrgency)}>
            <option value="all">Any urgency</option>
            <option value="escalated">Escalated</option>
            <option value="overdue">Overdue</option>
            <option value="dueSoon">Due soon</option>
          </Select>
        </div>
        {(search || statusFilter !== "all" || urgencyFilter !== "all") && (
          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setUrgencyFilter("all");
            }}
            className="text-[12px] font-medium px-2"
            style={{ color: "var(--accent)" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {showNew && <NewProjectForm onClose={() => setShowNew(false)} />}

      {selected.size > 0 && <BulkActionBar count={selected.size} onAction={bulkAction} onClear={() => setSelected(new Set())} />}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <p className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
            No projects match your filters.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3 animate-fade-up" style={{ animationDelay: "40ms" }}>
          <label className="flex items-center gap-2 px-1 text-[12px] font-medium cursor-pointer select-none" style={{ color: "var(--ink-faint)" }}>
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5"
            />
            Select all
          </label>
          {filtered.map(({ project, totals }) => {
            const billedPct = totals.po > 0 ? (totals.billed / totals.po) * 100 : 0;
            const isSelected = selected.has(project.id);
            return (
              <Card
                key={project.id}
                hover
                className="hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] relative"
                style={isSelected ? { borderColor: "var(--accent)" } : undefined}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(project.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1.5 w-3.5 h-3.5 shrink-0"
                  />
                  <Link href={`/projects/${project.id}`} className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0 flex items-center gap-3.5">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-bold shrink-0"
                          style={{ background: "var(--accent-soft)", color: "var(--accent-soft-ink)" }}
                        >
                          {project.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-[15px] truncate">{project.name}</h3>
                            {project.status !== "ACTIVE" && (
                              <span
                                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: "var(--status-upcoming-bg)", color: "var(--status-upcoming)" }}
                              >
                                {project.status.replace("_", " ")}
                              </span>
                            )}
                            {totals.worstStatus === "escalated" && (
                              <span
                                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: "var(--status-escalated-bg)", color: "var(--status-escalated)" }}
                              >
                                Escalated
                              </span>
                            )}
                            {totals.worstStatus === "overdue" && (
                              <span
                                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: "var(--status-overdue-bg)", color: "var(--status-overdue)" }}
                              >
                                Overdue
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                            {project.jobCode ?? "No job code"} · {project.subJobs.length} sub-job
                            {project.subJobs.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-6 text-right">
                        <div>
                          <div className="text-[10.5px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                            PO
                          </div>
                          <div className="text-[13.5px] font-semibold tabular">{formatCompactMoney(totals.po, project.currency)}</div>
                        </div>
                        <div>
                          <div className="text-[10.5px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                            Billed
                          </div>
                          <div className="text-[13.5px] font-semibold tabular">{formatCompactMoney(totals.billed, project.currency)}</div>
                        </div>
                        <div>
                          <div className="text-[10.5px] uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                            Outstanding
                          </div>
                          <div
                            className="text-[13.5px] font-semibold tabular"
                            style={{ color: totals.outstanding > 0 ? "var(--status-overdue)" : "var(--status-completed)" }}
                          >
                            {formatCompactMoney(totals.outstanding, project.currency)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <ProgressBar pct={billedPct} />
                    </div>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BulkActionBar({
  count,
  onAction,
  onClear,
}: {
  count: number;
  onAction: (action: "setStatus" | "shiftDueDates" | "delete", extra?: Record<string, unknown>) => void;
  onClear: () => void;
}) {
  const [shiftDays, setShiftDays] = useState("7");

  return (
    <Card className="flex items-center justify-between gap-3 flex-wrap animate-fade-up" style={{ borderColor: "var(--accent)" }}>
      <div className="flex items-center gap-2">
        <span
          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {count}
        </span>
        <span className="text-[13px] font-medium">selected</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Select onChange={(e) => e.target.value && onAction("setStatus", { status: e.target.value })} defaultValue="">
          <option value="" disabled>
            Set status…
          </option>
          <option value="ACTIVE">Active</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="COMPLETED">Completed</option>
        </Select>
        <div className="flex items-center gap-1.5">
          <div className="w-16">
            <Input type="number" value={shiftDays} onChange={(e) => setShiftDays(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={() => onAction("shiftDueDates", { days: parseInt(shiftDays, 10) || 0 })}>
            Shift due dates (days)
          </Button>
        </div>
        <Button variant="danger" onClick={() => onAction("delete")}>
          Delete
        </Button>
        <Button variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
    </Card>
  );
}

function NewProjectForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [projectAmount, setProjectAmount] = useState("");
  const [billedSoFar, setBilledSoFar] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const projectRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        clientName: clientName || undefined,
        clientEmail: clientEmail || undefined,
        currency,
      }),
    });
    if (!projectRes.ok) {
      setSaving(false);
      setError("Couldn't create the project — check the fields.");
      return;
    }
    const project = await projectRes.json();

    // If an amount was given, set up a single sub-job (named after the
    // project) with that PO value and, if any billed-so-far was given, one
    // "Billed to date" milestone — so PO/Billed/Balance are all in place
    // immediately instead of requiring a separate "Add Sub-job" step.
    const amount = parseFloat(projectAmount);
    if (!isNaN(amount) && amount > 0) {
      const subJobRes = await fetch(`/api/projects/${project.id}/subjobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, poSupplyAmt: amount, poInstallationAmt: 0 }),
      });
      if (subJobRes.ok) {
        const subJob = await subJobRes.json();
        const billed = parseFloat(billedSoFar);
        if (!isNaN(billed) && billed > 0) {
          await fetch(`/api/subjobs/${subJob.id}/milestones`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: "Billed to date",
              percent: amount > 0 ? Math.min(1, billed / amount) : 0,
              billedSupplyAmt: billed,
              billedInstallationAmt: 0,
            }),
          });
        }
      }
    }

    await mutate("/api/projects");
    setSaving(false);
    onClose();
  }

  return (
    <Card className="flex flex-col gap-3 animate-fade-up">
      <h3 className="font-semibold text-[14px]">New Project</h3>
      <div className="grid md:grid-cols-3 gap-3">
        <Input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        <Input
          placeholder="Client email (for reminders)"
          type="email"
          value={clientEmail}
          onChange={(e) => setClientEmail(e.target.value)}
        />
        <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.label}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Project amount (PO value)"
          type="number"
          value={projectAmount}
          onChange={(e) => setProjectAmount(e.target.value)}
        />
        <Input
          placeholder="Billed so far"
          type="number"
          value={billedSoFar}
          onChange={(e) => setBilledSoFar(e.target.value)}
          disabled={!projectAmount}
        />
      </div>
      <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
        Balance to be paid is calculated automatically as Project amount − Billed so far. Leave
        both blank to add PO/billing details later from the project page.
      </p>
      {error && (
        <p className="text-[12px]" style={{ color: "var(--status-overdue)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving || !name.trim()}>
          {saving ? "Creating…" : "Create Project"}
        </Button>
      </div>
    </Card>
  );
}

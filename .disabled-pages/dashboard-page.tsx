"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card, StatCard } from "@/components/ui";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusPill } from "@/components/StatusPill";
import { AgingChart } from "@/components/charts/AgingChart";
import { TrendChart } from "@/components/charts/TrendChart";
import { formatCompactINR, formatPercent, formatDate } from "@/lib/format";
import { computeDueStatus, subJobTotals, DueStatus, AgingBucket } from "@/lib/billing";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface DashboardData {
  totalProjects: number;
  totalPO: number;
  totalBilled: number;
  totalCollected: number;
  totalUnbilled: number;
  totalOutstanding: number;
  billedPctOfPO: number;
  collectedPctOfBilled: number;
  milestoneStatusCounts: { upcoming: number; dueSoon: number; overdue: number; escalated: number };
  aging: Record<AgingBucket, number>;
  trend: { month: string; billed: number; collected: number }[];
  monthlyTargetSummary: { billingTarget: number; billingAchieved: number; collectionTarget: number; collectionAchieved: number };
  retentionSummary: {
    totalRetention: number;
    totalRetentionReceived: number;
    totalRetentionOutstanding: number;
    overdueCount: number;
    dueSoonCount: number;
  };
}

interface Milestone {
  id: string;
  label: string;
  dueDate: string | null;
  billedSupplyAmt: number;
  billedInstallationAmt: number;
}
interface SubJob {
  id: string;
  name: string;
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
  subJobs: SubJob[];
}

function projectAttentionItems(projects: Project[]) {
  const items: {
    project: Project;
    subJob: SubJob;
    milestone: Milestone;
    status: DueStatus;
    label: string;
    balance: number;
  }[] = [];

  for (const project of projects) {
    for (const subJob of project.subJobs) {
      const totals = subJobTotals(subJob);
      const collectedRatio = totals.billed > 0 ? totals.collected / totals.billed : 0;
      for (const m of subJob.milestones) {
        const billed = m.billedSupplyAmt + m.billedInstallationAmt;
        const estCollected = billed * Math.min(1, collectedRatio);
        const balance = Math.max(0, billed - estCollected);
        const { status, label } = computeDueStatus(m.dueDate, balance);
        if (status === "OVERDUE" || status === "ESCALATED" || status === "DUE_TODAY" || status === "DUE_SOON") {
          items.push({ project, subJob, milestone: m, status, label, balance });
        }
      }
    }
  }

  const weight: Record<string, number> = { ESCALATED: 0, OVERDUE: 1, DUE_TODAY: 2, DUE_SOON: 3 };
  return items.sort((a, b) => weight[a.status] - weight[b.status]).slice(0, 8);
}

export default function DashboardPage() {
  const { data, isLoading } = useSWR<DashboardData>("/api/dashboard", fetcher);
  const { data: projects } = useSWR<Project[]>("/api/projects", fetcher);

  const attention = projects ? projectAttentionItems(projects) : [];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-8">
      <div className="animate-fade-up">
        <h1 className="font-display text-[28px] tracking-tight" style={{ color: "var(--ink)" }}>
          Dashboard
        </h1>
        <p className="text-[13.5px] mt-1.5" style={{ color: "var(--ink-muted)" }}>
          Billing and collection overview across all projects
        </p>
      </div>

      {isLoading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
            <StatCard label="Total PO Value" value={formatCompactINR(data.totalPO)} icon={<StackIcon />} tone="accent" />
            <StatCard
              label="Total Billed"
              value={formatCompactINR(data.totalBilled)}
              sub={formatPercent(data.billedPctOfPO) + " of PO"}
              icon={<InvoiceIcon />}
            />
            <StatCard
              label="Total Collected"
              value={formatCompactINR(data.totalCollected)}
              tone="good"
              sub={formatPercent(data.collectedPctOfBilled) + " of billed"}
              icon={<CheckIcon />}
            />
            <StatCard
              label="Outstanding"
              value={formatCompactINR(data.totalOutstanding)}
              tone={data.totalOutstanding > 0 ? "crit" : "good"}
              icon={<AlertIcon />}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up" style={{ animationDelay: "80ms" }}>
            <StatCard label="Projects" value={String(data.totalProjects)} />
            <StatCard label="Unbilled" value={formatCompactINR(data.totalUnbilled)} tone={data.totalUnbilled > 0 ? "warn" : "good"} />
            <StatCard
              label="Overdue Milestones"
              value={String(data.milestoneStatusCounts.overdue)}
              tone={data.milestoneStatusCounts.overdue > 0 ? "crit" : "good"}
            />
            <StatCard
              label="Escalated"
              value={String(data.milestoneStatusCounts.escalated)}
              tone={data.milestoneStatusCounts.escalated > 0 ? "crit" : "good"}
            />
          </div>

          {data.retentionSummary.totalRetention > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up" style={{ animationDelay: "100ms" }}>
              <StatCard label="Total Retention" value={formatCompactINR(data.retentionSummary.totalRetention)} />
              <StatCard
                label="Retention Received"
                value={formatCompactINR(data.retentionSummary.totalRetentionReceived)}
                tone="good"
              />
              <StatCard
                label="Retention Outstanding"
                value={formatCompactINR(data.retentionSummary.totalRetentionOutstanding)}
                tone={data.retentionSummary.totalRetentionOutstanding > 0 ? "warn" : "good"}
              />
              <StatCard
                label="Retention Overdue"
                value={String(data.retentionSummary.overdueCount)}
                tone={data.retentionSummary.overdueCount > 0 ? "crit" : "good"}
              />
            </div>
          )}

          <Card className="animate-fade-up" style={{ animationDelay: "120ms" } as React.CSSProperties}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[14px]">Billing Progress</h2>
              <span className="text-[12px] tabular" style={{ color: "var(--ink-muted)" }}>
                {formatCompactINR(data.totalBilled)} / {formatCompactINR(data.totalPO)}
              </span>
            </div>
            <ProgressBar pct={data.billedPctOfPO * 100} />
            <div className="flex items-center justify-between mt-5 mb-3">
              <h2 className="font-semibold text-[14px]">Collection Progress</h2>
              <span className="text-[12px] tabular" style={{ color: "var(--ink-muted)" }}>
                {formatCompactINR(data.totalCollected)} / {formatCompactINR(data.totalBilled)}
              </span>
            </div>
            <ProgressBar pct={data.collectedPctOfBilled * 100} color="var(--status-completed)" />
          </Card>

          <div className="grid md:grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: "140ms" }}>
            <Card>
              <h2 className="font-semibold text-[14px] mb-1">Billed vs Collected</h2>
              <p className="text-[11.5px] mb-2" style={{ color: "var(--ink-faint)" }}>
                Last 6 months
              </p>
              <TrendChart data={data.trend} />
            </Card>
            <Card>
              <h2 className="font-semibold text-[14px] mb-1">Outstanding by Age</h2>
              <p className="text-[11.5px] mb-2" style={{ color: "var(--ink-faint)" }}>
                {formatCompactINR(Object.values(data.aging).reduce((s, v) => s + v, 0))} total outstanding
              </p>
              <AgingChart aging={data.aging} />
            </Card>
          </div>

          {(data.monthlyTargetSummary.billingTarget > 0 || data.monthlyTargetSummary.collectionTarget > 0) && (
            <Card className="animate-fade-up" style={{ animationDelay: "150ms" } as React.CSSProperties}>
              <h2 className="font-semibold text-[14px] mb-3">This Month&apos;s Targets</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
                      Billing
                    </span>
                    <span className="text-[12px] tabular font-semibold">
                      {formatCompactINR(data.monthlyTargetSummary.billingAchieved)} / {formatCompactINR(data.monthlyTargetSummary.billingTarget)}
                    </span>
                  </div>
                  <ProgressBar
                    pct={
                      data.monthlyTargetSummary.billingTarget > 0
                        ? (data.monthlyTargetSummary.billingAchieved / data.monthlyTargetSummary.billingTarget) * 100
                        : 0
                    }
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11.5px] font-medium" style={{ color: "var(--ink-muted)" }}>
                      Collection
                    </span>
                    <span className="text-[12px] tabular font-semibold">
                      {formatCompactINR(data.monthlyTargetSummary.collectionAchieved)} /{" "}
                      {formatCompactINR(data.monthlyTargetSummary.collectionTarget)}
                    </span>
                  </div>
                  <ProgressBar
                    pct={
                      data.monthlyTargetSummary.collectionTarget > 0
                        ? (data.monthlyTargetSummary.collectionAchieved / data.monthlyTargetSummary.collectionTarget) * 100
                        : 0
                    }
                    color="var(--status-completed)"
                  />
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      <div className="animate-fade-up" style={{ animationDelay: "160ms" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-[14px]">Needs Attention</h2>
          <Link href="/reminders" className="text-[12.5px] font-medium hover:opacity-80 transition-opacity" style={{ color: "var(--accent)" }}>
            View all reminders →
          </Link>
        </div>
        {attention.length === 0 ? (
          <Card>
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: "var(--status-completed-bg)", color: "var(--status-completed)" }}
              >
                <CheckIcon className="w-3.5 h-3.5" />
              </div>
              <p className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
                Nothing due soon or overdue. All caught up.
              </p>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {attention.map((item) => (
              <Link key={item.milestone.id} href={`/projects/${item.project.id}`}>
                <Card hover className="flex items-center justify-between gap-4 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]">
                  <div className="min-w-0">
                    <div className="font-medium text-[13.5px] truncate">
                      {item.project.name} — {item.subJob.name}
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--ink-muted)" }}>
                      {item.milestone.label} · Due {formatDate(item.milestone.dueDate)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[13px] font-semibold tabular">{formatCompactINR(item.balance)}</span>
                    <StatusPill status={item.status} label={item.label} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StackIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}
function InvoiceIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M15 2v5h5" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  );
}
function CheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function AlertIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

// Shared billing/status computations used by both API routes and pages.

export type DueStatus =
  | "COMPLETED"
  | "UPCOMING"
  | "DUE_SOON"
  | "DUE_TODAY"
  | "OVERDUE"
  | "ESCALATED";

export interface DueStatusResult {
  status: DueStatus;
  daysUntilDue: number | null; // negative = overdue by N days
  label: string;
}

const DUE_SOON_WINDOW_DAYS = 5;
const ESCALATION_THRESHOLD_DAYS = 21;

/**
 * Determine a milestone's due-date status. Balance <= 0 always reads as
 * COMPLETED regardless of date. Otherwise status is derived purely from
 * how many days separate today from dueDate.
 */
export function computeDueStatus(
  dueDate: Date | string | null,
  balance: number
): DueStatusResult {
  if (balance <= 0.01) {
    return { status: "COMPLETED", daysUntilDue: null, label: "Paid" };
  }
  if (!dueDate) {
    return { status: "UPCOMING", daysUntilDue: null, label: "No due date" };
  }

  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const daysUntilDue = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntilDue > DUE_SOON_WINDOW_DAYS) {
    return { status: "UPCOMING", daysUntilDue, label: `Due in ${daysUntilDue} days` };
  }
  if (daysUntilDue > 0) {
    return { status: "DUE_SOON", daysUntilDue, label: `Due in ${daysUntilDue} days` };
  }
  if (daysUntilDue === 0) {
    return { status: "DUE_TODAY", daysUntilDue: 0, label: "Due today" };
  }
  const overdueBy = Math.abs(daysUntilDue);
  if (overdueBy >= ESCALATION_THRESHOLD_DAYS) {
    return { status: "ESCALATED", daysUntilDue, label: `${overdueBy} days overdue` };
  }
  return { status: "OVERDUE", daysUntilDue, label: `${overdueBy} days overdue` };
}

export const DUE_STATUS_META: Record<
  DueStatus,
  { label: string; colorVar: string; sortWeight: number }
> = {
  COMPLETED: { label: "Completed", colorVar: "--status-completed", sortWeight: 5 },
  UPCOMING: { label: "Upcoming", colorVar: "--status-upcoming", sortWeight: 4 },
  DUE_SOON: { label: "Due Soon", colorVar: "--status-due-soon", sortWeight: 3 },
  DUE_TODAY: { label: "Due Today", colorVar: "--status-due-today", sortWeight: 2 },
  OVERDUE: { label: "Overdue", colorVar: "--status-overdue", sortWeight: 1 },
  ESCALATED: { label: "Escalated", colorVar: "--status-escalated", sortWeight: 0 },
};

export function milestoneAmounts(m: {
  percent: number;
  billedSupplyAmt: number;
  billedInstallationAmt: number;
}) {
  const billed = m.billedSupplyAmt + m.billedInstallationAmt;
  return { billed };
}

export type AgingBucket = "current" | "days30" | "days60" | "days90" | "days90plus";

export const AGING_BUCKET_META: Record<AgingBucket, { label: string; colorVar: string }> = {
  current: { label: "Not yet due", colorVar: "--status-completed" },
  days30: { label: "0–30 days", colorVar: "--status-upcoming" },
  days60: { label: "30–60 days", colorVar: "--status-due-soon" },
  days90: { label: "60–90 days", colorVar: "--status-due-today" },
  days90plus: { label: "90+ days", colorVar: "--status-overdue" },
};

/** Buckets a milestone's outstanding balance by how many days overdue it is. */
export function agingBucketFor(dueDate: Date | string | null, balance: number): AgingBucket | null {
  if (balance <= 0.01) return null;
  if (!dueDate) return "current";

  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const overdueBy = Math.round((today.getTime() - due.getTime()) / 86400000);
  if (overdueBy <= 0) return "current";
  if (overdueBy <= 30) return "days30";
  if (overdueBy <= 60) return "days60";
  if (overdueBy <= 90) return "days90";
  return "days90plus";
}

export type RetentionStatus =
  | "PAID"
  | "PARTIALLY_PAID"
  | "UPCOMING"
  | "DUE_SOON"
  | "DUE_TODAY"
  | "OVERDUE"
  | "ESCALATED";

export interface RetentionStatusResult {
  status: RetentionStatus;
  daysUntilDue: number | null;
  label: string;
}

export const RETENTION_STATUS_META: Record<RetentionStatus, { label: string; colorVar: string }> = {
  PAID: { label: "Paid", colorVar: "--status-completed" },
  PARTIALLY_PAID: { label: "Partially Paid", colorVar: "--status-due-soon" },
  UPCOMING: { label: "Upcoming", colorVar: "--status-upcoming" },
  DUE_SOON: { label: "Due Soon", colorVar: "--status-due-soon" },
  DUE_TODAY: { label: "Due Today", colorVar: "--status-due-today" },
  OVERDUE: { label: "Overdue", colorVar: "--status-overdue" },
  ESCALATED: { label: "Escalated", colorVar: "--status-escalated" },
};

/**
 * Status for a single retention installment. Unlike computeDueStatus, this
 * distinguishes "fully paid" from "partially paid" (a partial payment still
 * needs attention even once its due date has passed, so it's never silently
 * treated as complete the way a milestone's balance<=0 check would).
 */
export function computeRetentionStatus(
  dueDate: Date | string | null,
  amount: number,
  amountReceived: number
): RetentionStatusResult {
  const outstanding = Math.max(0, amount - amountReceived);

  if (outstanding <= 0.01 && amount > 0) {
    return { status: "PAID", daysUntilDue: null, label: "Paid" };
  }
  if (amountReceived > 0.01) {
    return { status: "PARTIALLY_PAID", daysUntilDue: null, label: "Partially Paid" };
  }
  if (!dueDate) {
    return { status: "UPCOMING", daysUntilDue: null, label: "No due date" };
  }

  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const daysUntilDue = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (daysUntilDue > DUE_SOON_WINDOW_DAYS) {
    return { status: "UPCOMING", daysUntilDue, label: `Due in ${daysUntilDue} days` };
  }
  if (daysUntilDue > 0) {
    return { status: "DUE_SOON", daysUntilDue, label: `Due in ${daysUntilDue} days` };
  }
  if (daysUntilDue === 0) {
    return { status: "DUE_TODAY", daysUntilDue: 0, label: "Due today" };
  }
  const overdueBy = Math.abs(daysUntilDue);
  if (overdueBy >= ESCALATION_THRESHOLD_DAYS) {
    return { status: "ESCALATED", daysUntilDue, label: `${overdueBy} days overdue` };
  }
  return { status: "OVERDUE", daysUntilDue, label: `${overdueBy} days overdue` };
}

export function subJobTotals(subJob: {
  poSupplyAmt: number;
  poInstallationAmt: number;
  sellingSupplyAmt: number;
  sellingErectionAmt: number;
  milestones: { billedSupplyAmt: number; billedInstallationAmt: number }[];
  collections: { amount: number }[];
}) {
  const po = subJob.poSupplyAmt + subJob.poInstallationAmt;
  const selling = subJob.sellingSupplyAmt + subJob.sellingErectionAmt;
  const billed = subJob.milestones.reduce(
    (s, m) => s + m.billedSupplyAmt + m.billedInstallationAmt,
    0
  );
  const collected = subJob.collections.reduce((s, c) => s + c.amount, 0);
  const base = selling > 0 ? selling : po;
  const unbilled = Math.max(0, base - billed);
  // Total remaining balance owed on the whole contract — not just what's
  // been invoiced so far. Includes unbilled work, matching how the client
  // wants "Outstanding" to read on the dashboard/project pages.
  const outstanding = Math.max(0, base - collected);
  return { po, selling, billed, collected, unbilled, outstanding, base };
}

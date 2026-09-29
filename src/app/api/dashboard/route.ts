import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { subJobTotals, computeDueStatus, computeRetentionStatus, agingBucketFor, AgingBucket } from "@/lib/billing";

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      subJobs: {
        include: { milestones: true, collections: true },
      },
      retentionInstallments: true,
    },
  });

  let totalPO = 0;
  let totalBilled = 0;
  let totalCollected = 0;
  let totalUnbilled = 0;
  let totalOutstanding = 0;

  let upcoming = 0;
  let dueSoon = 0;
  let overdue = 0;
  let escalated = 0;

  let totalRetention = 0;
  let totalRetentionReceived = 0;
  let totalRetentionOutstanding = 0;
  let retentionOverdueCount = 0;
  let retentionDueSoonCount = 0;

  const aging: Record<AgingBucket, number> = { current: 0, days30: 0, days60: 0, days90: 0, days90plus: 0 };

  // Monthly billed/collected trend, last 6 months (including current)
  const monthKeys: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const trendMap: Record<string, { billed: number; collected: number }> = {};
  monthKeys.forEach((k) => (trendMap[k] = { billed: 0, collected: 0 }));

  function monthKeyOf(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  for (const project of projects) {
    for (const subJob of project.subJobs) {
      const t = subJobTotals(subJob);
      totalPO += t.po;
      totalBilled += t.billed;
      totalCollected += t.collected;
      totalUnbilled += t.unbilled;
      totalOutstanding += t.outstanding;

      const collectedRatio = t.billed > 0 ? t.collected / t.billed : 0;
      for (const m of subJob.milestones) {
        const billed = m.billedSupplyAmt + m.billedInstallationAmt;
        const estCollected = billed * Math.min(1, collectedRatio);
        const balance = Math.max(0, billed - estCollected);
        const { status } = computeDueStatus(m.dueDate, balance);
        if (status === "UPCOMING") upcoming++;
        else if (status === "DUE_SOON" || status === "DUE_TODAY") dueSoon++;
        else if (status === "OVERDUE") overdue++;
        else if (status === "ESCALATED") escalated++;

        const bucket = agingBucketFor(m.dueDate, balance);
        if (bucket) aging[bucket] += balance;

        if (billed > 0) {
          const key = monthKeyOf(new Date(m.createdAt));
          if (trendMap[key]) trendMap[key].billed += billed;
        }
      }

      for (const c of subJob.collections) {
        const key = monthKeyOf(new Date(c.receivedOn));
        if (trendMap[key]) trendMap[key].collected += c.amount;
      }
    }

    for (const r of project.retentionInstallments) {
      totalRetention += r.amount;
      totalRetentionReceived += r.amountReceived;
      totalRetentionOutstanding += Math.max(0, r.amount - r.amountReceived);
      const { status } = computeRetentionStatus(r.dueDate, r.amount, r.amountReceived);
      if (status === "OVERDUE" || status === "ESCALATED") retentionOverdueCount++;
      else if (status === "DUE_SOON" || status === "DUE_TODAY") retentionDueSoonCount++;
    }
  }

  const trend = monthKeys.map((k) => {
    const [y, m] = k.split("-");
    const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("en-IN", { month: "short" });
    return { month: label, billed: trendMap[k].billed, collected: trendMap[k].collected };
  });

  // This month's billing/collection targets vs achieved, summed across
  // every project that has a target recorded for it.
  const currentMonthTargets = await prisma.monthlyTarget.findMany({
    where: { month: now.getMonth() + 1, year: now.getFullYear() },
  });
  const monthlyTargetSummary = currentMonthTargets.reduce(
    (acc, t) => {
      acc.billingTarget += t.billingTarget;
      acc.billingAchieved += t.billingAchieved;
      acc.collectionTarget += t.collectionTarget;
      acc.collectionAchieved += t.collectionAchieved;
      return acc;
    },
    { billingTarget: 0, billingAchieved: 0, collectionTarget: 0, collectionAchieved: 0 }
  );

  return NextResponse.json({
    totalProjects: projects.length,
    totalPO,
    totalBilled,
    totalCollected,
    totalUnbilled,
    totalOutstanding,
    billedPctOfPO: totalPO > 0 ? totalBilled / totalPO : 0,
    collectedPctOfBilled: totalBilled > 0 ? totalCollected / totalBilled : 0,
    milestoneStatusCounts: { upcoming, dueSoon, overdue, escalated },
    aging,
    trend,
    monthlyTargetSummary,
    retentionSummary: {
      totalRetention,
      totalRetentionReceived,
      totalRetentionOutstanding,
      overdueCount: retentionOverdueCount,
      dueSoonCount: retentionDueSoonCount,
    },
  });
}

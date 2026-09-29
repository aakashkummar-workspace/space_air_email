import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderTemplate } from "@/lib/template";
import { formatDate } from "@/lib/format";
import { formatCompactMoney } from "@/lib/currency";
import { subJobTotals } from "@/lib/billing";
import { sendEmail } from "@/lib/email/sender";

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || '"Space Air" <billing@sirahagents.com>';

function mergeRecipients(...lists: string[]): string {
  const all = lists
    .flatMap((l) => l.split(","))
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(all)].join(", ");
}

// Evaluates every open (unpaid) milestone against the configured reminder
// stages. For each milestone, finds the single stage whose offsetDays is
// the closest one reached (today's day-offset from dueDate >= stage.offsetDays,
// picking the largest such offset — i.e. the most "advanced" stage reached).
// Logs one entry per (milestone, stage) per calendar day, so re-running this
// is idempotent within a day. Since no SMTP/API key is configured yet, every
// log is written with status SIMULATED — nothing is actually emailed.
export async function POST() {
  const stages = await prisma.reminderStage.findMany({
    where: { active: true },
    orderBy: { offsetDays: "asc" },
    include: { template: true },
  });

  if (stages.length === 0) {
    return NextResponse.json({ created: 0, message: "No active reminder stages configured." });
  }

  const subJobs = await prisma.subJob.findMany({
    include: {
      project: true,
      milestones: true,
      collections: true,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDay = new Date(today);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  let created = 0;
  const skippedNoTemplate: string[] = [];

  for (const subJob of subJobs) {
    const totals = subJobTotals(subJob);
    for (const milestone of subJob.milestones) {
      const billed = milestone.billedSupplyAmt + milestone.billedInstallationAmt;
      // Approximate this milestone's own outstanding share using the sub-job's
      // overall collected-vs-billed ratio, since collections aren't tagged per milestone.
      const collectedRatio = totals.billed > 0 ? totals.collected / totals.billed : 0;
      const estCollected = billed * Math.min(1, collectedRatio);
      const balance = Math.max(0, billed - estCollected);

      if (balance <= 0.01) continue;
      if (!milestone.dueDate) continue;

      const due = new Date(milestone.dueDate);
      due.setHours(0, 0, 0, 0);
      const daysOffset = Math.round((today.getTime() - due.getTime()) / 86400000);

      // Find the most advanced stage whose offsetDays has been reached.
      const applicable = [...stages]
        .filter((s) => daysOffset >= s.offsetDays)
        .sort((a, b) => b.offsetDays - a.offsetDays)[0];

      if (!applicable) continue;

      const alreadyLogged = await prisma.reminderLog.findFirst({
        where: {
          milestoneId: milestone.id,
          reminderStageId: applicable.id,
          sentAt: { gte: startOfDay, lte: endOfDay },
        },
      });
      if (alreadyLogged) continue;

      if (!applicable.template) {
        skippedNoTemplate.push(applicable.name);
        continue;
      }

      const currency = subJob.project.currency;
      const ctx = {
        clientName: subJob.project.clientName || subJob.project.name,
        projectName: subJob.project.name,
        jobCode: subJob.project.jobCode || "—",
        subJobName: subJob.name,
        milestoneLabel: milestone.label,
        balanceAmount: formatCompactMoney(balance, currency),
        dueDate: formatDate(milestone.dueDate),
        poAmount: formatCompactMoney(totals.po, currency),
        billedAmount: formatCompactMoney(totals.billed, currency),
      };

      const subject = renderTemplate(applicable.template.subject, ctx);
      const renderedBody = renderTemplate(applicable.template.body, ctx);

      // "To" is always the project's own client email when set — the
      // template's own To/CC/BCC lists are treated as additional CC so a
      // shared mailbox (e.g. support@) stays in the loop without having to
      // duplicate every client's address into every template.
      const toRecipients = subJob.project.clientEmail || applicable.template.toRecipients;
      const ccRecipients = subJob.project.clientEmail
        ? mergeRecipients(applicable.template.toRecipients, applicable.template.ccRecipients)
        : applicable.template.ccRecipients;

      const toList = toRecipients.split(",").map((s) => s.trim()).filter(Boolean);
      const ccList = ccRecipients.split(",").map((s) => s.trim()).filter(Boolean);
      const bccList = applicable.template.bccRecipients.split(",").map((s) => s.trim()).filter(Boolean);

      const result = toList.length > 0
        ? await sendEmail({ from: FROM_ADDRESS, to: toList, cc: ccList, bcc: bccList, subject, html: renderedBody })
        : { status: "SIMULATED" as const, providerId: null, errorMessage: "No recipient configured" };

      await prisma.reminderLog.create({
        data: {
          milestoneId: milestone.id,
          reminderStageId: applicable.id,
          status: result.status,
          errorMessage: result.errorMessage,
          toRecipients,
          ccRecipients,
          bccRecipients: applicable.template.bccRecipients,
          subject,
          body: renderedBody,
        },
      });

      await prisma.notification.create({
        data: {
          kind: applicable.isEscalation ? "ESCALATED" : daysOffset > 0 ? "OVERDUE" : daysOffset === 0 ? "DUE_SOON" : "REMINDER_SENT",
          title: applicable.isEscalation ? `Escalation — ${subJob.project.name}` : `Reminder sent — ${subJob.project.name}`,
          body: `${subJob.name} · ${milestone.label} · ${formatCompactMoney(balance, currency)} · ${applicable.name}`,
          link: `/projects/${subJob.projectId}`,
        },
      });

      created++;
    }
  }

  return NextResponse.json({
    created,
    skippedNoTemplate: [...new Set(skippedNoTemplate)],
  });
}

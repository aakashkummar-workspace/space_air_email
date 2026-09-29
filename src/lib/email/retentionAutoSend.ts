import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/sender";
import { renderTemplate } from "@/lib/template";
import { formatCompactMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { subJobTotals } from "@/lib/billing";

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || '"Space Air" <billing@sirahagents.com>';

const DEFAULT_SUBJECT = "Retention Reminder — {{project_name}}";
const DEFAULT_BODY =
  "Dear {{client_name}},\n\nThis is a reminder regarding the retention amount due for {{project_name}}.\n\nRetention Amount: {{retention_amount}}\nDue Date: {{retention_due_date}}\nOutstanding: {{retention_outstanding}}\n\nPlease arrange payment at your earliest convenience.\n\nRegards";

/**
 * Finds every retention installment with autoSendEmail on, a dueDate that
 * has been reached, and no prior auto-send — sends the reminder through the
 * same pipeline the manual "Send Email" button uses, then marks autoSentAt
 * so it never fires twice. Called both by the /api/retention/auto-send route
 * (manual/external trigger) and by the in-process scheduler in
 * instrumentation.ts (automatic, periodic).
 */
export async function runRetentionAutoSend(): Promise<{ sent: number; skipped: string[] }> {
  const due = await prisma.retentionInstallment.findMany({
    where: {
      autoSendEmail: true,
      autoSentAt: null,
      dueDate: { lte: new Date() },
    },
    include: { project: { include: { subJobs: { include: { milestones: true, collections: true } } } } },
  });

  let sent = 0;
  const skipped: string[] = [];

  for (const installment of due) {
    const toList = (installment.project.clientEmail || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (toList.length === 0) {
      skipped.push(`${installment.project.name} — ${installment.label} (no client email)`);
      // Intentionally leave autoSentAt null so this retries on the next
      // poll once a client email is added, instead of silently never sending.
      continue;
    }

    const totals = installment.project.subJobs.reduce(
      (acc, sj) => {
        const t = subJobTotals(sj);
        acc.po += t.po;
        acc.billed += t.billed;
        acc.outstanding += t.outstanding;
        return acc;
      },
      { po: 0, billed: 0, outstanding: 0 }
    );
    const currency = installment.project.currency;
    const ctx = {
      clientName: installment.project.clientName || installment.project.name,
      projectName: installment.project.name,
      jobCode: installment.project.jobCode || "—",
      poAmount: formatCompactMoney(totals.po, currency),
      billedAmount: formatCompactMoney(totals.billed, currency),
      outstandingAmount: formatCompactMoney(totals.outstanding, currency),
      retentionAmount: formatCompactMoney(installment.amount, currency),
      retentionDueDate: formatDate(installment.dueDate),
      retentionLabel: installment.label,
      retentionReceived: formatCompactMoney(installment.amountReceived, currency),
      retentionOutstanding: formatCompactMoney(Math.max(0, installment.amount - installment.amountReceived), currency),
    };

    const subject = renderTemplate(DEFAULT_SUBJECT, ctx);
    const body = renderTemplate(DEFAULT_BODY, ctx);

    let thread = await prisma.emailThread.findFirst({
      where: { retentionInstallmentId: installment.id },
      orderBy: { createdAt: "desc" },
    });
    if (!thread) {
      thread = await prisma.emailThread.create({
        data: { retentionInstallmentId: installment.id, subject },
      });
    }

    const lastMessage = await prisma.emailMessage.findFirst({
      where: { threadId: thread.id },
      orderBy: { createdAt: "desc" },
    });

    const result = await sendEmail({
      from: FROM_ADDRESS,
      to: toList,
      subject,
      html: body,
      inReplyToProviderId: lastMessage?.providerId ?? null,
      existingGmailThreadId: thread.gmailThreadId,
    });

    await prisma.emailMessage.create({
      data: {
        threadId: thread.id,
        direction: "OUTBOUND",
        fromAddress: result.fromAddress,
        toRecipients: toList.join(", "),
        subject,
        body,
        status: result.status,
        errorMessage: result.errorMessage,
        providerId: result.providerId,
      },
    });

    await prisma.emailThread.update({
      where: { id: thread.id },
      data: { unread: false, gmailThreadId: result.gmailThreadId ?? thread.gmailThreadId },
    });

    await prisma.retentionInstallment.update({
      where: { id: installment.id },
      data: { autoSentAt: new Date() },
    });

    await prisma.notification.create({
      data: {
        kind: "REMINDER_SENT",
        title: `Auto-reminder sent — ${installment.project.name}`,
        body: `${installment.label} · ${formatCompactMoney(installment.amount, currency)} · due ${formatDate(installment.dueDate)}`,
        link: `/projects/${installment.projectId}`,
      },
    });

    await logAudit({
      action: "create",
      entityType: "EmailMessage",
      entityId: installment.id,
      summary: `Auto-sent retention email "${subject}" for "${installment.label}" (scheduled)`,
    });

    sent++;
  }

  return { sent, skipped };
}

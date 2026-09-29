import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email/sender";
import { renderTemplate } from "@/lib/template";
import { formatCompactMoney } from "@/lib/currency";
import { formatDate } from "@/lib/format";
import { subJobTotals } from "@/lib/billing";
import { z } from "zod";

const attachmentSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  dataUrl: z.string(), // data:<mime>;base64,....
});

const sendSchema = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).default([]),
  bcc: z.array(z.string().email()).default([]),
  subject: z.string().min(1),
  body: z.string().min(1),
  attachments: z.array(attachmentSchema).default([]),
  // when replying within an existing thread instead of starting a new one
  threadId: z.string().nullable().optional(),
});

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || '"Space Air" <billing@sirahagents.com>';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const installment = await prisma.retentionInstallment.findUnique({
    where: { id },
    include: { project: { include: { subJobs: { include: { milestones: true, collections: true } } } } },
  });
  if (!installment) return NextResponse.json({ error: "Retention installment not found" }, { status: 404 });

  const session = await auth();
  const { to, cc, bcc, subject, body: rawBody, attachments, threadId } = parsed.data;

  // Render {{tokens}} in subject/body against this project's + installment's
  // real figures, so a template written once works for every project.
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

  const renderedSubject = renderTemplate(subject, ctx);
  const renderedBody = renderTemplate(rawBody, ctx);

  // Find or create the thread for this installment.
  let thread = threadId
    ? await prisma.emailThread.findUnique({ where: { id: threadId } })
    : await prisma.emailThread.findFirst({
        where: { retentionInstallmentId: installment.id },
        orderBy: { createdAt: "desc" },
      });

  if (!thread) {
    thread = await prisma.emailThread.create({
      data: { retentionInstallmentId: installment.id, subject: renderedSubject },
    });
  }

  // Find the last outbound message in this thread to chain In-Reply-To for
  // real providers (keeps the client's email client threading correctly).
  const lastMessage = await prisma.emailMessage.findFirst({
    where: { threadId: thread.id },
    orderBy: { createdAt: "desc" },
  });

  const result = await sendEmail({
    from: FROM_ADDRESS,
    to,
    cc,
    bcc,
    subject: renderedSubject,
    html: renderedBody,
    attachments,
    inReplyToProviderId: lastMessage?.providerId ?? null,
    existingGmailThreadId: thread.gmailThreadId,
  });

  const message = await prisma.emailMessage.create({
    data: {
      threadId: thread.id,
      direction: "OUTBOUND",
      fromAddress: result.fromAddress,
      toRecipients: to.join(", "),
      ccRecipients: cc.join(", "),
      bccRecipients: bcc.join(", "),
      subject: renderedSubject,
      body: renderedBody,
      status: result.status,
      errorMessage: result.errorMessage,
      providerId: result.providerId,
      sentByUserId: session?.user?.id ?? null,
      attachments: {
        create: attachments.map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          sizeBytes: Math.round((a.dataUrl.length * 3) / 4), // rough base64 -> bytes estimate
          dataUrl: a.dataUrl,
        })),
      },
    },
    include: { attachments: true },
  });

  await prisma.emailThread.update({
    where: { id: thread.id },
    data: { unread: false, gmailThreadId: result.gmailThreadId ?? thread.gmailThreadId },
  });

  await logAudit({
    action: "create",
    entityType: "EmailMessage",
    entityId: message.id,
    summary: `${result.status === "SIMULATED" ? "Simulated" : result.status === "SENT" ? "Sent" : "Attempted"} retention email "${renderedSubject}" for "${installment.label}"`,
  });

  return NextResponse.json({ thread, message }, { status: 201 });
}

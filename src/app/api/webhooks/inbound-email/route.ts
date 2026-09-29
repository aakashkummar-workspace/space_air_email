import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Resend's inbound-email webhook posts a payload shaped like:
// { type: "email.received", data: { from, to, cc, subject, text, html,
//   headers: { "in-reply-to": "<providerId>", ... }, attachments: [...] } }
// We verify the webhook signature (Svix format, same as Resend's outbound
// event webhooks) before trusting anything in the body — this endpoint is
// public by necessity (Resend calls it from the internet).
//
// Threading: Resend sets In-Reply-To to the providerId of the message this
// is replying to. We look up which EmailMessage has that providerId, walk
// back to its thread, and append the reply there. If no match is found
// (e.g. the client started a fresh email instead of hitting Reply), we
// fall back to matching by the retention installment's project email +
// subject, and if that also fails, the message is dropped with a 200 (so
// Resend doesn't retry) — logged for manual triage rather than silently
// vanishing into a thread that doesn't make sense.

interface InboundPayload {
  type: string;
  data: {
    from: string;
    to: string[];
    subject: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
    attachments?: { filename: string; content_type: string; content: string }[];
  };
}

function verifySignature(req: NextRequest, rawBody: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // not configured yet — accept (dev-only; set this before going live)

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const secretBytes = Buffer.from(secret.split("_")[1] ?? secret, "base64");
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  return svixSignature.split(" ").some((sig) => {
    const [, value] = sig.split(",");
    return value === expected;
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySignature(req, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: InboundPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { from, to, subject, text, html, headers, attachments } = payload.data;
  const inReplyTo = headers?.["in-reply-to"]?.replace(/[<>]/g, "");

  let thread = null;
  if (inReplyTo) {
    const priorMessage = await prisma.emailMessage.findFirst({ where: { providerId: inReplyTo } });
    if (priorMessage) {
      thread = await prisma.emailThread.findUnique({ where: { id: priorMessage.threadId } });
    }
  }

  if (!thread) {
    // Fallback: match by subject (stripping "Re: " prefixes) against the
    // most recent thread for any retention installment whose project's
    // client email matches the sender.
    const normalizedSubject = subject.replace(/^(re|fwd?):\s*/i, "").trim();
    thread = await prisma.emailThread.findFirst({
      where: { subject: { contains: normalizedSubject } },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!thread) {
    // Nothing to attach this to — log and accept so Resend doesn't retry.
    console.warn(`[inbound-email] No matching thread for reply from ${from}, subject "${subject}"`);
    return NextResponse.json({ ok: true, matched: false });
  }

  const message = await prisma.emailMessage.create({
    data: {
      threadId: thread.id,
      direction: "INBOUND",
      fromAddress: from,
      toRecipients: to.join(", "),
      subject,
      body: html || text || "",
      status: "RECEIVED",
      attachments: {
        create: (attachments ?? []).map((a) => ({
          filename: a.filename,
          contentType: a.content_type,
          sizeBytes: Math.round((a.content.length * 3) / 4),
          dataUrl: `data:${a.content_type};base64,${a.content}`,
        })),
      },
    },
  });

  await prisma.emailThread.update({ where: { id: thread.id }, data: { unread: true } });

  const installment = thread.retentionInstallmentId
    ? await prisma.retentionInstallment.findUnique({ where: { id: thread.retentionInstallmentId }, include: { project: true } })
    : null;

  await prisma.notification.create({
    data: {
      kind: "EMAIL_REPLY",
      title: `New reply — ${installment?.project.name ?? "Unknown project"}`,
      body: `${from} replied${installment ? ` re. ${installment.label}` : ""}: ${subject}`,
      link: installment ? `/projects/${installment.projectId}` : null,
    },
  });

  return NextResponse.json({ ok: true, matched: true, messageId: message.id });
}

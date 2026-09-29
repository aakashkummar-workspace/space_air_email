import { google, gmail_v1 } from "googleapis";
import { getOAuthClient } from "./googleOAuth";
import { prisma } from "@/lib/prisma";

/**
 * Checks every EmailThread that has a gmailThreadId for new messages we
 * haven't recorded yet. Any message in the Gmail thread whose sender is
 * NOT our connected account is treated as an inbound reply. Idempotent —
 * matches by Gmail's own message id (stored as providerId), so re-running
 * this never creates duplicates.
 */
export async function pollGmailForReplies(): Promise<{ checked: number; newReplies: number }> {
  const account = await prisma.googleMailAccount.findFirst();
  if (!account) return { checked: 0, newReplies: 0 };

  const threads = await prisma.emailThread.findMany({
    where: { gmailThreadId: { not: null } },
    include: { messages: { select: { providerId: true } } },
  });
  if (threads.length === 0) return { checked: 0, newReplies: 0 };

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: account.refreshToken });
  const gmail = google.gmail({ version: "v1", auth: client });

  let newReplies = 0;

  for (const thread of threads) {
    // providerIds of messages WE already recorded (both outbound sends and
    // previously-polled inbound replies) — anything in the Gmail thread not
    // in this set is new. We deliberately don't filter by From address: when
    // sender and recipient are the same mailbox (e.g. self-tests, or a client
    // who replies from an alias matching the display name), a From-based
    // check would wrongly treat a genuine reply as our own outbound message.
    const knownIds = new Set(thread.messages.map((m) => m.providerId).filter(Boolean));

    let gmailThread;
    try {
      gmailThread = await gmail.users.threads.get({ userId: "me", id: thread.gmailThreadId!, format: "full" });
    } catch (err) {
      console.warn(`[gmailPoll] Couldn't fetch thread ${thread.gmailThreadId}:`, err instanceof Error ? err.message : err);
      continue;
    }

    const messages = gmailThread.data.messages ?? [];
    for (const msg of messages) {
      if (!msg.id || knownIds.has(msg.id)) continue;

      const headers = msg.payload?.headers ?? [];
      const fromHeader = getHeader(headers, "From") ?? "";
      const toHeader = getHeader(headers, "To") ?? "";
      const subjectHeader = getHeader(headers, "Subject") ?? thread.subject;

      // Note: neither the From header nor Gmail's SENT label reliably tells
      // us "this is our own outbound message" — when sender and recipient
      // share a mailbox (self-tests, reply-to-self aliases), Gmail applies
      // SENT to the reply too. The only robust signal is knownIds above:
      // every message WE send is recorded with its providerId at send time,
      // so anything not in that set here is necessarily a reply.
      const body = extractBody(msg.payload);

      await prisma.emailMessage.create({
        data: {
          threadId: thread.id,
          direction: "INBOUND",
          fromAddress: fromHeader,
          toRecipients: toHeader,
          subject: subjectHeader,
          body,
          status: "RECEIVED",
          providerId: msg.id,
        },
      });

      newReplies++;
    }

    if (messages.some((m) => m.id && !knownIds.has(m.id))) {
      await prisma.emailThread.update({ where: { id: thread.id }, data: { unread: true } });

      const installment = thread.retentionInstallmentId
        ? await prisma.retentionInstallment.findUnique({ where: { id: thread.retentionInstallmentId }, include: { project: true } })
        : null;

      await prisma.notification.create({
        data: {
          kind: "EMAIL_REPLY",
          title: `New reply — ${installment?.project.name ?? "Unknown project"}`,
          body: `${installment ? `Re. ${installment.label}: ` : ""}${thread.subject}`,
          link: installment ? `/projects/${installment.projectId}` : null,
        },
      });
    }
  }

  return { checked: threads.length, newReplies };
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string | null {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  // Multipart — prefer text/html, fall back to text/plain.
  const parts = payload.parts ?? [];
  const htmlPart = parts.find((p) => p.mimeType === "text/html");
  const textPart = parts.find((p) => p.mimeType === "text/plain");
  const chosen = htmlPart ?? textPart;
  if (chosen?.body?.data) {
    return Buffer.from(chosen.body.data, "base64url").toString("utf-8");
  }

  // Nested multipart (e.g. multipart/mixed containing multipart/alternative)
  for (const part of parts) {
    const nested = extractBody(part);
    if (nested) return nested;
  }

  return "";
}

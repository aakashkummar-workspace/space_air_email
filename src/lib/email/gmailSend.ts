import { google } from "googleapis";
import { getOAuthClient } from "./googleOAuth";
import { prisma } from "@/lib/prisma";
import type { SendEmailInput, SendEmailResult } from "./sender";

/**
 * Sends via the Gmail API using the stored refresh token. Builds a raw
 * RFC 2822 MIME message (multipart/mixed when there are attachments) and
 * hands it to gmail.users.messages.send, which is the Gmail-API-idiomatic
 * way to send — there is no separate "attachments" field like Resend's API,
 * everything is one MIME payload.
 */
export async function sendViaGmail(input: SendEmailInput, existingGmailThreadId?: string | null): Promise<SendEmailResult> {
  const account = await prisma.googleMailAccount.findFirst();
  if (!account) {
    return { status: "FAILED", providerId: null, errorMessage: "No Google account connected for sending.", fromAddress: input.from };
  }

  try {
    const client = getOAuthClient();
    client.setCredentials({ refresh_token: account.refreshToken });

    const gmail = google.gmail({ version: "v1", auth: client });
    const raw = buildMimeMessage(account.email, input);

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
        // Passing threadId keeps a follow-up send in the SAME Gmail thread
        // as the original (and the client's reply to it), instead of
        // starting a new one each time.
        threadId: existingGmailThreadId ?? undefined,
      },
    });

    return {
      status: "SENT",
      providerId: res.data.id ?? null,
      errorMessage: null,
      fromAddress: account.email,
      gmailThreadId: res.data.threadId ?? null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "FAILED", providerId: null, errorMessage: message, fromAddress: account.email };
  }
}

export async function isGmailSendingReady(): Promise<boolean> {
  const account = await prisma.googleMailAccount.findFirst();
  return !!account;
}

function buildMimeMessage(fromEmail: string, input: SendEmailInput): string {
  const boundary = `----billing-suite-${Date.now()}`;
  const headers = [
    `From: "Space Air" <${fromEmail}>`,
    `To: ${input.to.join(", ")}`,
    input.cc?.length ? `Cc: ${input.cc.join(", ")}` : null,
    input.bcc?.length ? `Bcc: ${input.bcc.join(", ")}` : null,
    `Subject: ${encodeSubject(input.subject)}`,
    `MIME-Version: 1.0`,
    input.inReplyToProviderId ? `In-Reply-To: <${input.inReplyToProviderId}>` : null,
    input.inReplyToProviderId ? `References: <${input.inReplyToProviderId}>` : null,
  ].filter(Boolean);

  const hasAttachments = (input.attachments?.length ?? 0) > 0;

  let body: string;
  if (!hasAttachments) {
    headers.push(`Content-Type: text/html; charset="UTF-8"`);
    body = htmlBody(input.html);
  } else {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    const parts = [
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      ``,
      htmlBody(input.html),
    ];
    for (const att of input.attachments!) {
      const base64 = att.dataUrl.replace(/^data:[^;]+;base64,/, "");
      parts.push(
        `--${boundary}`,
        `Content-Type: ${att.contentType}; name="${att.filename}"`,
        `Content-Disposition: attachment; filename="${att.filename}"`,
        `Content-Transfer-Encoding: base64`,
        ``,
        base64
      );
    }
    parts.push(`--${boundary}--`);
    body = parts.join("\r\n");
  }

  const message = `${headers.join("\r\n")}\r\n\r\n${body}`;
  return Buffer.from(message).toString("base64url");
}

function htmlBody(html: string): string {
  // Plain-text templates (no HTML tags) still render sensibly as HTML when
  // newlines are preserved.
  return /<[a-z][\s\S]*>/i.test(html) ? html : html.replace(/\n/g, "<br>");
}

function encodeSubject(subject: string): string {
  // RFC 2047 encoding so non-ASCII subjects (rupee symbols, names) survive
  // MIME transport correctly instead of being mangled.
  return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
}

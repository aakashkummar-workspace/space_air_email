// Thin abstraction over "actually send an email" so the rest of the app
// never needs to know which backend is doing the sending. Priority order:
//   1. Gmail API, if a Google account has been connected (Settings ->
//      Google Mail) — sends as that real mailbox, e.g.
//      aakash.kummar@sirahdigital.in.
//   2. Resend, if RESEND_API_KEY is set — sends from EMAIL_FROM_ADDRESS
//      on the verified Resend domain.
//   3. SIMULATED — logged with the exact rendered subject/body/recipients
//      as if it had gone out, but nothing leaves this machine.
// Whichever is configured wins with no other code changes required.

import { sendViaGmail, isGmailSendingReady } from "./gmailSend";

export interface SendEmailInput {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  attachments?: { filename: string; contentType: string; dataUrl: string }[];
  // threads replies via References/In-Reply-To headers when you pass the
  // prior message's id back in on a follow-up send.
  inReplyToProviderId?: string | null;
  // Gmail-specific: pass the thread's existing gmailThreadId (if any) so a
  // follow-up send lands in the same Gmail thread instead of starting a new
  // one. Ignored by the Resend/simulated paths.
  existingGmailThreadId?: string | null;
}

export interface SendEmailResult {
  status: "SENT" | "SIMULATED" | "FAILED";
  providerId: string | null;
  errorMessage: string | null;
  // The address actually used to send — may differ from input.from (e.g.
  // Gmail always sends as the connected mailbox, ignoring input.from).
  fromAddress: string;
  // Gmail's own thread id, when sent via Gmail — needed to later poll that
  // thread for replies. Null for Resend/simulated sends.
  gmailThreadId?: string | null;
}

export async function isEmailSendingConfigured(): Promise<boolean> {
  if (await isGmailSendingReady()) return true;
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (await isGmailSendingReady()) {
    return sendViaGmail(input, input.existingGmailThreadId);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { status: "SIMULATED", providerId: null, errorMessage: null, fromAddress: input.from };
  }

  try {
    const attachments = (input.attachments ?? []).map((a) => ({
      filename: a.filename,
      // Resend's attachments API takes base64 content, not a data: URL —
      // strip the "data:<mime>;base64," prefix.
      content: a.dataUrl.replace(/^data:[^;]+;base64,/, ""),
    }));

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        cc: input.cc?.length ? input.cc : undefined,
        bcc: input.bcc?.length ? input.bcc : undefined,
        subject: input.subject,
        html: input.html,
        attachments: attachments.length ? attachments : undefined,
        headers: input.inReplyToProviderId
          ? { "In-Reply-To": input.inReplyToProviderId, References: input.inReplyToProviderId }
          : undefined,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { status: "FAILED", providerId: null, errorMessage: `Resend ${res.status}: ${body.slice(0, 500)}`, fromAddress: input.from };
    }

    const data = (await res.json()) as { id: string };
    return { status: "SENT", providerId: data.id, errorMessage: null, fromAddress: input.from };
  } catch (err) {
    return { status: "FAILED", providerId: null, errorMessage: err instanceof Error ? err.message : String(err), fromAddress: input.from };
  }
}

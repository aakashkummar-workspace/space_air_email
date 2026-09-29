// Runs once when the Next.js server starts. We use it to start an
// in-process interval that checks for retention installments due for
// automatic sending, and for Gmail replies, so both work even with no
// browser tab open. See https://nextjs.org/docs/app/guides/instrumentation.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

  const { runRetentionAutoSend } = await import("@/lib/email/retentionAutoSend");
  const { pollGmailForReplies } = await import("@/lib/email/gmailPoll");

  setInterval(async () => {
    try {
      const result = await runRetentionAutoSend();
      if (result.sent > 0) {
        console.log(`[scheduler] Auto-sent ${result.sent} retention reminder(s).`);
      }
    } catch (err) {
      console.warn("[scheduler] retention auto-send failed:", err instanceof Error ? err.message : err);
    }

    try {
      await pollGmailForReplies();
    } catch (err) {
      console.warn("[scheduler] gmail reply poll failed:", err instanceof Error ? err.message : err);
    }
  }, POLL_INTERVAL_MS);

  console.log(`[scheduler] Retention auto-send + reply polling started (every ${POLL_INTERVAL_MS / 60000} min).`);
}

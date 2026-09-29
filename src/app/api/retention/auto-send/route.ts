import { NextResponse } from "next/server";
import { runRetentionAutoSend } from "@/lib/email/retentionAutoSend";

// Manual/external trigger for the same auto-send sweep the background
// scheduler runs periodically (see instrumentation.ts) — useful for testing
// or for an external cron if the in-process scheduler isn't available.
export async function POST() {
  const result = await runRetentionAutoSend();
  return NextResponse.json(result);
}

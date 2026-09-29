import { NextResponse } from "next/server";
import { pollGmailForReplies } from "@/lib/email/gmailPoll";

export async function POST() {
  const result = await pollGmailForReplies();
  return NextResponse.json(result);
}

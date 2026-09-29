import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const googleAccount = await prisma.googleMailAccount.findFirst();
  const resendConfigured = !!process.env.RESEND_API_KEY;

  const configured = !!googleAccount || resendConfigured;
  const provider = googleAccount ? "gmail" : resendConfigured ? "resend" : null;

  return NextResponse.json({
    configured,
    provider,
    googleEmail: googleAccount?.email ?? null,
  });
}

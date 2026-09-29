import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGoogleOAuthConfigured } from "@/lib/email/googleOAuth";

export async function GET() {
  const account = await prisma.googleMailAccount.findFirst();
  return NextResponse.json({
    configured: isGoogleOAuthConfigured(),
    connected: !!account,
    email: account?.email ?? null,
    connectedAt: account?.connectedAt ?? null,
  });
}

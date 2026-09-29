import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient } from "@/lib/email/googleOAuth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  const settingsUrl = new URL("/settings", req.nextUrl.origin);

  if (error) {
    settingsUrl.searchParams.set("googleMailError", error);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("googleMailError", "missing_code");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.refresh_token) {
      // Happens if the user had already granted consent before and Google
      // didn't re-issue a refresh token — they need to revoke access at
      // myaccount.google.com/permissions and try again.
      settingsUrl.searchParams.set("googleMailError", "no_refresh_token");
      return NextResponse.redirect(settingsUrl);
    }

    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email) {
      settingsUrl.searchParams.set("googleMailError", "no_email_returned");
      return NextResponse.redirect(settingsUrl);
    }

    // Only one connected sender at a time — replace whatever was there.
    await prisma.googleMailAccount.deleteMany({});
    await prisma.googleMailAccount.create({
      data: { email: profile.email, refreshToken: tokens.refresh_token },
    });

    await logAudit({
      action: "create",
      entityType: "GoogleMailAccount",
      entityId: profile.email,
      summary: `Connected Google account "${profile.email}" for sending retention emails`,
    });

    settingsUrl.searchParams.set("googleMailConnected", profile.email);
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    settingsUrl.searchParams.set("googleMailError", err instanceof Error ? err.message : "unknown_error");
    return NextResponse.redirect(settingsUrl);
  }
}

import { NextResponse } from "next/server";
import { getOAuthClient, OAUTH_SCOPES, isGoogleOAuthConfigured } from "@/lib/email/googleOAuth";

// Redirects the signed-in admin to Google's consent screen. `access_type:
// offline` + `prompt: consent` guarantee a refresh_token comes back even
// on a re-authorization (Google only issues one on the FIRST consent
// otherwise, which would silently break if you ever need to reconnect).
export async function GET() {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured yet — set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET." },
      { status: 400 }
    );
  }
  const client = getOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: OAUTH_SCOPES,
  });
  return NextResponse.redirect(url);
}

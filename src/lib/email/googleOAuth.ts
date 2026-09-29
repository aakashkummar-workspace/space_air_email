import { google } from "googleapis";

// Lets this app send mail as the connected account.
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

// Needed only to identify WHICH mailbox authorized sending (so we can show
// "Connected as aakash.kummar@sirahdigital.in" in Settings) — grants no
// access beyond the account's email address and basic profile.
export const USERINFO_EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

// Read access, used ONLY to poll for replies within Gmail threads we
// started (gmail.users.threads.get on a specific thread id we already
// know) — the app never lists or browses the inbox at large. Gmail has no
// narrower "read replies to my own sent mail" scope than this.
export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export const OAUTH_SCOPES = [GMAIL_SEND_SCOPE, USERINFO_EMAIL_SCOPE, GMAIL_READONLY_SCOPE];

export function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/api/auth/google-mail/callback";

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not set");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function isGoogleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

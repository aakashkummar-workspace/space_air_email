"use client";

import useSWR, { mutate } from "swr";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Card, Button } from "@/components/ui";
import { formatDate } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Status {
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
}

export function GoogleMailStatusCard() {
  const { data, isLoading } = useSWR<Status>("/api/auth/google-mail/status", fetcher);
  const searchParams = useSearchParams();
  const router = useRouter();

  const connectedParam = searchParams.get("googleMailConnected");
  const errorParam = searchParams.get("googleMailError");

  useEffect(() => {
    if (connectedParam || errorParam) {
      mutate("/api/auth/google-mail/status");
      const url = new URL(window.location.href);
      url.searchParams.delete("googleMailConnected");
      url.searchParams.delete("googleMailError");
      router.replace(url.pathname + url.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedParam, errorParam]);

  async function disconnect() {
    if (!confirm("Disconnect this Google account? Retention emails will fall back to Resend or simulated sending.")) return;
    await fetch("/api/auth/google-mail/disconnect", { method: "POST" });
    mutate("/api/auth/google-mail/status");
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="font-semibold text-[14.5px]">Google Mail (Sending)</h3>
        <p className="text-[12.5px] mt-1" style={{ color: "var(--ink-muted)" }}>
          Connect a Google Workspace account to send retention emails as a real mailbox instead of Resend.
        </p>
      </div>

      {connectedParam && (
        <div className="text-[12.5px] rounded-lg px-3 py-2" style={{ background: "var(--status-completed-bg)", color: "var(--status-completed)" }}>
          Connected {connectedParam} successfully.
        </div>
      )}
      {errorParam && (
        <div className="text-[12.5px] rounded-lg px-3 py-2" style={{ background: "var(--status-overdue-bg)", color: "var(--status-overdue)" }}>
          Couldn&apos;t connect: {errorParam.replace(/_/g, " ")}
        </div>
      )}

      {isLoading ? (
        <div className="h-10 rounded-lg animate-pulse" style={{ background: "var(--bg)" }} />
      ) : !data?.configured ? (
        <p className="text-[12.5px]" style={{ color: "var(--ink-faint)" }}>
          Google OAuth isn&apos;t configured yet — set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET first.
        </p>
      ) : data.connected ? (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-[13px] font-medium">{data.email}</div>
            <div className="text-[11.5px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
              Connected {formatDate(data.connectedAt)}
            </div>
          </div>
          <Button variant="danger" onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      ) : (
        <a href="/api/auth/google-mail/authorize">
          <Button>Connect Google Account</Button>
        </a>
      )}
    </Card>
  );
}

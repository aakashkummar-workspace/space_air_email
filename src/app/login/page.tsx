"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Button, Input, Label, Card } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(params.get("callbackUrl") || "/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-sm flex flex-col gap-6 animate-fade-up">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl px-4 py-3" style={{ background: "#ffffff", boxShadow: "0 8px 24px var(--accent-glow)" }}>
            <Image src="/brand/spaceair-logo-original.svg" alt="Space Air" width={120} height={39} priority />
          </div>
          <div className="text-center">
            <h1 className="text-[18px] font-semibold tracking-tight">Billing Suite</h1>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--ink-muted)" }}>
              Sign in to continue
            </p>
          </div>
        </div>

        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@sirahdigital.in" required autoFocus />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            {error && (
              <p className="text-[12.5px]" style={{ color: "var(--status-overdue)" }}>
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full mt-1">
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

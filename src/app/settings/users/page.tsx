"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, Button, Input, Select, Label } from "@/components/ui";
import { formatDate } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "FINANCE" | "PM";
  createdAt: string;
}

const ROLE_META: Record<string, { label: string; desc: string; color: string; bg: string }> = {
  ADMIN: { label: "Admin", desc: "Full access — users, settings, all data", color: "var(--accent)", bg: "var(--accent-soft)" },
  FINANCE: { label: "Finance", desc: "Manages billing, collections, reminders", color: "var(--status-due-soon)", bg: "var(--status-due-soon-bg)" },
  PM: { label: "Project Manager", desc: "Views and updates project data", color: "var(--status-completed)", bg: "var(--status-completed-bg)" },
};

export default function UsersPage() {
  const { data: session } = useSession();
  const { data: users, isLoading } = useSWR<User[]>("/api/users", fetcher);
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-6">
      <div className="animate-fade-up">
        <Link href="/settings" className="text-[12.5px] font-medium hover:opacity-80 transition-opacity" style={{ color: "var(--accent)" }}>
          ← Settings
        </Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-[26px] font-semibold tracking-tight">Users & Roles</h1>
          <Button onClick={() => setShowNew(true)}>+ Add User</Button>
        </div>
        <p className="text-[13px] mt-1.5" style={{ color: "var(--ink-muted)" }}>
          Manage who can access this dashboard and what they're allowed to do.
        </p>
      </div>

      {showNew && <NewUserForm onClose={() => setShowNew(false)} />}

      {isLoading ? (
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
      ) : (
        <div className="flex flex-col gap-2 animate-fade-up" style={{ animationDelay: "40ms" }}>
          {(users ?? []).map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === session?.user?.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, isSelf }: { user: User; isSelf: boolean }) {
  const meta = ROLE_META[user.role];
  const [changingRole, setChangingRole] = useState(false);

  async function changeRole(role: string) {
    await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    mutate("/api/users");
    setChangingRole(false);
  }

  async function remove() {
    if (!confirm(`Remove ${user.name}?`)) return;
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Couldn't remove this user.");
      return;
    }
    mutate("/api/users");
  }

  return (
    <Card className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-[12.5px] font-bold shrink-0"
          style={{ background: meta.bg, color: meta.color }}
        >
          {user.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium truncate">
            {user.name} {isSelf && <span style={{ color: "var(--ink-faint)" }}>(you)</span>}
          </div>
          <div className="text-[11.5px] mt-0.5 truncate" style={{ color: "var(--ink-faint)" }}>
            {user.email} · Joined {formatDate(user.createdAt)}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {changingRole ? (
          <Select defaultValue={user.role} onChange={(e) => changeRole(e.target.value)} className="w-40">
            <option value="ADMIN">Admin</option>
            <option value="FINANCE">Finance</option>
            <option value="PM">Project Manager</option>
          </Select>
        ) : (
          <button
            onClick={() => setChangingRole(true)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-opacity hover:opacity-80"
            style={{ background: meta.bg, color: meta.color }}
          >
            {meta.label}
          </button>
        )}
        {!isSelf && (
          <Button variant="danger" onClick={remove}>
            Remove
          </Button>
        )}
      </div>
    </Card>
  );
}

function NewUserForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("PM");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !email.trim() || password.length < 6) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Couldn't create this user.");
      setSaving(false);
      return;
    }
    mutate("/api/users");
    setSaving(false);
    onClose();
  }

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="font-semibold text-[14px]">New User</h3>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@spaceair.in" />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" />
        </div>
        <div>
          <Label>Role</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="ADMIN">Admin</option>
            <option value="FINANCE">Finance</option>
            <option value="PM">Project Manager</option>
          </Select>
        </div>
      </div>
      {error && (
        <p className="text-[12.5px]" style={{ color: "var(--status-overdue)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving || !name.trim() || !email.trim() || password.length < 6}>
          {saving ? "Creating…" : "Create User"}
        </Button>
      </div>
    </Card>
  );
}

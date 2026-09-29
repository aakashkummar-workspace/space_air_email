"use client";

import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui";
import { GoogleMailStatusCard } from "@/components/GoogleMailStatusCard";

const SECTIONS = [
  {
    href: "/settings/templates",
    title: "Email Templates",
    desc: "Create and edit reminder email templates: subject, body, and dynamic tokens like {{clientName}} or {{balanceAmount}}.",
  },
  {
    href: "/settings/stages",
    title: "Reminder Stages",
    desc: "Configure when reminders fire relative to a due date (before, on, after) and which template each stage uses.",
  },
  {
    href: "/settings/audit-log",
    title: "Audit Log",
    desc: "A record of every change made to billing data across the system — who, what, when.",
  },
  {
    href: "/settings/users",
    title: "Users & Roles",
    desc: "Manage who can access the dashboard and what they're allowed to do — Admin, Finance, or Project Manager.",
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-6">
      <div className="animate-fade-up">
        <h1 className="text-[26px] font-semibold tracking-tight">Settings</h1>
        <p className="text-[13.5px] mt-1.5" style={{ color: "var(--ink-muted)" }}>
          Configure the email reminder system
        </p>
      </div>

      <Suspense fallback={<div className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />}>
        <GoogleMailStatusCard />
      </Suspense>

      <div className="grid md:grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: "40ms" }}>
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card hover className="hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] h-full">
              <h3 className="font-semibold text-[14.5px]">{s.title}</h3>
              <p className="text-[12.5px] mt-1.5" style={{ color: "var(--ink-muted)" }}>
                {s.desc}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

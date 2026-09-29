"use client";

import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { Card, Select } from "@/components/ui";
import { formatDate } from "@/lib/format";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface AuditEntry {
  id: string;
  userName: string;
  action: "create" | "update" | "delete";
  entityType: string;
  entityId: string;
  summary: string;
  diff: string | null;
  createdAt: string;
}

const ACTION_COLOR: Record<string, string> = {
  create: "var(--status-completed)",
  update: "var(--status-due-soon)",
  delete: "var(--status-overdue)",
};

const ENTITY_TYPES = ["Project", "SubJob", "Milestone", "Collection", "EmailTemplate", "ReminderStage"];

export default function AuditLogPage() {
  const [entityType, setEntityType] = useState("");
  const query = entityType ? `?entityType=${entityType}` : "";
  const { data: logs, isLoading } = useSWR<AuditEntry[]>(`/api/audit-log${query}`, fetcher);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-6">
      <div className="animate-fade-up">
        <Link href="/settings" className="text-[12.5px] font-medium hover:opacity-80 transition-opacity" style={{ color: "var(--accent)" }}>
          ← Settings
        </Link>
        <div className="flex items-center justify-between mt-2 flex-wrap gap-3">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight">Audit Log</h1>
            <p className="text-[13px] mt-1.5" style={{ color: "var(--ink-muted)" }}>
              A record of every change made to billing data — who, what, when.
            </p>
          </div>
          <div className="w-52">
            <Select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="">All types</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
          ))}
        </div>
      ) : !logs || logs.length === 0 ? (
        <Card>
          <p className="text-[13px]" style={{ color: "var(--ink-muted)" }}>
            No audit entries yet.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2 animate-fade-up" style={{ animationDelay: "40ms" }}>
          {logs.map((log) => {
            const diff: Record<string, [unknown, unknown]> | null = log.diff ? JSON.parse(log.diff) : null;
            const isOpen = expanded === log.id;
            return (
              <Card key={log.id} padded={false}>
                <button
                  onClick={() => setExpanded(isOpen ? null : log.id)}
                  className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md shrink-0"
                      style={{ background: `color-mix(in srgb, ${ACTION_COLOR[log.action]} 15%, transparent)`, color: ACTION_COLOR[log.action] }}
                    >
                      {log.action}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium truncate">{log.summary}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                        {log.userName} · {formatDate(log.createdAt)}
                      </div>
                    </div>
                  </div>
                  <span
                    className="text-[10.5px] font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: "var(--bg)", color: "var(--ink-faint)" }}
                  >
                    {log.entityType}
                  </span>
                </button>
                {isOpen && diff && Object.keys(diff).length > 0 && (
                  <div className="px-4 pb-3 flex flex-col gap-1.5">
                    {Object.entries(diff).map(([field, [oldVal, newVal]]) => (
                      <div key={field} className="text-[11.5px] rounded-lg px-3 py-2" style={{ background: "var(--bg)" }}>
                        <span className="font-medium" style={{ color: "var(--ink-muted)" }}>
                          {field}:
                        </span>{" "}
                        <span style={{ color: "var(--status-overdue)" }}>{String(oldVal ?? "—")}</span>
                        {" → "}
                        <span style={{ color: "var(--status-completed)" }}>{String(newVal ?? "—")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import Link from "next/link";
import { Card, Button, Input, Select, Label } from "@/components/ui";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Template {
  id: string;
  name: string;
}
interface Stage {
  id: string;
  name: string;
  offsetDays: number;
  isEscalation: boolean;
  active: boolean;
  sequence: number;
  templateId: string | null;
  template: Template | null;
}

function offsetLabel(days: number) {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} before due`;
  if (days === 0) return "On due date";
  return `${days} day${days === 1 ? "" : "s"} after due`;
}

export default function StagesPage() {
  const { data: stages, isLoading } = useSWR<Stage[]>("/api/reminder-stages", fetcher);
  const { data: templates } = useSWR<Template[]>("/api/templates", fetcher);
  const [creating, setCreating] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-6">
      <div className="animate-fade-up">
        <Link href="/settings" className="text-[12.5px] font-medium hover:opacity-80 transition-opacity" style={{ color: "var(--accent)" }}>
          ← Settings
        </Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-[26px] font-semibold tracking-tight">Reminder Stages</h1>
          <Button onClick={() => setCreating(true)}>+ New Stage</Button>
        </div>
        <p className="text-[13px] mt-1.5" style={{ color: "var(--ink-muted)" }}>
          Each stage fires once per milestone per day, based on days before/after the due date. The most advanced
          stage reached wins.
        </p>
      </div>

      {creating && (
        <StageEditor
          stage={null}
          templates={templates ?? []}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            mutate("/api/reminder-stages");
          }}
        />
      )}

      {isLoading ? (
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
      ) : (
        <div className="flex flex-col gap-3">
          {(stages ?? [])
            .sort((a, b) => a.offsetDays - b.offsetDays)
            .map((s) => (
              <StageRow key={s.id} stage={s} templates={templates ?? []} />
            ))}
        </div>
      )}
    </div>
  );
}

function StageRow({ stage, templates }: { stage: Stage; templates: Template[] }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <StageEditor
        stage={stage}
        templates={templates}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          mutate("/api/reminder-stages");
        }}
      />
    );
  }

  async function toggleActive() {
    await fetch(`/api/reminder-stages/${stage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !stage.active }),
    });
    mutate("/api/reminder-stages");
  }

  async function remove() {
    if (!confirm(`Delete stage "${stage.name}"?`)) return;
    await fetch(`/api/reminder-stages/${stage.id}`, { method: "DELETE" });
    mutate("/api/reminder-stages");
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[14px]">{stage.name}</h3>
            {stage.isEscalation && (
              <span
                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "var(--status-escalated-bg)", color: "var(--status-escalated)" }}
              >
                ESCALATION
              </span>
            )}
            {!stage.active && (
              <span
                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "var(--status-upcoming-bg)", color: "var(--status-upcoming)" }}
              >
                INACTIVE
              </span>
            )}
          </div>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--ink-muted)" }}>
            {offsetLabel(stage.offsetDays)} · Template: {stage.template?.name ?? "None"}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={toggleActive}>
            {stage.active ? "Deactivate" : "Activate"}
          </Button>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="danger" onClick={remove}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

function StageEditor({
  stage,
  templates,
  onClose,
  onSaved,
}: {
  stage: Stage | null;
  templates: Template[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(stage?.name ?? "");
  const [offsetDays, setOffsetDays] = useState(String(stage?.offsetDays ?? 0));
  const [isEscalation, setIsEscalation] = useState(stage?.isEscalation ?? false);
  const [templateId, setTemplateId] = useState(stage?.templateId ?? templates[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name,
      offsetDays: parseInt(offsetDays, 10) || 0,
      isEscalation,
      templateId: templateId || null,
      sequence: parseInt(offsetDays, 10) || 0,
    };
    if (stage) {
      await fetch(`/api/reminder-stages/${stage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/reminder-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <Label>Stage Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 3 days before due" />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Offset (days; negative = before due, positive = after)</Label>
          <Input type="number" value={offsetDays} onChange={(e) => setOffsetDays(e.target.value)} />
        </div>
        <div>
          <Label>Email Template</Label>
          <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">None</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--ink-muted)" }}>
        <input type="checkbox" checked={isEscalation} onChange={(e) => setIsEscalation(e.target.checked)} />
        Mark as escalation stage
      </label>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving || !name.trim()}>
          {saving ? "Saving…" : "Save Stage"}
        </Button>
      </div>
    </Card>
  );
}

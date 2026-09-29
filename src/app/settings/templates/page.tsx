"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import Link from "next/link";
import { Card, Button, Input, Textarea, Label, Select } from "@/components/ui";
import { TEMPLATE_TOKENS, RETENTION_TEMPLATE_TOKENS } from "@/lib/template";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type TemplateCategory = "MILESTONE" | "RETENTION";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: TemplateCategory;
  toRecipients: string;
  ccRecipients: string;
  bccRecipients: string;
}

export default function TemplatesPage() {
  const { data: templates, isLoading } = useSWR<Template[]>("/api/templates", fetcher);
  const [creating, setCreating] = useState(false);

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-10 flex flex-col gap-6">
      <div className="animate-fade-up">
        <Link href="/settings" className="text-[12.5px] font-medium hover:opacity-80 transition-opacity" style={{ color: "var(--accent)" }}>
          ← Settings
        </Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-[26px] font-semibold tracking-tight">Email Templates</h1>
          <Button onClick={() => setCreating(true)}>+ New Template</Button>
        </div>
      </div>

      <Card className="text-[12px]" style={{ color: "var(--ink-muted)" } as React.CSSProperties}>
        Available tokens: {TEMPLATE_TOKENS.map((t) => (
          <code key={t} className="mx-0.5 px-1.5 py-0.5 rounded" style={{ background: "var(--bg)", color: "var(--ink)" }}>
            {"{{" + t + "}}"}
          </code>
        ))}
      </Card>

      {creating && (
        <TemplateEditor
          template={null}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            mutate("/api/templates");
          }}
        />
      )}

      {isLoading ? (
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
      ) : (
        <div className="flex flex-col gap-3">
          {(templates ?? []).map((t) => (
            <TemplateRow key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateRow({ template }: { template: Template }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TemplateEditor
        template={template}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          mutate("/api/templates");
        }}
      />
    );
  }

  async function remove() {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
    mutate("/api/templates");
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-[14px]">{template.name}</h3>
            <span
              className="text-[10.5px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
              style={{
                background: template.category === "RETENTION" ? "var(--accent-bg, var(--bg))" : "var(--bg)",
                color: template.category === "RETENTION" ? "var(--accent)" : "var(--ink-faint)",
              }}
            >
              {template.category === "RETENTION" ? "Retention" : "Milestone"}
            </span>
          </div>
          <p className="text-[12.5px] mt-1" style={{ color: "var(--ink-muted)" }}>
            {template.subject}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
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

function TemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [category, setCategory] = useState<TemplateCategory>(template?.category ?? "MILESTONE");
  const [to, setTo] = useState(template?.toRecipients ?? "");
  const [cc, setCc] = useState(template?.ccRecipients ?? "");
  const [bcc, setBcc] = useState(template?.bccRecipients ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim() || !subject.trim() || !body.trim()) return;
    setSaving(true);
    const payload = { name, subject, body, category, toRecipients: to, ccRecipients: cc, bccRecipients: bcc };
    if (template) {
      await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/templates", {
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
        <Label>Template Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Payment Reminder" />
      </div>
      <div>
        <Label>Used for</Label>
        <Select value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)}>
          <option value="MILESTONE">Milestone reminders (jobCode, milestoneLabel, balanceAmount, dueDate, …)</option>
          <option value="RETENTION">Retention emails (retention_amount, retention_due_date, …)</option>
        </Select>
      </div>
      <div>
        <Label>Subject</Label>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Payment Reminder — {{projectName}}" />
      </div>
      <div>
        <Label>Body</Label>
        <Textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
        <div className="mt-1.5 text-[11px] flex flex-wrap gap-1" style={{ color: "var(--ink-faint)" }}>
          Tokens for this category:{" "}
          {(category === "RETENTION" ? RETENTION_TEMPLATE_TOKENS : TEMPLATE_TOKENS).map((t) => (
            <code key={t} className="px-1.5 py-0.5 rounded" style={{ background: "var(--bg)" }}>
              {`{{${t}}}`}
            </code>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <Label>To</Label>
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com, ..." />
        </div>
        <div>
          <Label>CC</Label>
          <Input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@example.com" />
        </div>
        <div>
          <Label>BCC</Label>
          <Input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="bcc@example.com" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving || !name.trim() || !subject.trim() || !body.trim()}>
          {saving ? "Saving…" : "Save Template"}
        </Button>
      </div>
    </Card>
  );
}

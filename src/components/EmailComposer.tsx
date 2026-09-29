"use client";

import { useRef, useState } from "react";
import { mutate } from "swr";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";
import { RETENTION_TEMPLATE_TOKENS, renderTemplate, type TemplateContext } from "@/lib/template";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  toRecipients: string;
  ccRecipients: string;
  bccRecipients: string;
}

interface PendingAttachment {
  filename: string;
  contentType: string;
  dataUrl: string;
  sizeBytes: number;
}

export function EmailComposer({
  installmentId,
  installmentLabel,
  defaultTo,
  templates,
  threadKey,
  tokenContext,
  onClose,
}: {
  installmentId: string;
  installmentLabel: string;
  defaultTo: string;
  templates: EmailTemplate[];
  threadKey: string;
  tokenContext: Partial<TemplateContext>;
  onClose: () => void;
}) {
  const DEFAULT_SUBJECT = `Retention Reminder — ${installmentLabel}`;
  const DEFAULT_BODY =
    "Dear {{client_name}},\n\nThis is a reminder regarding the retention amount due for {{project_name}}.\n\nRetention Amount: {{retention_amount}}\nDue Date: {{retention_due_date}}\nOutstanding: {{retention_outstanding}}\n\nPlease arrange payment at your earliest convenience.\n\nRegards";

  const [templateId, setTemplateId] = useState("");
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  // Rendered immediately with real values (not raw {{tokens}}) so what you
  // see while editing is what actually gets sent.
  const [subject, setSubject] = useState(renderTemplate(DEFAULT_SUBJECT, tokenContext));
  const [body, setBody] = useState(renderTemplate(DEFAULT_BODY, tokenContext));
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) {
      setSubject(renderTemplate(DEFAULT_SUBJECT, tokenContext));
      setBody(renderTemplate(DEFAULT_BODY, tokenContext));
      return;
    }
    const t = templates.find((tmpl) => tmpl.id === id);
    if (!t) return;
    setSubject(renderTemplate(t.subject, tokenContext));
    setBody(renderTemplate(t.body, tokenContext));
    if (t.toRecipients) setTo(t.toRecipients);
    if (t.ccRecipients) setCc(t.ccRecipients);
    if (t.bccRecipients) setBcc(t.bccRecipients);
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const next: PendingAttachment[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataUrl(file);
      next.push({ filename: file.name, contentType: file.type || "application/octet-stream", dataUrl, sizeBytes: file.size });
    }
    setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function send() {
    setError(null);
    const toList = to
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (toList.length === 0) {
      setError("Add at least one recipient in To.");
      return;
    }
    setSending(true);
    const res = await fetch(`/api/retention/${installmentId}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: toList,
        cc: cc.split(",").map((s) => s.trim()).filter(Boolean),
        bcc: bcc.split(",").map((s) => s.trim()).filter(Boolean),
        subject,
        body,
        attachments: attachments.map(({ filename, contentType, dataUrl }) => ({ filename, contentType, dataUrl })),
      }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't send this email.");
      return;
    }
    await mutate(threadKey);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 flex flex-col gap-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[17px]">Compose Email</h3>
          <button onClick={onClose} className="text-[13px]" style={{ color: "var(--ink-faint)" }}>
            ✕
          </button>
        </div>

        {templates.length > 0 && (
          <div>
            <Label>Start from template</Label>
            <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">— Blank —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>To</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.com" />
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

        <div>
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>

        <div>
          <Label>Body</Label>
          <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--ink-faint)" }}>
            Values are already filled in above — you can still type these tokens anywhere in the
            text and they&apos;ll be replaced with the same real values when sent:
          </p>
          <div className="mt-1 text-[11px] flex flex-wrap gap-1" style={{ color: "var(--ink-faint)" }}>
            {RETENTION_TEMPLATE_TOKENS.map((t) => (
              <code key={t} className="px-1.5 py-0.5 rounded" style={{ background: "var(--bg)" }}>
                {`{{${t}}}`}
              </code>
            ))}
          </div>
        </div>

        <div>
          <Label>Attachments</Label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex flex-col gap-1.5">
            {attachments.map((a, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 text-[12px]" style={{ background: "var(--bg)" }}>
                <span className="truncate">{a.filename}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span style={{ color: "var(--ink-faint)" }}>{formatBytes(a.sizeBytes)}</span>
                  <button onClick={() => removeAttachment(i)} style={{ color: "var(--status-overdue)" }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="self-start">
              + Attach File
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-[12.5px]" style={{ color: "var(--status-overdue)" }}>
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end pt-2 border-t" style={{ borderColor: "var(--border)" }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending}>
            {sending ? "Sending…" : "Send Email"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export interface TemplateContext {
  clientName: string;
  projectName: string;
  jobCode: string;
  subJobName: string;
  milestoneLabel: string;
  balanceAmount: string;
  dueDate: string;
  poAmount: string;
  billedAmount: string;
  // retention-specific
  outstandingAmount: string;
  retentionAmount: string;
  retentionDueDate: string;
  retentionLabel: string;
  retentionReceived: string;
  retentionOutstanding: string;
}

// snake_case alias -> camelCase key, so templates can use either
// {{po_value}} (per the spec) or {{poAmount}} (existing convention).
const SNAKE_CASE_ALIASES: Record<string, keyof TemplateContext> = {
  client_name: "clientName",
  project_name: "projectName",
  job_code: "jobCode",
  sub_job_name: "subJobName",
  milestone_label: "milestoneLabel",
  balance_amount: "balanceAmount",
  due_date: "dueDate",
  po_value: "poAmount",
  po_amount: "poAmount",
  billed_value: "billedAmount",
  billed_amount: "billedAmount",
  outstanding_amount: "outstandingAmount",
  retention_amount: "retentionAmount",
  retention_due_date: "retentionDueDate",
  retention_label: "retentionLabel",
  retention_received: "retentionReceived",
  retention_outstanding: "retentionOutstanding",
};

export function renderTemplate(text: string, ctx: Partial<TemplateContext>): string {
  return text.replace(/\{\{\s*([a-zA-Z_]\w*)\s*\}\}/g, (_, rawKey: string) => {
    const key = (SNAKE_CASE_ALIASES[rawKey] ?? rawKey) as keyof TemplateContext;
    return key in ctx && ctx[key] != null ? String(ctx[key]) : `{{${rawKey}}}`;
  });
}

export const TEMPLATE_TOKENS = [
  "clientName",
  "projectName",
  "jobCode",
  "subJobName",
  "milestoneLabel",
  "balanceAmount",
  "dueDate",
  "poAmount",
  "billedAmount",
] as const;

export const RETENTION_TEMPLATE_TOKENS = [
  "client_name",
  "project_name",
  "po_value",
  "billed_value",
  "outstanding_amount",
  "retention_amount",
  "retention_due_date",
] as const;

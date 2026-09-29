import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type AuditAction = "create" | "update" | "delete";

export async function logAudit(params: {
  action: AuditAction;
  entityType: string;
  entityId: string;
  summary: string;
  diff?: Record<string, [unknown, unknown]>;
}) {
  const session = await auth();
  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id ?? null,
      userName: session?.user?.name ?? session?.user?.email ?? "System",
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      summary: params.summary,
      diff: params.diff ? JSON.stringify(params.diff) : null,
    },
  });
}

/** Computes a {field: [old, new]} diff for changed keys only. */
export function computeDiff<T extends Record<string, unknown>>(before: T, after: Partial<T>): Record<string, [unknown, unknown]> {
  const diff: Record<string, [unknown, unknown]> = {};
  for (const key of Object.keys(after)) {
    const oldVal = before[key];
    const newVal = after[key as keyof T];
    if (newVal !== undefined && oldVal !== newVal) {
      diff[key] = [oldVal, newVal];
    }
  }
  return diff;
}

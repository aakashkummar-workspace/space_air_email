import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, computeDiff } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  amountReceived: z.number().min(0).optional(),
  remarks: z.string().nullable().optional(),
  autoSendEmail: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { dueDate, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (dueDate !== undefined) {
    data.dueDate = dueDate ? new Date(dueDate) : null;
    // A new due date means any previous auto-send no longer applies — allow
    // it to fire again for the rescheduled date.
    data.autoSentAt = null;
  }

  const before = await prisma.retentionInstallment.findUnique({ where: { id } });
  const installment = await prisma.retentionInstallment.update({ where: { id }, data });

  if (before) {
    const diff = computeDiff(before, data);
    if (Object.keys(diff).length > 0) {
      await logAudit({
        action: "update",
        entityType: "RetentionInstallment",
        entityId: installment.id,
        summary: `Updated retention installment "${installment.label}" (${Object.keys(diff).join(", ")})`,
        diff,
      });
    }
  }
  return NextResponse.json(installment);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const installment = await prisma.retentionInstallment.findUnique({ where: { id } });
  await prisma.retentionInstallment.delete({ where: { id } });
  if (installment) {
    await logAudit({
      action: "delete",
      entityType: "RetentionInstallment",
      entityId: id,
      summary: `Deleted retention installment "${installment.label}"`,
    });
  }
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, computeDiff } from "@/lib/audit";
import { z } from "zod";

const updateMilestoneSchema = z.object({
  label: z.string().min(1).optional(),
  percent: z.number().optional(),
  sequence: z.number().optional(),
  billedSupplyAmt: z.number().optional(),
  billedInstallationAmt: z.number().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateMilestoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { dueDate, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
  const before = await prisma.milestone.findUnique({ where: { id } });
  const milestone = await prisma.milestone.update({ where: { id }, data });

  if (before) {
    const diff = computeDiff(before, data);
    if (Object.keys(diff).length > 0) {
      await logAudit({
        action: "update",
        entityType: "Milestone",
        entityId: milestone.id,
        summary: `Updated milestone "${milestone.label}" (${Object.keys(diff).join(", ")})`,
        diff,
      });
    }
  }
  return NextResponse.json(milestone);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const milestone = await prisma.milestone.findUnique({ where: { id } });
  await prisma.milestone.delete({ where: { id } });
  if (milestone) {
    await logAudit({
      action: "delete",
      entityType: "Milestone",
      entityId: id,
      summary: `Deleted milestone "${milestone.label}"`,
    });
  }
  return NextResponse.json({ ok: true });
}

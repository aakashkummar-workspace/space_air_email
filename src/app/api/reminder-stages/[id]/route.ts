import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, computeDiff } from "@/lib/audit";
import { z } from "zod";

const updateStageSchema = z.object({
  name: z.string().min(1).optional(),
  offsetDays: z.number().optional(),
  isEscalation: z.boolean().optional(),
  active: z.boolean().optional(),
  sequence: z.number().optional(),
  templateId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateStageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const before = await prisma.reminderStage.findUnique({ where: { id } });
  const stage = await prisma.reminderStage.update({
    where: { id },
    data: parsed.data,
    include: { template: true },
  });

  if (before) {
    const diff = computeDiff(before, parsed.data);
    if (Object.keys(diff).length > 0) {
      await logAudit({
        action: "update",
        entityType: "ReminderStage",
        entityId: stage.id,
        summary: `Updated reminder stage "${stage.name}" (${Object.keys(diff).join(", ")})`,
        diff,
      });
    }
  }
  return NextResponse.json(stage);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stage = await prisma.reminderStage.findUnique({ where: { id } });
  await prisma.reminderStage.delete({ where: { id } });
  if (stage) {
    await logAudit({
      action: "delete",
      entityType: "ReminderStage",
      entityId: id,
      summary: `Deleted reminder stage "${stage.name}"`,
    });
  }
  return NextResponse.json({ ok: true });
}

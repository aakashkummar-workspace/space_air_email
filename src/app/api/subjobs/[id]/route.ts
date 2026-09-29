import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit, computeDiff } from "@/lib/audit";
import { z } from "zod";

const updateSubJobSchema = z.object({
  name: z.string().min(1).optional(),
  poSupplyAmt: z.number().optional(),
  poInstallationAmt: z.number().optional(),
  sellingSupplyAmt: z.number().optional(),
  sellingErectionAmt: z.number().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSubJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const before = await prisma.subJob.findUnique({ where: { id } });
  const subJob = await prisma.subJob.update({ where: { id }, data: parsed.data });

  if (before) {
    const diff = computeDiff(before, parsed.data);
    if (Object.keys(diff).length > 0) {
      await logAudit({
        action: "update",
        entityType: "SubJob",
        entityId: subJob.id,
        summary: `Updated sub-job "${subJob.name}" (${Object.keys(diff).join(", ")})`,
        diff,
      });
    }
  }
  return NextResponse.json(subJob);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subJob = await prisma.subJob.findUnique({ where: { id } });
  await prisma.subJob.delete({ where: { id } });
  if (subJob) {
    await logAudit({
      action: "delete",
      entityType: "SubJob",
      entityId: id,
      summary: `Deleted sub-job "${subJob.name}"`,
    });
  }
  return NextResponse.json({ ok: true });
}

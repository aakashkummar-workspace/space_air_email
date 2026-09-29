import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createMilestoneSchema = z.object({
  label: z.string().min(1),
  percent: z.number().default(0),
  sequence: z.number().default(0),
  billedSupplyAmt: z.number().default(0),
  billedInstallationAmt: z.number().default(0),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = createMilestoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { dueDate, ...rest } = parsed.data;
  const milestone = await prisma.milestone.create({
    data: { ...rest, subJobId: id, dueDate: dueDate ? new Date(dueDate) : null },
  });
  await logAudit({
    action: "create",
    entityType: "Milestone",
    entityId: milestone.id,
    summary: `Added milestone "${milestone.label}" to sub-job`,
  });
  return NextResponse.json(milestone, { status: 201 });
}

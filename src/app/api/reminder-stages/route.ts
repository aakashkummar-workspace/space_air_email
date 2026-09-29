import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const stageSchema = z.object({
  name: z.string().min(1),
  offsetDays: z.number(),
  isEscalation: z.boolean().default(false),
  active: z.boolean().default(true),
  sequence: z.number().default(0),
  templateId: z.string().nullable().optional(),
});

export async function GET() {
  const stages = await prisma.reminderStage.findMany({
    orderBy: { sequence: "asc" },
    include: { template: true },
  });
  return NextResponse.json(stages);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = stageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const stage = await prisma.reminderStage.create({ data: parsed.data, include: { template: true } });
  await logAudit({
    action: "create",
    entityType: "ReminderStage",
    entityId: stage.id,
    summary: `Added reminder stage "${stage.name}"`,
  });
  return NextResponse.json(stage, { status: 201 });
}

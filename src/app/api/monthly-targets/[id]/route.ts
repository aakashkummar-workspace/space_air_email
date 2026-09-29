import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const updateSchema = z.object({
  billingTarget: z.number().optional(),
  billingAchieved: z.number().optional(),
  collectionTarget: z.number().optional(),
  collectionAchieved: z.number().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const target = await prisma.monthlyTarget.update({ where: { id }, data: parsed.data });
  await logAudit({
    action: "update",
    entityType: "MonthlyTarget",
    entityId: target.id,
    summary: `Updated ${target.month}/${target.year} targets`,
  });
  return NextResponse.json(target);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.monthlyTarget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

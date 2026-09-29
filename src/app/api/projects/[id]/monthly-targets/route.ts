import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const upsertSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  billingTarget: z.number().default(0),
  billingAchieved: z.number().default(0),
  collectionTarget: z.number().default(0),
  collectionAchieved: z.number().default(0),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const targets = await prisma.monthlyTarget.findMany({
    where: { projectId: id },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  return NextResponse.json(targets);
}

// Upsert — one row per (project, month, year). Used both by manual edits
// and by the Excel importer's monthly-tracker columns.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { month, year, ...amounts } = parsed.data;

  const target = await prisma.monthlyTarget.upsert({
    where: { projectId_year_month: { projectId: id, year, month } },
    update: amounts,
    create: { projectId: id, month, year, ...amounts },
  });

  await logAudit({
    action: "update",
    entityType: "MonthlyTarget",
    entityId: target.id,
    summary: `Set ${month}/${year} targets for project`,
  });

  return NextResponse.json(target, { status: 201 });
}

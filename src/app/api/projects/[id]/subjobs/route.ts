import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createSubJobSchema = z.object({
  name: z.string().min(1),
  poSupplyAmt: z.number().default(0),
  poInstallationAmt: z.number().default(0),
  sellingSupplyAmt: z.number().default(0),
  sellingErectionAmt: z.number().default(0),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = createSubJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const subJob = await prisma.subJob.create({
    data: { ...parsed.data, projectId: id },
    include: { milestones: true, collections: true },
  });
  await logAudit({
    action: "create",
    entityType: "SubJob",
    entityId: subJob.id,
    summary: `Added sub-job "${subJob.name}" to project`,
  });
  return NextResponse.json(subJob, { status: 201 });
}
